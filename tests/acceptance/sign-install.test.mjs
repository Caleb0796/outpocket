// tests/acceptance/sign-install.test.mjs — node F7 (lane F, owner UX).
//
// F7 is the GLUE: register.js exposes setSignatureProvider, F4's dialog is
// DOM-only, S5's bridge is DOM-free, and nothing joined them. Three modules
// each scoped correctly; the seam belonged to no node.
//
// WHAT THIS FILE IS CAREFUL ABOUT. A test that shows the provider was INSTALLED
// proves a path exists and says nothing about whether the human's decision is
// consulted — PRESENT IS NOT USEFUL. So the dialog is stubbed twice, to APPROVE
// and to DECLINE, against the SAME wire, and the two outcomes must differ by a
// named reason. And there is a negative control: with the provider not
// installed, the same submit must fall back to register.js's safe default, so
// that the passing cases are attributable to the wiring rather than to anything
// that would have happened anyway.
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
import { registry } from "../../src/page/register.js";
import {
  installSignatureProvider, createSignatureProvider, buildOpenBody,
  resetInstallForTests, REASONS,
} from "../../src/page/sign-install.js";

const erp = registry.erp;

async function withApp(signGate, fn) {
  const app = createApp({ signGate });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
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

/** Drive the real ERP to a CLEAN open draft, so submit_expense_report exists. */
function cleanDraft() {
  erp.signIn("chen");
  const report = erp.createReport({ title: "Boston client workshop", project: "FALCON" }, "human");
  erp.openReport(report.id, "human");
  erp.addLine({
    date: "2026-08-20", merchant: "Blue Bottle", category: "meals",
    amount: 12.00, currency: "USD", attendees: 1, description: "Coffee with the client",
  }, "human");
  return report;
}

/**
 * A stubbed dialog. On approve it does what F4's dialog does in the page: POST
 * the decision to /api/sign/{id}/respond. It reads request_id and confirm_token
 * through server/sign.mjs's peekOpenRequestId / peekConfirmTokenForDialog,
 * which that file documents as THE TEST-ONLY STAND-IN for reading the rendered
 * dialog's DOM. Nothing here invents a second delivery channel.
 */
function stubDialog({ approve, gate, sid, base, cookie, reportId, reason = null }) {
  const seen = [];
  return {
    seen,
    async present(context) {
      seen.push(context);
      if (!approve) return { approved: false, reason: reason ?? REASONS.DECLINED };

      const requestId = gate.peekOpenRequestId(reportId, { sessionId: sid });
      const confirmToken = gate.peekConfirmTokenForDialog(requestId, { sessionId: sid });
      const rec = gate.get(requestId, { sessionId: sid });

      const res = await fetch(`${base}/api/sign/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          schema: "outpocket.sign_respond_request/1",
          request_id: requestId,
          decision: "signed",
          reason: null,
          method: "click",
          acknowledged_digest: rec.snapshot_digest,
          acknowledged_revision: rec.revision,
          confirm_token: confirmToken,
        }),
      });
      assert.equal(res.status, 200, "the stubbed dialog's respond must be accepted");
      return { approved: true };
    },
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
  const dialogPort = { present: async () => ({ approved: false }) };

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

test("APPROVE: an agent's submit_expense_report completes, and the result carries S5's ticket", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    const sid = cookieToSid(cookie);
    const report = cleanDraft();

    // THE REAL TOOL, NOT THE PROVIDER DIRECTLY. The accept says an
    // AGENT-INITIATED submit_expense_report completes, so this goes through
    // registry.executeTool and therefore through compile.js's double lock,
    // output budget and error path — the same dispatch a real agent's call
    // takes. Calling the provider directly would prove the provider works and
    // say nothing about whether register.js ever reaches it.
    assert.equal(registry.state(), "S3");
    assert.ok(registry.names().includes("submit_expense_report"));

    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });
    const dialog = stubDialog({ approve: true, gate, sid, base, cookie, reportId: report.id });

    const install = installSignatureProvider({ registry, bridge, dialogPort: dialog, erp });
    assert.equal(install.installed, true);
    try {
      const result = await registry.executeTool("submit_expense_report", {}, { source: "agent" });
      const text = result?.content?.[0]?.text ?? "";

      assert.match(text, /Signed and submitted/i,
        `the agent's submit must complete once the human approved, got: ${JSON.stringify(text)}`);
      assert.equal(dialog.seen.length, 1, "the dialog must have been consulted exactly once");

      // the ticket from S5's continueSign reached the provider's result
      const ctx = dialog.seen[0];
      assert.match(ctx.awaiting.ticket, /^tk_[0-9a-f]{32}$/, "S5's ticket did not reach the dialog");

      // and the server recorded the human step
      // the report actually left draft — the submit was performed, not merely
      // reported. (openReportOrNull() still returns the report after a submit;
      // it is the STATUS that moves, which is why this asserts on status.)
      assert.notEqual(erp.openReportOrNull()?.status, "draft",
        "the report is still a draft, so nothing was actually submitted");
      assert.ok(erp.openReportOrNull()?.signature, "no signature was recorded on the report");
    } finally {
      install.uninstall?.();
      resetInstallForTests();
    }
  });
});

test("DECLINE: the SAME wire refuses, and the two outcomes differ by a NAMED reason", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    const report = cleanDraft();

    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });
    const dialog = stubDialog({ approve: false, gate, base, cookie, reportId: report.id,
      reason: "the meal total looks wrong to me" });

    const provider = createSignatureProvider({ bridge, dialogPort: dialog, erp });
    const decision = await provider({
      reportId: report.id, title: report.title, project: report.project,
      totalUsd: "12.00", warnings: 0, approver: "Dana Whitfield", lines: [],
    });

    assert.equal(decision.signed, false, "a declined dialog must not produce a signature");
    assert.equal(decision.reason, "the meal total looks wrong to me",
      "the refusal must carry the human's own named reason, not a generic one");
    assert.equal(dialog.seen.length, 1, "the dialog must be consulted on the decline path too");
    resetInstallForTests();
  });
});

test("the two outcomes are produced by the SAME wire and DIFFER — present is not useful", async () => {
  // Both arms in one test, sharing one provider factory and one bridge
  // construction, so the difference cannot be attributed to anything but the
  // dialog's answer.
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    resetInstallForTests();
    const cookie = await login(base);
    const sid = cookieToSid(cookie);

    const mk = (approve, reportId, reason) => createSignatureProvider({
      bridge: createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } }),
      dialogPort: stubDialog({ approve, gate, sid, base, cookie, reportId, reason }),
      erp,
    });

    const r1 = cleanDraft();
    const approved = await mk(true, r1.id)({ reportId: r1.id, approver: "Dana Whitfield", lines: [], warnings: 0 });

    const r2 = cleanDraft();
    const declined = await mk(false, r2.id, "sending this back")({ reportId: r2.id, approver: "Dana Whitfield", lines: [], warnings: 0 });

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
  resetInstallForTests();
  const report = cleanDraft();

  // ASSERT THE PRECONDITION FIRST. Without this the control passes for the
  // WRONG REASON: my first draft used a string amount, toCents() returned null,
  // the report stayed dirty at S2, and submit_expense_report was not on the
  // surface at all — so "the submit did not complete" was true and had nothing
  // to do with the provider. A negative control that can be satisfied by the
  // tool being absent is not a control.
  assert.equal(registry.state(), "S3", "the fixture must be a CLEAN draft, or this control proves nothing");
  assert.ok(registry.names().includes("submit_expense_report"),
    "submit_expense_report must be ON the surface, or its refusal says nothing about the provider");

  // registry.erp is the same ERP the toolset dispatches against; drive the real
  // tool, through the real double lock, with nothing installed.
  const result = await registry.executeTool("submit_expense_report", {}, { source: "agent" });
  const text = result?.content?.[0]?.text ?? "";

  assert.match(text, /sent it back/i,
    "with no provider installed the submit must NOT complete");
  assert.ok(text.includes("nobody to sign"),
    `the refusal must be register.js's safe default, got: ${JSON.stringify(text)}`);
  assert.equal(erp.openReportOrNull()?.status, "draft",
    "the draft must stay editable when nobody signed");
});

// ── the open body ───────────────────────────────────────────────────────────

test("buildOpenBody carries the worst case the dialog prints above the signature line", () => {
  const body = buildOpenBody(
    { reportId: "RP-1018", approver: "Dana Whitfield", lines: [], warnings: 0 },
    { erp: null, policy: { version: "2026.08.1", digest: "sha256:x" } });
  assert.equal(body.report_id, "RP-1018");
  assert.ok(body.worst_case && body.worst_case.length > 0, "no worst case for F4 to print");
  assert.ok(body.worst_case.includes("Dana Whitfield"),
    "the consequence must name who approves it — a generic consequence is a ritual");
  assert.equal(body.policy_version, "2026.08.1");
});
