import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createApp } from "../../server/index.mjs";
import { createSignGate, GENESIS_DIGEST } from "../../server/sign.mjs";
import { createErp } from "../../src/erp.js";
import { createToolset } from "../../src/tools.js";
import { ApiError, createApiClient } from "../../src/page/api-client.js";
import { createSignBridge } from "../../src/page/sign-bridge.js";
import { createSignatureProvider } from "../../src/page/sign-install.js";

const schemaPath = fileURLToPath(new URL("../../erp/contracts/signature.schema.json", import.meta.url));
const signatureSchema = JSON.parse(readFileSync(schemaPath, "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function requestJson(base, path, cookie, { method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function withEmployeeApp(fn) {
  const signGate = createSignGate();
  const server = createServer(createApp({ signGate }));
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginResponse = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "chen" }),
    });
    assert.equal(loginResponse.status, 200);
    const sessionCookie = loginResponse.headers.get("set-cookie").split(";")[0];
    await fn({ base, cookie: sessionCookie, signGate });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function createDraft(api, {
  title = "Server authority fixture",
  merchant = "Heron Cafeteria",
  amount = 18.2,
} = {}) {
  const created = await api.createReport({ title, project: "FALCON" });
  return api.addLine(created.report.id, {
    date: "2026-08-20",
    merchant,
    category: "meals",
    amount,
    currency: "USD",
    attendees: 1,
    description: "Lunch",
  });
}

async function respondSigned(base, cookie, signRequest) {
  const token = await requestJson(base, `/api/sign/${signRequest.request_id}/confirm-token`, cookie);
  assert.equal(token.status, 200, JSON.stringify(token.body));
  const responded = await requestJson(base, `/api/sign/${signRequest.request_id}/respond`, cookie, {
    method: "POST",
    body: {
      schema: "outpocket.sign_respond_request/1",
      request_id: signRequest.request_id,
      decision: "signed",
      reason: null,
      method: "click",
      acknowledged_digest: signRequest.snapshot_digest,
      acknowledged_revision: signRequest.revision,
      confirm_token: token.body.confirm_token,
    },
  });
  assert.equal(responded.status, 200, JSON.stringify(responded.body));
  return responded.body;
}

function comparableCacheReport(report) {
  return {
    id: report.id,
    owner: report.owner,
    title: report.title,
    project: report.project,
    status: report.status,
    revision: report.revision,
    artifact: report.artifact ?? null,
    lines: report.lines.map((line) => ({
      id: line.id,
      date: line.date ?? null,
      merchant: line.merchant ?? null,
      category: line.category ?? null,
      amount_cents: line.amountCents ?? null,
      currency: line.currency ?? null,
      attendees: line.attendees ?? null,
      nights: line.nights ?? null,
      itemization: Array.isArray(line.itemization)
        ? line.itemization.map((item) => ({ label: item.label, amount_cents: item.amountCents }))
        : null,
      description: line.description ?? null,
      receipt_id: line.receiptId ?? null,
      receipt_sha256: line.receiptSha256 ?? null,
      provenance: line.provenance,
    })),
  };
}

function comparableServerReport(report) {
  return {
    id: report.id,
    owner: report.owner,
    title: report.title,
    project: report.project,
    status: report.status,
    revision: report.revision,
    artifact: report.artifact ?? null,
    lines: report.lines.map((line) => ({
      id: line.id,
      date: line.date,
      merchant: line.merchant,
      category: line.category,
      amount_cents: line.amount_cents,
      currency: line.currency,
      attendees: line.attendees,
      nights: line.nights,
      itemization: line.itemization,
      description: line.description,
      receipt_id: line.receipt_id,
      receipt_sha256: line.receipt_sha256,
      provenance: line.provenance,
    })),
  };
}

test("the API client applies a 20 second deadline and maps only that abort to E_TIMEOUT", async () => {
  const originalTimeout = AbortSignal.timeout;
  const timeoutController = new AbortController();
  let requestedTimeout = null;
  AbortSignal.timeout = (milliseconds) => {
    requestedTimeout = milliseconds;
    return timeoutController.signal;
  };
  try {
    const api = createApiClient({
      fetchImpl: async (_url, { signal }) => {
        assert.ok(signal, "the request did not receive an internal deadline signal");
        queueMicrotask(() => timeoutController.abort(new DOMException("deadline", "TimeoutError")));
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });

    await assert.rejects(
      api.listReports(),
      (error) => error instanceof ApiError && error.code === "E_TIMEOUT" && error.status === 0,
    );
    assert.equal(requestedTimeout, 20_000);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test("an explicit API caller abort remains the caller's AbortError", async () => {
  const originalTimeout = AbortSignal.timeout;
  const timeoutController = new AbortController();
  AbortSignal.timeout = () => timeoutController.signal;
  try {
    const caller = new AbortController();
    const reason = new DOMException("caller cancelled", "AbortError");
    const api = createApiClient({
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    });
    const pending = api.listReports(caller.signal);
    caller.abort(reason);
    await assert.rejects(pending, (error) => error === reason);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test("line routes reject impossible calendar dates without mutating the report", async () => {
  await withEmployeeApp(async ({ base, cookie }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const created = await api.createReport({ title: "Calendar boundary", project: "FALCON" });
    const before = await api.getReport(created.report.id);
    const rejected = await requestJson(base, `/api/reports/${created.report.id}/lines`, cookie, {
      method: "POST",
      body: {
        date: "2026-02-30",
        merchant: "Impossible Date Co",
        category: "transport",
        amount_cents: 2000,
        currency: "USD",
      },
    });

    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error, "E_BAD_REQUEST");
    assert.match(rejected.body.message, /valid calendar date/);
    assert.deepEqual(await api.getReport(created.report.id), before);
  });
});

test("line routes reject non-safe integers without partially inserting a line", async () => {
  await withEmployeeApp(async ({ base, cookie }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const created = await api.createReport({ title: "Integer boundary", project: "FALCON" });
    const before = await api.getReport(created.report.id);
    const rejected = await requestJson(base, `/api/reports/${created.report.id}/lines`, cookie, {
      method: "POST",
      body: {
        date: "2026-08-20",
        merchant: "Unsafe Integer Probe",
        category: "airfare",
        amount_cents: Number.MAX_SAFE_INTEGER + 1,
        currency: "USD",
      },
    });

    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error, "E_BAD_REQUEST");
    assert.match(rejected.body.message, /safe integer/);
    assert.deepEqual(await api.getReport(created.report.id), before);
  });
});

test("line routes reject unsafe currency conversions and report totals before mutation", async () => {
  await withEmployeeApp(async ({ base, cookie }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const created = await api.createReport({ title: "Currency overflow boundary", project: "FALCON" });
    const reportId = created.report.id;
    const empty = await api.getReport(reportId);
    const rejectedConversion = await requestJson(base, `/api/reports/${reportId}/lines`, cookie, {
      method: "POST",
      body: {
        date: "2026-08-20",
        merchant: "Unsafe EUR conversion",
        category: "airfare",
        amount_cents: Number.MAX_SAFE_INTEGER,
        currency: "EUR",
      },
    });
    assert.equal(rejectedConversion.status, 400);
    assert.match(rejectedConversion.body.message, /safe integer range/);
    assert.deepEqual(await api.getReport(reportId), empty);

    const maximum = await requestJson(base, `/api/reports/${reportId}/lines`, cookie, {
      method: "POST",
      body: {
        date: "2026-08-20",
        merchant: "Maximum safe USD",
        category: "airfare",
        amount_cents: Number.MAX_SAFE_INTEGER,
        currency: "USD",
      },
    });
    assert.equal(maximum.status, 201);
    const beforeRejectedMutations = await api.getReport(reportId);
    const lineId = beforeRejectedMutations.report.lines[0].id;

    const rejectedCurrencyPatch = await requestJson(base, `/api/reports/${reportId}/lines/${lineId}`, cookie, {
      method: "PATCH",
      body: { currency: "EUR" },
    });
    assert.equal(rejectedCurrencyPatch.status, 400);
    assert.match(rejectedCurrencyPatch.body.message, /safe integer range/);
    assert.deepEqual(await api.getReport(reportId), beforeRejectedMutations);

    const rejectedTotal = await requestJson(base, `/api/reports/${reportId}/lines`, cookie, {
      method: "POST",
      body: {
        date: "2026-08-20",
        merchant: "Report total overflow",
        category: "airfare",
        amount_cents: 1,
        currency: "USD",
      },
    });
    assert.equal(rejectedTotal.status, 400);
    assert.match(rejectedTotal.body.message, /safe integer range/);
    assert.deepEqual(await api.getReport(reportId), beforeRejectedMutations);
  });
});

test("receipt metadata rejects empty files before they can satisfy evidence rules", async () => {
  await withEmployeeApp(async ({ base, cookie }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const before = await api.listReceipts();
    const rejected = await requestJson(base, "/api/ui/receipts", cookie, {
      method: "POST",
      body: {
        filename: "empty.pdf",
        size: 0,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    });

    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error, "E_BAD_REQUEST");
    assert.match(rejected.body.message, /positive safe integer size/);
    assert.deepEqual(await api.listReceipts(), before);
  });
});

async function assertCacheMatchesServer(erp, api, expectedRevision) {
  const cached = erp.openReportOrNull();
  const payload = await api.getReport(cached.id);
  assert.equal(payload.report.revision, expectedRevision);
  assert.deepEqual(comparableCacheReport(cached), comparableServerReport(payload.report));
  assert.deepEqual(cached.provenance, payload.provenance);
  return payload;
}

test("POST /api/sign rejects an unknown report without creating sign or chain state", async () => {
  await withEmployeeApp(async ({ base, cookie, signGate }) => {
    const reportId = "RP-FORGED-WEBMCP";
    const example = clone(signatureSchema.examples[0]);
    const forgedReport = { ...example.snapshot.report, id: reportId };

    const beforeReport = await requestJson(base, `/api/reports/${reportId}`, cookie);
    const beforeDayBook = await requestJson(base, "/api/daybook", cookie);
    assert.equal(beforeReport.status, 404);

    const opened = await requestJson(base, "/api/sign", cookie, {
      method: "POST",
      body: {
        report_id: reportId,
        report: forgedReport,
        verdict: { blocking: 0, violations: [], warning: 0 },
        revision: 14,
        policy_version: example.policy_version,
        policy_digest: example.snapshot.policy_digest,
        worst_case: example.worst_case,
        violation_history_count: example.violation_history_count,
      },
    });

    assert.equal(opened.status, 404);
    assert.equal(opened.body.error, "E_REPORT_NOT_FOUND");
    assert.equal(signGate.peekOpenRequestId(reportId, { sessionId: cookie.split("=")[1] }), null);
    assert.equal(signGate.locks.isLocked(reportId), false);
    assert.deepEqual(signGate.chain.list(), beforeDayBook.body.entries);
    assert.equal(signGate.chain.currentHead(), beforeDayBook.body.head);

    const afterReport = await requestJson(base, `/api/reports/${reportId}`, cookie);
    const afterDayBook = await requestJson(base, "/api/daybook", cookie);
    assert.equal(afterReport.status, 404);
    assert.deepEqual(afterDayBook.body, beforeDayBook.body);
  });
});

test("client report, verdict, revision and policy claims are rejected without changing the server aggregate", async () => {
  await withEmployeeApp(async ({ base, cookie, signGate }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const created = await createDraft(api);
    const reportId = created.report.id;
    const before = await api.getReport(reportId);
    const beforeDayBook = await requestJson(base, "/api/daybook", cookie);
    const conflicting = clone(before.report);
    conflicting.title = "CLIENT REPLACEMENT";
    conflicting.revision = 999;
    conflicting.lines[0].merchant = "Client Merchant";

    const opened = await requestJson(base, "/api/sign", cookie, {
      method: "POST",
      body: {
        report_id: reportId,
        report: conflicting,
        verdict: { blocking: 0, violations: [], warning: 0 },
        revision: 999,
        policy_version: "client-policy",
        policy_digest: `sha256:${"f".repeat(64)}`,
      },
    });

    assert.equal(opened.status, 400);
    assert.equal(opened.body.error, "E_BAD_SIGN_REQUEST");
    assert.match(opened.body.message, /client authority field/);
    assert.deepEqual(await api.getReport(reportId), before);
    assert.equal(signGate.peekOpenRequestId(reportId, { sessionId: cookie.split("=")[1] }), null);
    assert.equal(signGate.locks.isLocked(reportId), false);
    assert.equal(signGate.chain.currentHead(), beforeDayBook.body.head);
    assert.deepEqual(signGate.chain.list(), beforeDayBook.body.entries);
  });
});

test("forged provenance and receipt metadata cannot enter a signed snapshot or committed artifact", async () => {
  await withEmployeeApp(async ({ base, cookie, signGate }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const created = await createDraft(api);
    const reportId = created.report.id;
    const before = await api.getReport(reportId);
    const forged = clone(before.report);
    forged.lines[0].provenance = Object.fromEntries(
      Object.keys(forged.lines[0].provenance).map((field) => [field, "human"]),
    );
    forged.lines[0].receipt_id = "rc_invented";
    forged.lines[0].receipt_sha256 = "e".repeat(64);

    const attack = await requestJson(base, "/api/sign", cookie, {
      method: "POST",
      body: { report_id: reportId, report: forged },
    });
    assert.equal(attack.status, 400);
    assert.equal(attack.body.error, "E_BAD_SIGN_REQUEST");
    assert.deepEqual(await api.getReport(reportId), before);
    const receipts = await api.listReceipts();
    assert.ok(!receipts.receipts.some((receipt) => receipt.id === "rc_invented"));
    assert.equal(signGate.locks.isLocked(reportId), false);
    assert.deepEqual(signGate.chain.list(), []);

    const opened = await requestJson(base, "/api/sign", cookie, {
      method: "POST",
      body: { report_id: reportId },
    });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const signedLine = opened.body.sign_request.snapshot.report.lines[0];
    assert.deepEqual(signedLine.provenance, before.report.lines[0].provenance);
    assert.equal(Object.values(signedLine.provenance).filter((source) => source === "agent").length, 7);
    assert.equal(Object.values(signedLine.provenance).filter((source) => source === "human").length, 0);
    assert.equal(signedLine.receipt_id, null);
    assert.equal(signedLine.receipt_sha256, null);

    await respondSigned(base, cookie, opened.body.sign_request);
    const committed = await requestJson(base, `/api/reports/${reportId}/commit`, cookie, {
      method: "POST",
      body: {
        schema: "outpocket.commit_request/1",
        request_id: opened.body.sign_request.request_id,
        report_id: reportId,
      },
    });
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.deepEqual(committed.body.artifact.provenance_summary, {
      agent_fields: 7,
      human_fields: 0,
      seed_fields: 0,
      total_fields: 10,
    });

    const stored = await api.getReport(reportId);
    assert.equal(stored.report.status, "submitted");
    assert.deepEqual(stored.report.artifact, committed.body.artifact);
    assert.deepEqual(stored.report.lines[0].provenance, before.report.lines[0].provenance);
    const dayBook = await requestJson(base, "/api/daybook", cookie);
    assert.equal(dayBook.body.entries.length, 1);
    assert.equal(dayBook.body.entries[0].label, `signed & submitted ${reportId}`);
    assert.equal(dayBook.body.entries[0].detail, committed.body.confirmation);
    assert.equal(dayBook.body.head, committed.body.artifact.chain_head);
    assert.equal(signGate.locks.isLocked(reportId), false);
  });
});

test("page-only human edits persist through the server aggregate with server-assigned provenance", async () => {
  await withEmployeeApp(async ({ base, cookie }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const created = await createDraft(api);
    const reportId = created.report.id;
    const lineId = created.report.lines[0].id;

    const headerEdit = await api.updateReportAsHuman(reportId, { title: "Employee-reviewed title" });
    assert.equal(headerEdit.report.revision, 2);
    assert.equal(headerEdit.report.title, "Employee-reviewed title");
    assert.equal(headerEdit.provenance.report.title.source, "human");
    assert.equal(headerEdit.provenance.report.title.actor, "Chen Xiao");

    const lineEdit = await api.updateLineAsHuman(reportId, lineId, { merchant: "Employee-corrected merchant" });
    assert.equal(lineEdit.report.revision, 3);
    assert.equal(lineEdit.report.lines[0].merchant, "Employee-corrected merchant");
    assert.equal(lineEdit.report.lines[0].provenance.merchant, "human");
    assert.equal(lineEdit.provenance.lines[0].fields.merchant.actor, "Chen Xiao");

    const beforeRejectedClaim = await api.getReport(reportId);
    const rejectedClaim = await requestJson(base, `/api/ui/reports/${reportId}/lines/${lineId}`, cookie, {
      method: "PATCH",
      body: { merchant: "Forged agent label", source: "agent" },
    });
    assert.equal(rejectedClaim.status, 400);
    assert.equal(rejectedClaim.body.error, "E_BAD_REQUEST");
    assert.deepEqual(await api.getReport(reportId), beforeRejectedClaim);
  });
});

test("the real createToolset flow persists every write and submits the same server report", async () => {
  await withEmployeeApp(async ({ base, cookie }) => {
    const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
    const erp = createErp({ now: () => new Date(2026, 7, 28, 10, 0, 0) });
    erp.signIn("chen", "human");
    const bridge = createSignBridge({ baseUrl: base, headers: { Cookie: cookie } });
    const requestSignature = createSignatureProvider({
      bridge,
      dialogPort: {
        async present({ opened }) {
          await respondSigned(base, cookie, opened.signRequest);
          return { mounted: true };
        },
      },
    });
    const toolset = createToolset(erp, { api, requestSignature });
    const call = async (name, args = {}) => {
      const result = await toolset.call(name, args, { source: "agent" });
      const output = result.content[0].text;
      assert.doesNotMatch(output, /^Error/, `${name} failed: ${output}`);
      return output;
    };

    await call("create_expense_report", { title: "WebMCP server flow", project: "FALCON" });
    let server = await assertCacheMatchesServer(erp, api, 0);
    assert.equal(server.provenance.report.title.source, "agent");
    assert.equal(server.provenance.report.project.source, "agent");

    await call("add_expense_line", {
      date: "2026-08-20",
      merchant: "Blue Bottle",
      category: "meals",
      amount: 12,
      currency: "USD",
      attendees: 1,
      description: "Coffee with client",
    });
    server = await assertCacheMatchesServer(erp, api, 1);
    const lineId = server.report.lines[0].id;
    assert.equal(server.report.lines[0].provenance.merchant, "agent");

    await call("update_expense_line", { line_id: lineId, merchant: "Blue Bottle Coffee" });
    server = await assertCacheMatchesServer(erp, api, 2);
    assert.equal(server.report.lines[0].merchant, "Blue Bottle Coffee");
    assert.equal(server.report.lines[0].provenance.merchant, "agent");

    const attached = await api.attachReceiptMetadata({
      filename: "coffee-receipt.svg",
      size: 321,
      sha256: "b".repeat(64),
    });
    erp.adoptServerReceipts(attached.receipts);
    const receiptId = attached.receipt.id;
    assert.match(await call("list_receipts"), new RegExp(receiptId));
    await call("link_receipt", { line_id: lineId, receipt_id: receiptId });
    server = await assertCacheMatchesServer(erp, api, 3);
    assert.equal(server.report.lines[0].receipt_id, receiptId);
    assert.equal(server.report.lines[0].receipt_sha256, "b".repeat(64));
    assert.equal(server.report.lines[0].provenance.receipt_id, "agent");

    assert.match(await call("validate_expense_report"), /Every policy check passes/);
    const beforeCommit = await requestJson(base, "/api/daybook", cookie);
    assert.deepEqual(beforeCommit.body.entries, []);

    const awaitingText = await call("submit_expense_report");
    const awaiting = JSON.parse(awaitingText);
    assert.deepEqual(Object.keys(awaiting).sort(), ["status", "ticket"]);
    assert.equal(awaiting.status, "awaiting_signature");
    assert.match(awaiting.ticket, /^tk_[0-9a-f]{32}$/);
    assert.doesNotMatch(awaitingText, /confirm_token|request_id|snapshot|digest|revision/i);
    assert.deepEqual((await requestJson(base, "/api/daybook", cookie)).body.entries, []);

    const submittedText = await call("submit_expense_report");
    assert.match(submittedText, /Signed and submitted/);
    assert.doesNotMatch(submittedText, /confirm_token|ct_[0-9a-f]/i);

    server = await assertCacheMatchesServer(erp, api, 3);
    assert.equal(server.report.status, "submitted");
    assert.ok(server.report.artifact);
    const dayBook = await requestJson(base, "/api/daybook", cookie);
    assert.equal(dayBook.body.entries.length, 1);
    assert.equal(dayBook.body.entries[0].label, `signed & submitted ${server.report.id}`);
    assert.equal(dayBook.body.head, server.report.artifact.chain_head);
  });
});

test("commit refuses a missing live report without falling back to the signed snapshot", () => {
  const reportId = "RP-MISSING-AT-COMMIT";
  let liveReport = { ...clone(signatureSchema.examples[0].snapshot.report), id: reportId };
  let prepareCalls = 0;
  const gate = createSignGate({
    getLiveReport: () => liveReport,
    prepareReportCommit: () => {
      prepareCalls += 1;
      return () => {};
    },
  });
  const sessionId = "missing-live-session";
  const { signRequest, ticket } = gate.open({
    sessionId,
    personaId: "chen",
    personaName: "Chen Xiao",
    reportId,
  });
  gate.respond({
    requestId: signRequest.request_id,
    sessionId,
    decision: "signed",
    reason: null,
    method: "click",
    acknowledgedDigest: signRequest.snapshot_digest,
    acknowledgedRevision: signRequest.revision,
    confirmToken: gate.peekConfirmTokenForDialog(signRequest.request_id, { sessionId }),
  });
  const answeredBefore = gate.continueTicket({ ticket, sessionId, reportId });
  liveReport = null;

  assert.throws(
    () => gate.commit({ requestId: signRequest.request_id, reportId, sessionId }),
    (error) => error.code === "E_REPORT_NOT_FOUND" && error.http === 404,
  );
  assert.equal(prepareCalls, 0);
  assert.deepEqual(gate.chain.list(), []);
  assert.equal(gate.chain.currentHead(), GENESIS_DIGEST);
  assert.equal(gate.locks.isLocked(reportId), true);
  assert.deepEqual(gate.continueTicket({ ticket, sessionId, reportId }), answeredBefore);
});
