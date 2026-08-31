import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { makeWorld, names, buildCleanReport } from "./helpers.mjs";
import { createErp } from "../src/erp.js";
import { createToolset, DESC_BUDGET, OUTPUT_BUDGET } from "../src/tools.js";
import { digest } from "../src/canonical.js";

function makeApiWorld({ requestSignature, fetchImpl }) {
  const now = () => new Date(2026, 7, 28, 10, 0, 0);
  const erp = createErp({ now });
  const toolset = createToolset(erp, { requestSignature, fetchImpl });
  return {
    erp,
    toolset,
    dates: { cab: "2026-08-20" },
    dispatch: (name, args, opts = {}) => toolset.call(name, args, { source: "test", ...opts }),
  };
}

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test("signed out: the surface is the explainer plus the absence register", () => {
  const w = makeWorld();
  assert.deepEqual(names(w.toolset), ["get_signin_status", "explain_missing_tool"]);
});

test("employee surface grows with state: 6 → 14 (door) → shrinks to 13 when dirty", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  assert.equal(names(w.toolset).length, 6);
  assert.ok(!names(w.toolset).includes("add_expense_line"));

  await buildCleanReport(w);
  const n = names(w.toolset);
  assert.equal(n.length, 14, `expected the clean-draft surface, got: ${n.join(",")}`);
  assert.ok(n.includes("submit_expense_report"), "door open when clean");

  // dirty it → the door closes
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  assert.ok(!names(w.toolset).includes("submit_expense_report"), "door closes when a blocking violation appears");
  assert.equal(names(w.toolset).length, 13);
});

test("auditor surface: read-only by construction", async () => {
  const w = makeWorld();
  w.erp.signIn("ruiz", "human");
  const n = names(w.toolset);
  assert.deepEqual(n.sort(), ["explain_missing_tool", "get_day_book", "get_expense_policy", "get_open_report", "get_report", "get_session_scope", "list_expense_reports"].sort());
  for (const d of w.toolset.surface()) assert.equal(d.annotations?.readOnlyHint, true, `${d.name} must be readOnly`);

  // Constructive, not a hint we ask a model to believe: run every tool the
  // auditor actually has and prove none of them moved the page or the log.
  // open_expense_report is off this surface precisely because it fails that —
  // it sets openReportId and appends to the day book (R-9 option (B)).
  const someReport = w.erp.listReports()[0].id;
  const before = { open: w.erp.state.openReportId, book: w.erp.state.dayBook.length };
  for (const name of n) {
    const res = await w.dispatch(name, { report_id: someReport });
    assert.ok(res.content[0].text.length > 0, `${name} returned nothing`);
  }
  const got = await w.dispatch("get_report", { report_id: someReport });
  assert.match(got.content[0].text, new RegExp(someReport), "get_report must read the report it was asked for");
  assert.equal(w.erp.state.openReportId, before.open, "no auditor tool may move the open report");
  assert.equal(w.erp.state.dayBook.length, before.book, "no auditor tool may append to the day book");
});

test("submitted reports expose no editing tools", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  w.erp.openReport("RP-1017", "test"); // seeded, already submitted
  const n = names(w.toolset);
  assert.ok(n.includes("get_open_report"));
  for (const gone of ["add_expense_line", "update_expense_line", "remove_expense_line", "link_receipt", "submit_expense_report"])
    assert.ok(!n.includes(gone), `${gone} must not exist on a submitted report`);
});

test("descriptions fit the official 500-char budget in every state", async () => {
  const w = makeWorld();
  const check = () => {
    for (const d of w.toolset.surface()) {
      assert.ok(d.description.length <= DESC_BUDGET, `${d.name} description is ${d.description.length} chars`);
      assert.match(d.name, /^[a-z][a-z_]*$/);
      assert.ok(d.inputSchema?.type === "object");
    }
  };
  check();
  w.erp.signIn("chen", "human");
  check();
  await buildCleanReport(w);
  check();
  w.erp.signOut("human");
  w.erp.signIn("ruiz", "human");
  check();
});

test("double lock: a captured submit tool refuses after the surface moved on", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  await buildCleanReport(w);
  const submit = w.toolset.surface().find((d) => d.name === "submit_expense_report");
  assert.ok(submit);
  // report goes dirty AFTER capture — the old handle must not submit
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  const res = await w.toolset.runTool(submit, {}, {}, "test");
  assert.match(res.content[0].text, /no longer on the surface/);
  assert.equal(w.erp.openReportOrNull().status, "draft");
});

test("calling an unregistered tool names the real surface", async () => {
  const w = makeWorld();
  const res = await w.dispatch("submit_expense_report", {});
  assert.match(res.content[0].text, /No tool named/);
  assert.match(res.content[0].text, /get_signin_status/);
});

test("auditor writes are impossible twice over: no tool AND a 403 underneath", async () => {
  const w = makeWorld();
  w.erp.signIn("ruiz", "human");
  const res = await w.dispatch("create_expense_report", { title: "x", project: "FALCON" });
  assert.match(res.content[0].text, /No tool named/); // surface lock
  assert.throws(() => w.erp.createReport({ title: "x", project: "FALCON" }, "test"), /403/); // session lock
});

test("every tool output in a busy session respects the 1500-char budget", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  w.erp.createReport({ title: "Messy report with a very long title that keeps going on and on", project: "FALCON" }, "test");
  for (let i = 0; i < 12; i++) {
    w.erp.addLine({
      date: "2026-04-01", merchant: `Grand Continental Palace Hotel & Convention Resort ${i}`, category: "lodging",
      amount: 900 + i, nights: 1, currency: "EUR",
      itemization: [{ label: "Champagne welcome package deluxe", amount: 200 }, { label: "Room and extended incidentals bundle", amount: 700 + i }],
      description: "An unnecessarily long description of the stay to stress the output budget of the tools",
    }, "test");
  }
  for (const name of ["validate_expense_report", "get_open_report", "list_expense_reports", "get_expense_policy", "get_session_scope", "list_receipts"])
    await w.dispatch(name, {});
  for (const text of w.outputs)
    assert.ok(text.length <= OUTPUT_BUDGET, `output of ${text.slice(0, 40)}… is ${text.length} chars`);
});

test("submit commits the signed request on the server and renders only server confirmation and provenance", async () => {
  const requestId = "sg_0123456789abcdef";
  const chainHead = `sha256:${"a".repeat(64)}`;
  const commitResult = {
    schema: "outpocket.commit_result/1",
    status: "committed",
    http_status: 200,
    confirmation: "CH-9007",
    committed_revision: 41,
    chain_entry: { at: "2026-08-28T17:01:02.000Z", actor: "Chen Xiao" },
    artifact: {
      policy_version: "server-policy-7",
      chain_head: chainHead,
      provenance_summary: { agent_fields: 7, human_fields: 3, seed_fields: 1, total_fields: 11 },
    },
  };
  const calls = [];
  const w = makeApiWorld({
    requestSignature: async () => ({ signed: true, request_id: requestId }),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, commitResult);
    },
  });
  w.erp.signIn("chen", "human");
  await buildCleanReport(w, { title: "Client-authored title" });
  const reportId = w.erp.openReportOrNull().id;
  const localBookLength = w.erp.state.dayBook.length;

  const response = await w.dispatch("submit_expense_report", {});
  const text = response.content[0].text;

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/api/reports/${reportId}/commit`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "include");
  assert.deepEqual(JSON.parse(calls[0].init.body), { report_id: reportId, request_id: requestId });
  assert.match(text, /Confirmation CH-9007/);
  assert.match(text, /server revision 41/);
  assert.match(text, /7\/11 field\(s\) filled via agent tools/);
  assert.match(text, /3 human-filled, 1 seeded/);
  assert.match(text, new RegExp(chainHead));
  assert.doesNotMatch(text, /CH-0001/, "a local confirmation would hide whether the server result was used");
  assert.equal(w.erp.openReportOrNull().status, "submitted", "the page cache must follow the successful server commit");
  assert.equal(w.erp.openReportOrNull().artifact, commitResult.artifact);
  assert.equal(w.erp.state.dayBook.length, localBookLength, "the cache update must not append a second client-only commit event");
});

test("submit turns 422, 409 and 423 commit refusals into agent-readable text and leaves the draft open", async (t) => {
  const cases = [
    { status: 422, code: "E_NOT_CLEAN", message: "the server found a blocking meal cap", phrase: /rechecked the report/ },
    { status: 409, code: "E_SNAPSHOT_MISMATCH", message: "the signed snapshot is stale", phrase: /signed snapshot no longer matches/ },
    { status: 423, code: "E_SIGN_IN_PROGRESS", message: "another sign request holds the report", phrase: /locked by a signing operation/ },
  ];

  for (const row of cases) {
    await t.test(`${row.status} ${row.code}`, async () => {
      const w = makeApiWorld({
        requestSignature: async () => ({ signed: true, request_id: "sg_0123456789abcdef" }),
        fetchImpl: async () => jsonResponse(row.status, { error: row.code, message: row.message }),
      });
      w.erp.signIn("chen", "human");
      await buildCleanReport(w);

      const response = await w.dispatch("submit_expense_report", {});
      const text = response.content[0].text;

      assert.match(text, new RegExp(row.code));
      assert.match(text, new RegExp(row.message));
      assert.match(text, row.phrase);
      assert.doesNotMatch(text, /^Error:/, "a server refusal is a workflow result, not an uncaught tool error");
      assert.equal(w.erp.openReportOrNull().status, "draft");
    });
  }
});

test("get_day_book reads and renders the server SHA-256 chain with its verification result", async () => {
  const prev = `sha256:${"0".repeat(64)}`;
  const entryDigest = `sha256:${"b".repeat(64)}`;
  const head = `sha256:${"c".repeat(64)}`;
  const calls = [];
  const w = makeApiWorld({
    requestSignature: async () => ({ signed: false }),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {
        entries: [{
          seq: 1,
          at: "2026-08-28T17:03:04.000Z",
          kind: "commit",
          source: "human",
          actor: "Chen Xiao",
          label: "employee-authored day-book label",
          detail: "CH-9007",
          prev,
          entry_digest: entryDigest,
        }],
        head,
        verification: { ok: true, brokenAtIndex: null, reason: null },
      });
    },
  });
  w.erp.signIn("ruiz", "human");
  w.erp.log("tool", "agent", "local-only label that must not be rendered");

  const response = await w.dispatch("get_day_book", {});
  const text = response.content[0].text;

  assert.deepEqual(calls.map((x) => x.url), ["/api/daybook"]);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.credentials, "include");
  assert.match(text, /Chain verification: verified/);
  assert.match(text, new RegExp(head));
  assert.match(text, new RegExp(prev));
  assert.match(text, new RegExp(entryDigest));
  assert.match(text, /employee-authored day-book label/);
  assert.doesNotMatch(text, /local-only label/, "the local FNV log is not the server day book");
});

// ── node T5: the blind export ──────────────────────────────────────────────────
// These assert against the FILE, not against the compiler that produced it, because
// the file is C1's entire world: C1 sees artifacts/tools.export.json and one task
// list and nothing else. Every did-not-change assertion below is committed beside a
// control showing the same operation could have produced a different answer.

const EXPORT = JSON.parse(readFileSync(new URL("../artifacts/tools.export.json", import.meta.url), "utf8"));
const stateOf = (id) => {
  const s = EXPORT.states.find((x) => x.state_id === id);
  assert.ok(s, `no state ${id} in the export`);
  return s;
};
const namesOf = (id) => stateOf(id).tools.map((t) => t.name);

test("T5 export: six canonical states in the frozen order", () => {
  assert.equal(EXPORT.schema, "outpocket.tool_export/1");
  assert.deepEqual(EXPORT.states.map((s) => s.state_id),
    ["S0-anon", "S1-emp-home", "S2-emp-draft-clean", "S3-emp-draft-dirty", "S4-emp-submitted", "S5-aud"]);
});

test("T5 export: the ids cross over at 2/3 — clean is 13 tools, dirty is 12", () => {
  // compile.js's internal S2 is the DIRTY draft and its S3 is the CLEAN one, while
  // the export's S2-… is clean and its S3-… is dirty. The digit does not carry over.
  // Mapping by it would publish submit_expense_report on the surface that holds a
  // blocking violation, and the state count, the id order and every digest would
  // still check out — wrong quietly, which is the whole reason this test exists.
  const clean = namesOf("S2-emp-draft-clean");
  const dirty = namesOf("S3-emp-draft-dirty");
  assert.equal(clean.length, 14);
  assert.equal(dirty.length, 13);
  assert.ok(clean.includes("submit_expense_report"), "the clean draft is the one that can be submitted");
  assert.ok(!dirty.includes("submit_expense_report"), "a blocking violation takes the door away");
  assert.deepEqual(clean.filter((n) => n !== "submit_expense_report"), dirty, "and they differ by that one name only");
});

test("T5 export: every surface_digest recomputes under OCF-1 — and the digest moves when the surface does", () => {
  for (const st of EXPORT.states) {
    assert.equal(digest("outpocket/surface/1", st.tools), st.surface_digest, st.state_id);
  }
  // Control, from the same operation: one character of one description moved, and
  // the digest must move with it. Without this the loop above would pass over a
  // digest function that returned a constant.
  const tampered = JSON.parse(JSON.stringify(stateOf("S5-aud").tools));
  tampered[0].description += ".";
  assert.notEqual(digest("outpocket/surface/1", tampered), stateOf("S5-aud").surface_digest);
  // Control, on membership rather than text: dropping a tool must move it too.
  assert.notEqual(digest("outpocket/surface/1", stateOf("S5-aud").tools.slice(1)), stateOf("S5-aud").surface_digest);
});

test("T5 export: counting tools cannot tell the auditor from the employee", () => {
  // This is why the export carries six states and why everything downstream compares
  // SETS of names. A count assertion passes here even when the auditor has been
  // handed the employee's surface.
  const submitted = stateOf("S4-emp-submitted");
  const auditor = stateOf("S5-aud");
  assert.equal(submitted.tools.length, auditor.tools.length, "both surfaces carry six tools");
  assert.notDeepEqual(namesOf("S4-emp-submitted").slice().sort(), namesOf("S5-aud").slice().sort(),
    "and they are not the same six");
  assert.notEqual(submitted.surface_digest, auditor.surface_digest);
});

test("T5 export: the auditor surface is read-only by construction", () => {
  for (const t of stateOf("S5-aud").tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} must be readOnly`);
  // R-20: the write set is the filter's result, never a typed number.
  assert.deepEqual(stateOf("S5-aud").tools.filter((t) => t.annotations?.readOnlyHint !== true), []);
  // Control: the same filter over a surface that does hold write tools is not empty,
  // so the emptiness above is a fact about the auditor and not about the filter.
  assert.ok(stateOf("S2-emp-draft-clean").tools.filter((t) => t.annotations?.readOnlyHint !== true).length > 0);
});

test("T5 export: blind — only the four fields a client agent's model can see", () => {
  const permitted = ["annotations", "description", "inputSchema", "name"];
  for (const st of EXPORT.states) {
    for (const t of st.tools) {
      for (const k of Object.keys(t)) assert.ok(permitted.includes(k), `${t.name} carries ${k}`);
      for (const k of Object.keys(t.annotations ?? {}))
        assert.ok(k === "readOnlyHint" || k === "untrustedContentHint", `${t.name} carries annotation ${k}`);
      assert.ok(t.description.length <= DESC_BUDGET, `${t.name} description is ${t.description.length} chars`);
    }
  }
  // The contract's x-forbiddenKeys are KEYS, so they are scanned as keys and not as
  // text: `session` is on that list and `get_session_scope` is a legitimate tool
  // name, so a substring sweep would report a leak that is not there. The list is
  // READ from the frozen contract rather than typed — partly so a bump to the
  // contract binds this test, and partly because several of those keys are
  // identifiers layer-0 bans outright, which is exactly why none may appear.
  const contract = JSON.parse(readFileSync(new URL("../erp/contracts/tool-export.schema.json", import.meta.url), "utf8"));
  const forbidden = contract["x-forbiddenKeys"].keys;
  const keysIn = (node, out = []) => {
    if (!node || typeof node !== "object") return out;
    if (Array.isArray(node)) { for (const v of node) keysIn(v, out); return out; }
    for (const k of Object.keys(node)) { out.push(k); keysIn(node[k], out); }
    return out;
  };
  const present = keysIn(EXPORT);
  for (const k of forbidden) assert.ok(!present.includes(k), `the export carries the key ${k}`);
  // Control: the same walk over an object that does carry one must find it.
  assert.ok(keysIn({ states: [{ [forbidden[0]]: 1 }] }).includes(forbidden[0]));

  // Paths and repo identifiers are text, and are scanned as text.
  const raw = readFileSync(new URL("../artifacts/tools.export.json", import.meta.url), "utf8");
  for (const leak of ["src/", ".js", "countinghouse", "/Users/"])
    assert.ok(!raw.includes(leak), `the export leaks ${leak}`);
});

// ── node T3: the absence register ──────────────────────────────────────────────
// The trap in this node is that PRESENT IS NOT USEFUL. A body carrying code
// "UNKNOWN", field "", fix "contact your administrator" and no candidates
// validates against the frozen envelope, names every required key, and tells the
// caller nothing. So these assert CONTENT and DISCRIMINATION: that the same
// question asked from two states absent for two different reasons comes back with
// two different answers, and that the reasons are the real ones.

const violationSchema = JSON.parse(readFileSync(new URL("../erp/contracts/violation.schema.json", import.meta.url), "utf8"));
const validateViolation = new Ajv2020({ allErrors: true, strict: false }).compile(violationSchema);

function askAbout(w, toolName) {
  const def = w.toolset.surface().find((d) => d.name === "explain_missing_tool");
  assert.ok(def, "explain_missing_tool must be on every surface");
  const text = def.execute({ name: toolName }).content[0].text;
  assert.ok(text.length <= OUTPUT_BUDGET, `answer is ${text.length} chars, over the ${OUTPUT_BUDGET} budget`);
  const body = JSON.parse(text);
  assert.ok(validateViolation(body), `answer does not validate: ${JSON.stringify(validateViolation.errors)}`);
  return body;
}

test("T3: the absence register is resident — present in all six states", async () => {
  const w = makeWorld();
  const seen = [];
  const check = () => {
    const n = names(w.toolset);
    assert.equal(n.filter((x) => x === "explain_missing_tool").length, 1, `exactly one, in ${w.toolset.state()}`);
    seen.push(w.toolset.state());
  };
  check();                                                   // S0
  w.erp.signIn("chen", "human"); check();                    // S1
  await buildCleanReport(w); check();                        // S3 clean
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  check();                                                   // S2 dirty
  w.erp.openReport("RP-1017", "test"); check();               // S4 submitted
  w.erp.signOut("human"); w.erp.signIn("ruiz", "human"); check(); // S5 auditor
  assert.deepEqual([...new Set(seen)].sort(), ["S0", "S1", "S2", "S3", "S4", "S5"]);
});

test("T3: it discriminates — two tools absent for different reasons get different answers", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  await buildCleanReport(w);
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");

  // Same state, same question shape, two tools absent for genuinely different
  // reasons: one because the draft is blocked, one because it is auditor-only.
  const blocked = askAbout(w, "submit_expense_report");
  const auditorOnly = askAbout(w, "get_day_book");

  assert.notEqual(blocked.code, auditorOnly.code, "a stub with good manners returns one answer twice");
  assert.notEqual(blocked.rule_id, auditorOnly.rule_id);
  assert.notEqual(blocked.message, auditorOnly.message);
  assert.notEqual(blocked.fix, auditorOnly.fix);

  // And the blocked answer names the REAL reason, not a generic one: the report id
  // it was asked about and the codes the real validator really returned.
  const open = w.erp.openReportOrNull();
  const vd = w.erp.verdict(open.id);
  assert.equal(blocked.code, "REPORT_BLOCKED");
  // entity_id is the STATE, because the envelope requires a surface finding to
  // carry a surface id (and an S rule_id with it). The report is named in the
  // message, where it is context rather than the subject of the finding.
  assert.equal(blocked.entity, "surface");
  assert.match(blocked.rule_id, /^S[0-9]{2,3}$/);
  assert.ok(blocked.message.includes(open.id), "it names the report that is actually blocked");
  assert.equal(blocked.observed, vd.blocking, "it reports the real blocking count");
  assert.match(blocked.message, /CAP_MEALS/, "it names a code the validator actually produced");
  assert.equal(auditorOnly.code, "ROLE_SCOPE");
});

test("T3: the same tool, absent for four different reasons, gets four different answers", async () => {
  // The strongest form of the discrimination claim: hold the QUESTION fixed and
  // move the world. If the reason were cosmetic these would collapse to one.
  const answers = new Map();

  const anon = makeWorld();
  answers.set("S0", askAbout(anon, "submit_expense_report"));

  const home = makeWorld(); home.erp.signIn("chen", "human");
  answers.set("S1", askAbout(home, "submit_expense_report"));

  const submitted = makeWorld(); submitted.erp.signIn("chen", "human"); submitted.erp.openReport("RP-1017", "test");
  answers.set("S4", askAbout(submitted, "submit_expense_report"));

  const aud = makeWorld(); aud.erp.signIn("ruiz", "human");
  answers.set("S5", askAbout(aud, "submit_expense_report"));

  const codes = [...answers.values()].map((b) => b.code);
  assert.equal(new Set(codes).size, codes.length, `four states, four reasons, got: ${codes.join(",")}`);
  assert.deepEqual(codes, ["SIGNIN_REQUIRED", "NO_OPEN_REPORT", "REPORT_NOT_DRAFT", "ROLE_SCOPE"]);
  // Candidates are non-empty EXACTLY when the agent can act, and empty exactly
  // when only a human can. That is not a style choice: the frozen envelope sets
  // candidates maxItems 0 whenever fix_class is human_exception_required, because
  // offering tools to a caller who cannot use them is a way forward that does not
  // exist. S0 (a human must sign in) and S5 (a human must hold the other role) are
  // the two, and both say so in the fix instead.
  const live = { S0: names(anon.toolset), S1: names(home.toolset), S4: names(submitted.toolset), S5: names(aud.toolset) };
  for (const [state, body] of answers) {
    const humanOnly = body.fix_class === "human_exception_required";
    assert.equal(body.candidates.length === 0, humanOnly, `${state}: candidates and fix_class disagree`);
    assert.ok(body.fix.length > 0, `${state}: a human-exception answer still has to say what the human does`);
    // Every candidate offered is a tool actually registered in that state — drawn
    // from the live surface, never a typed list.
    for (const c of body.candidates) assert.ok(live[state].includes(c.value), `${state}: candidate ${c.value} is not on the surface`);
  }
  assert.deepEqual(answers.get("S0").candidates, [], "nobody is signed in; there is nothing an agent can call to fix that");
  assert.ok(answers.get("S1").candidates.length > 0, "opening a report IS something the agent can do");
});

test("T3: it never reports itself missing, and never invents an absence", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  await buildCleanReport(w);

  // Itself. It is resident, so it is never absent, and asking must say so.
  const self = askAbout(w, "explain_missing_tool");
  assert.equal(self.code, "TOOL_PRESENT", "a register that reports itself missing is worse than none");
  assert.equal(self.severity, "warn");

  // A tool that IS present. No fabricated violation.
  const present = askAbout(w, "submit_expense_report");
  assert.equal(present.code, "TOOL_PRESENT", "submit is on the clean-draft surface; saying otherwise is a lie");
  assert.doesNotMatch(present.message, /not (registered|on the)/i);

  // Control, from the same operation: the identical call one blocking violation
  // later does NOT say present — so TOOL_PRESENT is a fact about the surface and
  // not what this tool says to everything.
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  assert.equal(askAbout(w, "submit_expense_report").code, "REPORT_BLOCKED");

  // A name no definition exists for is not dressed up as a state problem.
  assert.equal(askAbout(w, "delete_everything").code, "TOOL_UNKNOWN");
});

test("T3: the register is read-only and moves nothing", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  await buildCleanReport(w);
  const def = w.toolset.surface().find((d) => d.name === "explain_missing_tool");
  assert.equal(def.annotations?.readOnlyHint, true);
  const before = { open: w.erp.state.openReportId, book: w.erp.state.dayBook.length, lines: w.erp.openReportOrNull().lines.length };
  for (const n of [...names(w.toolset), "delete_everything", ""]) await w.dispatch("explain_missing_tool", { name: n });
  assert.equal(w.erp.state.openReportId, before.open);
  assert.equal(w.erp.state.dayBook.length, before.book);
  assert.equal(w.erp.openReportOrNull().lines.length, before.lines);
});

// ── node T2 regression: the registration promise is OWNED ──────────────────────
// Found by QA on the deployed site with a CDP observer: 12 uncaught AbortErrors,
// one per tool-call cycle. Reproduced here on real Chrome 152 at 13 — one per
// REGISTERED TOOL of the generation being revoked, which is why the count tracked
// the surface size and why the deployed number was one lower than ours.
//
// MEASURED: document.modelContext.registerTool(def, {signal}) RETURNS A PROMISE
// that rejects with AbortError when its signal aborts. register.js aborts the
// previous generation on every flip, on purpose, and discarded that promise.
// The fake below reproduces exactly that contract and nothing else.
//
// Nothing was broken by it: the surface was right, the counts were right, the walk
// was green. A fetch probe cannot see an unhandled rejection, which is why it lived.

async function withFakeBrowser(run) {
  const had = { window: "window" in globalThis, document: "document" in globalThis, top: "top" in globalThis };
  const seen = { registered: [], aborts: 0 };

  const abortingContext = {
    registerTool(def, opts) {
      seen.registered.push(def.name);
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => {
          seen.aborts++;
          const err = new Error("signal is aborted without reason");
          err.name = "AbortError";
          reject(err);
        });
      });
    },
  };

  globalThis.window = globalThis;
  globalThis.top = globalThis;
  globalThis.document = { modelContext: abortingContext };

  const unhandled = [];
  const onRej = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onRej);
  const realError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.map(String).join(" "));
  try {
    const { registry } = await import("../src/page/register.js");
    await run({ registry, seen, unhandled, logged, settle: () => new Promise((r) => setTimeout(r, 25)) });
  } finally {
    console.error = realError;
    process.off("unhandledRejection", onRej);
    if (!had.window) delete globalThis.window;
    if (!had.document) delete globalThis.document;
    if (!had.top) delete globalThis.top;
  }
}

test("register: revoking a generation leaks no unhandled rejection — and the abort really fired", async () => {
  await withFakeBrowser(async ({ registry, seen, unhandled, settle }) => {
    // Back-to-back state changes, which is what an agent filing several lines does
    // and what the seeded demo does twelve times.
    registry.erp.signIn("chen", "human");
    registry.erp.createReport({ title: "Rejection probe", project: "FALCON" }, "test");
    registry.erp.addLine({ date: "2026-08-24", merchant: "Cafe", category: "meals", amount: 9, attendees: 1, description: "lunch" }, "test");
    await settle();

    // THE CONTROL, and it is the whole point (D-90): this test is not satisfiable
    // by nothing having happened. Tools were really registered, and the revocation
    // really fired — so a rejection COULD have surfaced from this same operation.
    assert.ok(seen.registered.length > 0, "no tool was ever registered; the assertion below would be vacuous");
    assert.ok(seen.aborts > 0, "no generation was ever revoked; the assertion below would be vacuous");
    assert.ok(registry.flips() >= 2, `expected several flips, saw ${registry.flips()}`);

    // The assertion itself. Remove the handler in register.js and this fails.
    assert.deepEqual(unhandled, [], `deliberate revocation leaked ${unhandled.length} unhandled rejection(s)`);
    assert.deepEqual(registry.registrationErrors(), [], "an abort we caused is not an error and must not be recorded as one");
  });
});

test("register: a registration failure that is NOT our abort is surfaced, never swallowed", async () => {
  await withFakeBrowser(async ({ registry, unhandled, logged, settle }) => {
    // A catch-all that eats genuine failures is worse than the rejection it
    // replaced (D-100). Swap in a browser that rejects for a real reason and
    // prove the handler tells the two apart — same handler, same code path.
    const boom = new TypeError("registerTool: a tool definition is required");
    globalThis.document.modelContext = { registerTool: () => Promise.reject(boom) };

    registry.erp.signIn("ruiz", "human"); // a real flip, so registration is attempted
    await settle();

    const errors = registry.registrationErrors();
    assert.ok(errors.length > 0, "a real registration failure must be recorded");
    assert.equal(errors[0].error, boom, "and it must be the actual error, not a substitute");
    assert.ok(logged.some((l) => l.includes("rejected")), "and it must be logged where a human will see it");
    assert.deepEqual(unhandled, [], "surfacing it must not itself leak an unhandled rejection");
  });
});
