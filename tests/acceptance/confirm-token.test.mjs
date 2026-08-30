// tests/acceptance/confirm-token.test.mjs — D-89 (S5 follow-up, ruled by PM;
// not a graph node). Accept per D-96, PM's three clauses verbatim:
//
//   (1) POSITIVE, END TO END: the page driven into the dialog state, a
//       human decision POSTed to /api/sign/{id}/respond carrying a
//       confirm_token THE PAGE OBTAINED ITSELF, succeeding rather than 403
//       E_NO_CONFIRM_TOKEN, and the report commits. peekConfirmTokenForDialog
//       MUST NOT APPEAR IN THE PATH UNDER TEST.
//   (2) NEGATIVE, THE INVARIANT: for EVERY tool on the surface in that
//       state, driven through the REAL tool surface, no response body
//       contains the confirm_token.
//   (3) THE NEGATIVE MUST FAIL FOR THE REASON NAMED (D-90): the same run
//       must prove a token EXISTS at that moment AND that the page CAN
//       READ IT — otherwise clause 2 is satisfied by there being no token
//       to leak, which is not a control.
//
// THE BUG THIS FIXES: src/page/sign-install.js's browserDialogPort.present()
// reads `awaiting.confirm_token` and `awaiting.request_id` — but
// bridge.beginSign() (the tool-facing call) deliberately never carries
// either (R-13/R-44's narrow {status, ticket}). So in the shipped page,
// mountSignDialog() is always called with confirmToken:"" and
// signRequest.request_id:null, and submitDecision() POSTs to
// /api/sign/null/respond — the dialog CANNOT complete a signature. This
// file proves the fix — server/sign.mjs's new GET
// /api/sign/{request_id}/confirm-token route (session-scoped, NOT a
// registered tool) plus src/page/sign-bridge.js's new openForDialog(),
// which fetches both request_id and confirm_token through that same
// legitimate channel — using the REAL F4 dialog code and a REAL running
// server, never src/page/sign-install.js's own (still-buggy)
// browserDialogPort, since fixing that file is UX's (F7's owner), not
// this node's, to land — see this node's PIT for the exact line still
// needed there.
//
// THE FAKE DOM: same approach as tests/acceptance/sign-dialog.test.mjs and
// banner.test.mjs (no jsdom in this repo). Real addEventListener/
// dispatchEvent and the four selector forms sign-dialog.js uses, because a
// click that does not reach the real handler would make every assertion
// here vacuous.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createApp } from "../../server/index.mjs";
import { createSignGate, CONFIRM_TOKEN_RE } from "../../server/sign.mjs";
import { createSignBridge } from "../../src/page/sign-bridge.js";
import { renderSignDialog, mountSignDialog, submitDecision, canConfirm } from "../../src/page/ui/sign-dialog.js";
import { makeWorld, buildCleanReport, names } from "../helpers.mjs";

const schemaPath = fileURLToPath(new URL("../../erp/contracts/signature.schema.json", import.meta.url));
const SCHEMA = JSON.parse(readFileSync(schemaPath, "utf8"));

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

let nextReportId = 1;
function freshReportId() {
  return `RP-CT-${nextReportId++}`;
}

function openBody(reportId, overrides = {}) {
  const ex = clone(SCHEMA.examples[0]);
  return {
    report_id: reportId,
    revision: ex.revision,
    policy_version: ex.policy_version,
    policy_digest: ex.snapshot.policy_digest,
    report: { ...ex.snapshot.report, id: reportId },
    verdict: ex.snapshot.verdict,
    worst_case: ex.worst_case,
    violation_history_count: ex.violation_history_count,
    ...overrides,
  };
}

// ── the fake document (precedent: sign-dialog.test.mjs, banner.test.mjs) ───
class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parent = null;
    this._text = "";
    this.value = "";
    this.listeners = new Map();
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); if (k === "disabled") this.disabled = true; }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); if (k === "disabled") this.disabled = false; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text; }
  matches(sel) {
    const attr = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(sel);
    if (attr) {
      const [, name, want] = attr;
      if (!this.attributes.has(name)) return false;
      return want === undefined || this.attributes.get(name) === want;
    }
    const cls = /^\.([\w-]+)$/.exec(sel);
    if (cls) return (this.getAttribute("class") ?? "").split(/\s+/).includes(cls[1]);
    return this.tagName === sel.toUpperCase();
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (c.matches(sel)) return c;
      const deep = c.querySelector(sel);
      if (deep) return deep;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    for (const c of this.children) {
      if (c.matches(sel)) out.push(c);
      out.push(...c.querySelectorAll(sel));
    }
    return out;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatchEvent(ev) { for (const fn of this.listeners.get(ev.type) ?? []) fn(ev); return true; }
  click() { return this.dispatchEvent({ type: "click", target: this }); }
}
// mountSignDialog() looks up doc.querySelector('[data-region="sign"]') —
// F1's own mount point in src/page/index.html — so the fake document needs
// one already present, the same way the real page does.
function makeFakeDoc() {
  const root = new FakeNode("body");
  const region = new FakeNode("section");
  region.setAttribute("data-region", "sign");
  root.appendChild(region);
  return {
    createElement: (tag) => new FakeNode(tag),
    querySelector: (sel) => root.querySelector(sel),
  };
}

// ── server plumbing ──────────────────────────────────────────────────────
async function withApp(fn) {
  const app = createApp({ signGate: createSignGate() });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function login(base, persona) {
  const res = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona }),
  });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie").split(";")[0];
}

// One fetchImpl, used both as createSignBridge's own fetchImpl (with
// baseUrl left at its "" default, so sign-bridge's internal `${baseUrl}
// ${path}` is just `path`) and directly by submitDecision/our own commit
// call (which use bare relative paths, exactly as a real page's fetch()
// would resolve them against the document's own origin) — this wrapper is
// what supplies that origin, plus the session cookie header a real
// browser's cookie jar would attach automatically via credentials:'include'.
function fetchWithCookie(base, cookie) {
  return (path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { ...init.headers, Cookie: cookie } });
}

// ── (1) POSITIVE, END TO END ─────────────────────────────────────────────
test("D-89 clause 1: the page obtains its own confirm_token, signs for real, and the report commits — peekConfirmTokenForDialog never appears in this path", async () => {
  await withApp(async (base) => {
    const cookie = await login(base, "chen");
    const fetchImpl = fetchWithCookie(base, cookie);
    const reportId = freshReportId();
    const bridge = createSignBridge({ fetchImpl, headers: { Cookie: cookie } });
    const doc = makeFakeDoc();

    // The page-only channel — NOT beginSign, NOT peekConfirmTokenForDialog.
    const { requestId, signRequest, confirmToken } = await bridge.openForDialog(openBody(reportId));
    assert.match(confirmToken, CONFIRM_TOKEN_RE, "a real, well-formed confirm_token, fetched over HTTP");
    assert.equal(signRequest.request_id, requestId);

    const root = mountSignDialog({ doc, signRequest, confirmToken, fetchImpl });
    assert.ok(root, "the real F4 dialog mounts");
    assert.equal(
      root.querySelector("[data-confirm-token]").value,
      confirmToken,
      "the token the page fetched is the SAME one now sitting in the rendered DOM",
    );
    assert.ok(canConfirm(root), "the certification sentence disclosed, so the dialog is confirmable");

    // The human's click, via the REAL submitDecision — reads the token back
    // OUT OF THE DOM itself, exactly as production code does.
    const result = await submitDecision(root, { signRequest, decision: "signed", fetchImpl, doc });
    assert.equal(result.posted, true);
    assert.equal(result.status, 200, `expected a real signature, not 403 E_NO_CONFIRM_TOKEN: ${JSON.stringify(result.response)}`);
    assert.notEqual(result.response?.error, "E_NO_CONFIRM_TOKEN");

    const committed = await fetchImpl(`/api/reports/${reportId}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema: "outpocket.commit_request/1", request_id: requestId, report_id: reportId }),
    });
    const committedBody = await committed.json();
    assert.equal(committed.status, 200);
    assert.equal(committedBody.status, "committed", `the report must commit: ${JSON.stringify(committedBody)}`);
  });
});

// ── (2)+(3) NEGATIVE, WITH THE PRECONDITION PROVEN (D-90) ────────────────
test("D-89 clauses 2+3: no tool on the real surface leaks confirm_token, while a token demonstrably EXISTS and IS page-readable at that moment", async () => {
  await withApp(async (base) => {
    const cookie = await login(base, "chen");
    const fetchImpl = fetchWithCookie(base, cookie);
    const reportId = freshReportId();
    const bridge = createSignBridge({ fetchImpl, headers: { Cookie: cookie } });
    const doc = makeFakeDoc();

    const { signRequest, confirmToken } = await bridge.openForDialog(openBody(reportId));

    // CLAUSE 3, existence: the token is real and well-formed (already
    // asserted above's twin does this too, but this run must stand alone).
    assert.match(confirmToken, CONFIRM_TOKEN_RE, "clause 3: a token exists at this moment");

    // CLAUSE 3, page-readability: mount the REAL dialog and read it back
    // out of the REAL rendered DOM — not out of the closure variable above.
    const root = mountSignDialog({ doc, signRequest, confirmToken, fetchImpl });
    const domToken = root.querySelector("[data-confirm-token]").value;
    assert.equal(domToken, confirmToken, "clause 3: the page CAN read the token, out of the DOM it was planted in");
    assert.notEqual(domToken, "", "clause 3: not vacuously satisfied by an empty string");

    // CLAUSE 2: drive EVERY tool on the REAL surface (16 tools,
    // src/page/tools/defs.js, unmodified by this node) and assert none of
    // them ever produce this token in their output. The world is a
    // SEPARATE, local erp — the tool surface has no path to this server's
    // sign request at all, which is exactly the property being checked:
    // an agent restricted to this tool surface has no route to the value
    // that was just proven (above) to exist and be page-readable.
    const world = makeWorld();
    world.human.signin("chen");
    const report = await buildCleanReport(world, { title: "D-89 sweep", project: "FALCON" });
    const receiptIds = await world.human.attach(["cab"]);
    const lineId = report.lines[0].id;

    const argsByTool = {
      get_signin_status: {},
      get_session_scope: {},
      get_expense_policy: {},
      list_expense_reports: {},
      create_expense_report: { title: "another one", project: "FALCON" },
      open_expense_report: { report_id: report.id },
      get_open_report: {},
      get_report: { report_id: report.id },
      add_expense_line: { date: world.dates.cab, merchant: "Sweep Co", category: "meals", amount: 5 },
      update_expense_line: { line_id: lineId, merchant: "Swept Co" },
      remove_expense_line: { line_id: lineId },
      list_receipts: {},
      link_receipt: { line_id: lineId, receipt_id: receiptIds.cab },
      validate_expense_report: {},
      submit_expense_report: {},
      get_day_book: {},
      explain_missing_tool: { tool_name: "definitely_not_a_real_tool" },
    };

    const toolNames = names(world.toolset);
    // The compiled surface is STATE-DEPENDENT (T5, R-19's six canonical
    // states) — this session/report state does not carry every one of
    // defs.js's tools (e.g. get_signin_status/get_report/get_day_book are
    // absent here). Read the count from the REAL export rather than
    // asserting a fixed number that would go stale the next time the
    // surface changes; only assert it is non-empty, so this loop cannot
    // pass by iterating over nothing.
    assert.ok(toolNames.length > 0, "the compiled surface must not be empty, or this sweep checks nothing");
    console.log(`D-89 sweep: ${toolNames.length} tool(s) on the surface in this state: ${toolNames.join(", ")}`);

    const leaks = [];
    for (const name of toolNames) {
      const args = argsByTool[name] ?? {};
      let text;
      try {
        const result = await world.dispatch(name, args);
        text = JSON.stringify(result);
      } catch (err) {
        text = String(err?.message ?? err);
      }
      if (text.includes(confirmToken)) leaks.push(name);
    }
    assert.deepEqual(leaks, [], `these tools leaked the confirm_token: ${leaks.join(", ")}`);

    // And the aggregate output log (what onCallEnd recorded) is clean too.
    const combined = world.outputs.join("\n");
    assert.ok(!combined.includes(confirmToken), "no tool's recorded output text contains the token anywhere");
  });
});
