// tests/acceptance/sign-install.test.mjs — node F7 (lane F, owner UX).
//
// F7 is the GLUE: register.js exposes setSignatureProvider, F4's dialog is
// DOM-only, S5's bridge is DOM-free, and nothing joined them. Three modules
// each scoped correctly; the seam belonged to no node.
//
// The shipped client abandons a suspended execute around 22 seconds. These
// tests therefore drive the real two-call contract: the first tool call mounts
// the dialog and returns an awaiting ticket, and a later call reads the
// server-owned decision. A single-call test would encode the production bug.
//
// Everything here is real except the dialog: a real http server, S1's real
// session cookie, S5's real sign gate and bridge, T2's real registry and its
// real double-locked dispatch. Only the human is simulated, which is the one
// thing a test cannot supply.

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { createApp } from "../../server/index.mjs";
import { createSignGate } from "../../server/sign.mjs";
import { createSignBridge, SIGN_MODE } from "../../src/page/sign-bridge.js";
import { createApiClient } from "../../src/page/api-client.js";
import { registry } from "../../src/page/register.js";
import { withRealServer } from "../helpers.mjs";
import {
  installSignatureProvider, createSignatureProvider, buildOpenBody,
  resetInstallForTests, REASONS,
} from "../../src/page/sign-install.js";

const erp = registry.erp;

async function withApp(signGate, fn) {
  const previousApi = { ...registry.api };
  const app = createApp({ signGate });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    Object.assign(registry.api, previousApi);
    await new Promise((resolve) => server.close(resolve));
  }
}

async function login(base, persona = "chen") {
  const res = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie").split(";")[0];
}
const cookieToSid = (pair) => pair.split("=")[1];

/** Create a clean server draft and cache its projection in the page model. */
async function cleanDraft(base, cookie) {
  erp.signIn("chen");
  const api = createApiClient({ baseUrl: base, headers: { Cookie: cookie } });
  Object.assign(registry.api, api);
  const created = await api.createReport({ title: "Boston client workshop", project: "FALCON" });
  const added = await api.addLine(created.report.id, {
    date: "2026-08-20", merchant: "Blue Bottle", category: "meals",
    amount: 12.00, currency: "USD", attendees: 1, description: "Coffee with the client",
  });
  erp.adoptServerReceipts(added.receipts);
  return erp.adoptServerReport(added.report, { open: true, provenance: added.provenance });
}

/**
 * A stubbed page port. It only records that the dialog was mounted; the test's
 * explicit respond() below stands in for the human clicking the rendered DOM.
 */
function stubDialog() {
  const seen = [];
  const finished = [];
  return {
    seen,
    finished,
    available: () => true,
    async present(context) { seen.push(context); return { mounted: true }; },
    finish(result) { finished.push(result); },
  };
}

async function respond({ gate, sid, base, cookie, reportId, decision, reason = null }) {
  const requestId = gate.peekOpenRequestId(reportId, { sessionId: sid });
  const confirmToken = gate.peekConfirmTokenForDialog(requestId, { sessionId: sid });
  const rec = gate.get(requestId, { sessionId: sid });
  const res = await fetch(`${base}/api/sign/${requestId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      schema: "outpocket.sign_respond_request/1",
      request_id: requestId,
      decision,
      reason,
      method: "click",
      acknowledged_digest: rec.snapshot_digest,
      acknowledged_revision: rec.revision,
      confirm_token: confirmToken,
    }),
  });
  assert.equal(res.status, 200, "the stubbed human decision must be accepted");
  return { requestId, body: await res.json() };
}

function textOf(result) {
  return result?.content?.[0]?.text ?? "";
}

function memorySessionStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] ?? null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    entries() { return Array.from(values.entries()); },
  };
}

// ── clause 1: installed exactly once ────────────────────────────────────────

test("the provider is installed EXACTLY ONCE — not zero, and not once per registration", () => {
  resetInstallForTests();
  const calls = [];
  const fakeRegistry = {
    setSignatureProvider(fn) { calls.push(fn); return () => {}; },
    erp,
  };
  const bridge = createSignBridge({ baseUrl: "http://127.0.0.1:1" });
  const dialogPort = { present: async () => ({ mounted: true }) };

  const first = installSignatureProvider({ registry: fakeRegistry, bridge, dialogPort });
  assert.equal(first.installed, true);
  assert.equal(calls.length, 1);

  // A second install — a surface flip, a re-import, a second script tag — must
  // NOT add another. Each one would orphan the previous undo handle.
  const second = installSignatureProvider({ registry: fakeRegistry, bridge, dialogPort });
  assert.equal(second.installed, false);
  assert.equal(second.already, true);
  assert.equal(calls.length, 1, "the provider was installed more than once");
  resetInstallForTests();
});

// ── clause 2: the wire carries a DECISION, not merely a path ────────────────

test("SIGN: the first tool call returns promptly, reuses one ticket, and a later call commits once", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    const sid = cookieToSid(cookie);
    const report = await cleanDraft(base, cookie);
    const realCommit = registry.api.commitReport;
    let commitCalls = 0;
    registry.api.commitReport = (...args) => {
      commitCalls++;
      return realCommit(...args);
    };

    // THE REAL TOOL, NOT THE PROVIDER DIRECTLY. Both calls go through
    // registry.executeTool and therefore through compile.js's double lock,
    // output budget and error path — the same dispatch a real agent's calls
    // take. Calling the provider directly would prove the provider works and
    // say nothing about whether register.js ever reaches it.
    assert.equal(registry.state(), "S2");
    assert.ok(registry.names().includes("submit_expense_report"));

    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });
    const dialog = stubDialog();

    const install = installSignatureProvider({ registry, bridge, dialogPort: dialog, erp });
    assert.equal(install.installed, true);
    try {
      const started = Date.now();
      const first = await registry.executeTool("submit_expense_report", {}, { source: "agent" });
      const elapsed = Date.now() - started;
      const awaiting = JSON.parse(textOf(first));
      assert.ok(elapsed < 2000, `first call suspended for ${elapsed}ms`);
      assert.equal(awaiting.status, "awaiting_signature");
      assert.match(awaiting.ticket, /^tk_[0-9a-f]{32}$/);
      assert.doesNotMatch(textOf(first), /confirm_token|ct_|snapshot|sha256|revision|sg_/i);
      assert.equal(dialog.seen.length, 1, "the dialog must have been consulted exactly once");

      const stillWaiting = JSON.parse(textOf(
        await registry.executeTool("submit_expense_report", {}, { source: "agent" })));
      assert.deepEqual(stillWaiting, awaiting, "a repeat call must reuse the same server record");
      assert.equal(dialog.seen.length, 1, "a repeat call opened a second dialog/sign request");

      await respond({ gate, sid, base, cookie, reportId: report.id, decision: "signed" });
      const completed = await registry.executeTool("submit_expense_report", {}, { source: "agent" });
      assert.match(textOf(completed), /Signed and submitted/i);
      assert.match(textOf(completed), new RegExp(
        `Signed by Chen Xiao via signature click at [^ ]+ \\(server clock\\)\\. ` +
        `Day book #1: signed & submitted ${report.id} — CH-0001\\.`));
      assert.doesNotMatch(textOf(completed), /confirm_token|ct_[0-9a-f]/i);
      assert.equal(commitCalls, 1, "the signed continuation must commit exactly once");
      assert.equal(erp.openReportOrNull()?.status, "submitted");
      assert.ok(erp.openReportOrNull()?.signature, "no signature was recorded on the report");
      assert.equal(dialog.finished.at(-1)?.kind, "committed");
      assert.equal(dialog.finished.at(-1)?.confirmation, "CH-0001");
      assert.equal(dialog.finished.at(-1)?.signedBy, "Chen Xiao");
      assert.equal(dialog.finished.at(-1)?.message, "Submitted. Confirmation CH-0001.");
    } finally {
      install.uninstall?.();
      resetInstallForTests();
    }
  });
});

test("reload rebuilds the provider from sessionStorage, remounts the open review, and commits it", async () => {
  await withRealServer(async ({ base, signGate: gate }) => {
    const previousApi = { ...registry.api };
    const storage = memorySessionStorage();
    let firstInstall = null;
    let reloadedInstall = null;
    resetInstallForTests();
    try {
      const cookie = await login(base);
      const sid = cookieToSid(cookie);
      const report = await cleanDraft(base, cookie);
      const bridgeOptions = { baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } };

      firstInstall = installSignatureProvider({
        registry,
        bridge: createSignBridge(bridgeOptions),
        dialogPort: stubDialog(),
        storage,
      });
      const firstText = textOf(await registry.executeTool("submit_expense_report", {}, { source: "agent" }));
      const awaiting = JSON.parse(firstText);
      const requestId = gate.peekOpenRequestId(report.id, { sessionId: sid });
      assert.match(requestId, /^sg_[0-9a-f]{16}$/);
      assert.doesNotMatch(firstText, /request_id|confirm_token|ct_|sg_/i);

      const saved = storage.entries();
      assert.equal(saved.length, 1);
      assert.ok(saved[0][0].includes(report.id), "the sessionStorage key must name the report");
      assert.deepEqual(JSON.parse(saved[0][1]), {
        reportId: report.id,
        ticket: awaiting.ticket,
        request_id: requestId,
      });

      firstInstall.uninstall?.();
      firstInstall = null;
      resetInstallForTests();

      const reloadedDialog = stubDialog();
      reloadedInstall = installSignatureProvider({
        registry,
        bridge: createSignBridge(bridgeOptions),
        dialogPort: reloadedDialog,
        storage,
      });
      const restored = await reloadedInstall.restoring;
      assert.equal(restored.restored, true);
      assert.equal(reloadedDialog.seen.length, 1, "reload did not remount the open review");
      assert.equal(reloadedDialog.seen[0].opened.requestId, requestId);

      const continuedText = textOf(await registry.executeTool("submit_expense_report", {}, { source: "agent" }));
      assert.deepEqual(JSON.parse(continuedText), awaiting, "reload opened a second sign request instead of continuing");
      assert.doesNotMatch(continuedText, /request_id|confirm_token|ct_|sg_/i);

      await respond({ gate, sid, base, cookie, reportId: report.id, decision: "signed" });
      const completedText = textOf(await registry.executeTool("submit_expense_report", {}, { source: "agent" }));
      assert.match(completedText, /Signed and submitted/i);
      assert.doesNotMatch(completedText, /request_id|confirm_token|ct_[0-9a-f]|sg_[0-9a-f]/i);
      assert.equal(storage.length, 0, "committing must clear the saved continuation");
      assert.equal(gate.chain.list().length, 1, "reload must publish exactly one commit");
    } finally {
      reloadedInstall?.uninstall?.();
      firstInstall?.uninstall?.();
      resetInstallForTests();
      Object.assign(registry.api, previousApi);
    }
  });
});

test("decline, expiry, and a stale saved request clear the report continuation", async () => {
  const opened = {
    requestId: "sg_" + "a".repeat(16),
    ticket: "tk_" + "b".repeat(32),
    confirmToken: "ct_" + "c".repeat(32),
    signRequest: { request_id: "sg_" + "a".repeat(16) },
  };
  const summary = { reportId: "RP-TERMINAL", personaId: "chen", warnings: 0 };
  const terminalContinuations = [
    async () => ({ state: "answered", decision: "declined", reason: "send it back" }),
    async () => {
      const error = new Error("expired");
      error.code = "E_NO_CONFIRM_TOKEN";
      error.status = 403;
      throw error;
    },
  ];

  for (const continueSign of terminalContinuations) {
    const storage = memorySessionStorage();
    const provider = createSignatureProvider({
      bridge: { openForDialog: async () => opened, continueSign },
      dialogPort: stubDialog(),
      storage,
    });
    assert.equal((await provider(summary)).status, "awaiting_signature");
    assert.equal(storage.length, 1);
    await provider(summary);
    assert.equal(storage.length, 0);
  }

  const storage = memorySessionStorage();
  storage.setItem(`outpocket.sign:${summary.reportId}`, JSON.stringify({
    reportId: summary.reportId,
    ticket: opened.ticket,
    request_id: opened.requestId,
  }));
  const staleProvider = createSignatureProvider({
    bridge: {
      openForDialog: async () => opened,
      resumeForDialog: async () => {
        const error = new Error("not found");
        error.code = "E_SIGN_REQUEST_UNKNOWN";
        error.status = 404;
        throw error;
      },
    },
    dialogPort: stubDialog(),
    storage,
  });
  assert.deepEqual(await staleProvider.restoreSaved(), { restored: false });
  assert.equal(storage.length, 0);
});

test("SEND BACK: the second call reads the server decline, does not commit, and restores S2", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    const sid = cookieToSid(cookie);
    const report = await cleanDraft(base, cookie);
    const realCommit = registry.api.commitReport;
    let commitCalls = 0;
    registry.api.commitReport = (...args) => {
      commitCalls++;
      return realCommit(...args);
    };

    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });
    const dialog = stubDialog();
    const install = installSignatureProvider({ registry, bridge, dialogPort: dialog, erp });
    try {
      const first = JSON.parse(textOf(await registry.executeTool("submit_expense_report", {}, { source: "agent" })));
      assert.equal(first.status, "awaiting_signature");

      await respond({
        gate, sid, base, cookie, reportId: report.id, decision: "declined",
        reason: "the meal total looks wrong to me",
      });
      const declined = await registry.executeTool("submit_expense_report", {}, { source: "agent" });
      assert.match(textOf(declined), /sent it back/i);
      assert.match(textOf(declined), /meal total looks wrong/i);
      assert.doesNotMatch(textOf(declined), /confirm_token|ct_[0-9a-f]/i);
      assert.equal(commitCalls, 0, "a declined continuation must not call commit");
      assert.equal(erp.openReportOrNull()?.status, "draft");
      assert.equal(registry.state(), "S2");
      assert.equal(dialog.finished.at(-1)?.kind, "declined");
      assert.match(dialog.finished.at(-1)?.message, /meal total looks wrong/i);
      assert.match(dialog.finished.at(-1)?.message, /The draft remains editable\./);
    } finally {
      install.uninstall?.();
      resetInstallForTests();
    }
  });
});

test("the provider obtains both outcomes from continueSign, never from the dialog port", async () => {
  // Both arms in one test, sharing one provider factory and one bridge
  // construction, so the difference cannot be attributed to anything but the
  // dialog's answer.
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    const sid = cookieToSid(cookie);

    const mk = () => createSignatureProvider({
      bridge: createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } }),
      dialogPort: stubDialog(),
      erp,
    });

    const r1 = await cleanDraft(base, cookie);
    const signedProvider = mk();
    const signedSummary = { reportId: r1.id, personaId: "chen", approver: "Dana Whitfield", lines: [], warnings: 0 };
    assert.equal((await signedProvider(signedSummary)).status, "awaiting_signature");
    await respond({ gate, sid, base, cookie, reportId: r1.id, decision: "signed" });
    const approved = await signedProvider(signedSummary);

    const r2 = await cleanDraft(base, cookie);
    const declinedProvider = mk();
    const declinedSummary = { reportId: r2.id, personaId: "chen", approver: "Dana Whitfield", lines: [], warnings: 0 };
    assert.equal((await declinedProvider(declinedSummary)).status, "awaiting_signature");
    await respond({ gate, sid, base, cookie, reportId: r2.id, decision: "declined", reason: "sending this back" });
    const declined = await declinedProvider(declinedSummary);

    assert.notEqual(approved.signed, declined.signed);
    assert.equal(approved.signed, true);
    assert.equal(declined.signed, false);
    assert.notEqual(approved.reason, declined.reason);
    assert.equal(declined.reason, "sending this back");
    resetInstallForTests();
  });
});

// ── clause 3: the negative control ──────────────────────────────────────────

test("NEGATIVE CONTROL — with NO provider installed, the same submit reaches register.js's safe default", async () => {
  // This is the assertion that makes the two above mean anything. If the wiring
  // is silently removed, submit_expense_report must visibly stop signing — and
  // this test is what fails first. An assertion that something CHANGED is only
  // as strong as the evidence it could have NOT changed.
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    await cleanDraft(base, cookie);

  // ASSERT THE PRECONDITION FIRST. Without this the control passes for the
  // WRONG REASON: my first draft used a string amount, toCents() returned null,
  // the report stayed dirty at S3, and submit_expense_report was not on the
  // surface at all — so "the submit did not complete" was true and had nothing
  // to do with the provider. A negative control that can be satisfied by the
  // tool being absent is not a control.
    assert.equal(registry.state(), "S2", "the fixture must be a CLEAN draft, or this control proves nothing");
    assert.ok(registry.names().includes("submit_expense_report"),
      "submit_expense_report must be ON the surface, or its refusal says nothing about the provider");

  // registry.erp is the same ERP the toolset dispatches against; drive the real
  // tool, through the real double lock, with nothing installed.
    const result = await registry.executeTool("submit_expense_report", {}, { source: "agent" });
    const text = result?.content?.[0]?.text ?? "";

    // The no-dialog refusal no longer borrows the "sent it back" wording (nobody
    // reviewed anything); either phrasing proves the submit did not complete.
    assert.match(text, /could not proceed|sent it back/i,
      "with no provider installed the submit must NOT complete");
    assert.ok(text.includes("nobody to sign"),
      `the refusal must be register.js's safe default, got: ${JSON.stringify(text)}`);
    assert.equal(erp.openReportOrNull()?.status, "draft",
      "the draft must stay editable when nobody signed");
  });
});

// ── the open body ───────────────────────────────────────────────────────────

test("buildOpenBody carries the worst case the dialog prints above the signature line", () => {
  const body = buildOpenBody(
    { reportId: "RP-1018", approver: "Dana Whitfield", lines: [], warnings: 0 });
  assert.equal(body.report_id, "RP-1018");
  assert.ok(body.worst_case && body.worst_case.length > 0, "no worst case for F4 to print");
  assert.ok(body.worst_case.includes("Dana Whitfield"),
    "the consequence must name who approves it — a generic consequence is a ritual");
  assert.deepEqual(Object.keys(body).sort(), ["report_id", "violation_history_count", "worst_case"]);
});

// ── browserDialogPort ───────────────────────────────────────────────────────
//
// THE ROOT CAUSE OF D-89's DEFECT WAS THAT THIS FUNCTION HAD NO TEST.
// Every test above stubs the dialog port, which is what made the node testable
// — and is exactly why the DEFAULT port, the one the live page actually uses,
// went unexercised. It read request_id, snapshot_digest and confirm_token off
// beginSign()'s frozen {status, ticket}, got undefined for all three, and `??
// null` / `?? ""` turned that into a dialog with no identity whose click POSTed
// to /api/sign/null/respond. The injectable seam bought testability for the
// wiring and hid the wiring that shipped.
//
// So the real port is driven here against a fake document and a fake dialog:
// not evidence about a browser, but evidence that the port passes the SERVER'S
// values through instead of inventing them.

import { browserDialogPort } from "../../src/page/sign-install.js";

function fakeEl() {
  const listeners = new Map();
  return {
    querySelector: () => null,
    addEventListener: (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); },
    fire: (t) => (listeners.get(t) ?? []).forEach((fn) => fn()),
    listeners,
  };
}

test("browserDialogPort passes the SERVER's sign_request and confirm_token to the dialog", async () => {
  const seen = [];
  const root = { querySelector: () => null };
  const signDialog = { mountSignDialog: (args) => { seen.push(args); return root; } };

  const port = browserDialogPort({ doc: {}, signDialog });
  const opened = {
    requestId: "sg_" + "a".repeat(16),
    ticket: "tk_" + "b".repeat(32),
    confirmToken: "ct_" + "c".repeat(32),
    signRequest: {
      request_id: "sg_" + "a".repeat(16), report_id: "RP-1018", revision: 4,
      snapshot_digest: "sha256:" + "d".repeat(64), worst_case: "a stated consequence.",
      snapshot: { report: { id: "RP-1018", lines: [] } },
    },
  };

  const presented = await port.present({ opened });

  assert.equal(presented.mounted, true);
  assert.equal(seen.length, 1, "the dialog was not mounted");
  const args = seen[0];

  // THE THREE FIELDS THAT WERE null/"" BEFORE, each asserted to be the
  // server's value rather than merely present.
  assert.equal(args.signRequest.request_id, opened.signRequest.request_id,
    "the dialog was given no request_id — a click would POST to /api/sign/null/respond");
  assert.equal(args.signRequest.snapshot_digest, opened.signRequest.snapshot_digest,
    "the dialog would acknowledge a digest the server never issued");
  assert.equal(args.confirmToken, opened.confirmToken,
    "the dialog was given no confirm_token, so /respond would answer 403");

  // and it is the server's record WHOLE, not one reassembled here
  assert.equal(args.signRequest, opened.signRequest,
    "the port rebuilt the sign_request instead of passing the server's own");
});

test("browserDialogPort refuses rather than mounting a dialog with no identity", async () => {
  // The failure mode this replaces was SILENT: an unidentified dialog rendered
  // happily and only failed at POST time, on a real click, in front of a judge.
  const signDialog = { mountSignDialog: () => { throw new Error("must not be mounted"); } };
  const port = browserDialogPort({ doc: {}, signDialog });

  for (const opened of [undefined, {}, { signRequest: {} }, { signRequest: { request_id: "" } }]) {
    const r = await port.present({ opened });
    assert.equal(r.mounted, false);
    assert.match(r.reason, /could not be opened|nobody to sign/,
      `an unopened sign request must be refused with a reason, got ${JSON.stringify(r)}`);
  }
});

test("concurrent first calls share one open operation and one awaiting ticket", async () => {
  let releaseOpen;
  let openCalls = 0;
  const opened = {
    requestId: "sg_" + "a".repeat(16),
    ticket: "tk_" + "b".repeat(32),
    confirmToken: "ct_" + "c".repeat(32),
    signRequest: { request_id: "sg_" + "a".repeat(16) },
  };
  const bridge = {
    openForDialog: async () => {
      openCalls++;
      await new Promise((resolve) => { releaseOpen = resolve; });
      return opened;
    },
    continueSign: async () => ({ status: "awaiting_signature", ticket: opened.ticket }),
  };
  const dialog = stubDialog();
  const provider = createSignatureProvider({ bridge, dialogPort: dialog });
  const summary = { reportId: "RP-1018", personaId: "chen", warnings: 0 };

  const first = provider(summary);
  const second = provider(summary);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(openCalls, 1);
  releaseOpen();

  assert.deepEqual(await first, await second);
  assert.equal(dialog.seen.length, 1);
});

test("a signed continuation grants one commit claim until settle releases or completes it", async () => {
  const opened = {
    requestId: "sg_" + "a".repeat(16),
    ticket: "tk_" + "b".repeat(32),
    confirmToken: "ct_" + "c".repeat(32),
    signRequest: { request_id: "sg_" + "a".repeat(16) },
  };
  const bridge = {
    openForDialog: async () => opened,
    continueSign: async () => ({ state: "answered", decision: "signed" }),
  };
  const dialog = stubDialog();
  const provider = createSignatureProvider({ bridge, dialogPort: dialog });
  const summary = { reportId: "RP-1018", personaId: "chen", warnings: 0 };

  assert.equal((await provider(summary)).status, "awaiting_signature");
  const claimed = await provider(summary);
  assert.equal(claimed.signed, true);
  assert.equal((await provider(summary)).status, "submission_in_progress");
  claimed.settle({ status: "retryable" });
  const reclaimed = await provider(summary);
  assert.equal(reclaimed.signed, true);
  reclaimed.settle({
    status: "committed",
    confirmation: "CH-0001",
    signedBy: "Chen Xiao",
    message: "Submitted. Confirmation CH-0001.",
  });
  assert.deepEqual(dialog.finished.at(-1), {
    kind: "committed",
    confirmation: "CH-0001",
    signedBy: "Chen Xiao",
    message: "Submitted. Confirmation CH-0001.",
  });
});

test("createSignatureProvider REFUSES a bridge without openForDialog, rather than falling back", () => {
  // The kind fallback would silently restore the broken path. A startup error
  // naming the reason is the honest failure.
  assert.throws(
    () => createSignatureProvider({
      bridge: { beginSign: async () => ({}), continueSign: async () => ({}) },
      dialogPort: { present: async () => ({ approved: false }) },
    }),
    /openForDialog/,
    "a bridge with only the tool-facing calls must be refused");
});
