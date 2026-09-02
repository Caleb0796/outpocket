// src/page/tools/absence.js — node T3, seat I2. The absence register.
//
// A tool that must not be called right now is a tool that does not exist right
// now. That is the whole mechanism of this surface, and it has one cost: an agent
// that wanted `submit_expense_report` finds nothing there and cannot tell WHY —
// whether it is signed out, holding the wrong role, looking at a submitted report,
// or holding a draft with a blocking violation. Four very different situations
// that all look identical from the outside, namely like nothing at all.
//
// This module answers that question. It is the working group's open issues #199
// and #262. Say what ours does; make no claim about what anything else does.
// Its result can echo the caller-supplied tool name into agent-visible text, so
// the read-only definition carries untrustedContentHint as well as readOnlyHint.
//
// ── it is REGISTERED, and it is in the export ─────────────────────────────────
//
// D-77 (PM, 2026-08-29) overturned D-75 and ruled reading (a): explain_missing_tool
// is on the published surface in all six states and is counted in the blind export
// like every other tool. The earlier ruling would have registered it on the page
// and hidden it from artifacts/tools.export.json, which erp/RISK.md §5 names as the
// one hazard that makes C1's verdict "worthless in exactly the direction that
// flatters us" — and it would have withheld from the blind seat the single feature
// built for the blind seat's hardest moment, which is finding the tool it wanted
// absent and giving up. It is a tool. It is on the surface. It is in the export.
//
// ── the envelope is not new ───────────────────────────────────────────────────
//
// The answer is erp/contracts/violation.schema.json, unchanged and unbumped — the
// same twelve-field body the expense rules already emit. That reuse is not a saving
// but the point: an agent that has already parsed one violation can parse this one.
// `entity` has a "surface" member and `rule_id` matches ^[RS][0-9]{2,3}$ while the
// policy document only ever issues R01..R19, so the S namespace was left open for
// exactly this. Nothing here is added to POLICY_DOCUMENT: its digest is pinned
// (sha256:b7ccc1ff…, erp/contracts/policy-versions.json) and these are surface
// rules, not policy rules. They live here.
//
// ── PRESENT IS NOT USEFUL ─────────────────────────────────────────────────────
//
// A body carrying code "UNKNOWN", field "", fix "contact your administrator" and
// no candidates validates against the schema, names every required key, and is
// worthless. So every answer below is computed from the live state: which states
// the asked tool actually belongs to, which state the page is actually in, and —
// when a draft is blocked — the real codes the real validator really returned.
// Two tools absent for two different reasons get two different answers, and
// tests/surface.test.mjs asserts that they differ rather than that they exist.
//
// Two things this must never do, both worse than having no tool at all:
//   - report ITSELF as missing. It is resident in all six states, so it is never
//     absent, and asking about it takes the TOOL_PRESENT path like anything else.
//   - invent a reason for a tool that is present. A register that explains
//     absences by fabricating them is a liar with good manners.
//
// No import of ./compile.js. The membership table is passed IN, so the module
// graph stays acyclic: compile.js -> {defs.js, absence.js}, absence.js -> defs.js.
// A cycle here would link in node but is exactly the shape that took the page down
// once already today, and a page that registers zero tools looks healthy to every
// fetch-based probe.

import { ALL_TOOL_NAMES, ok } from "./defs.js";
import { POLICY_VERSION } from "../../policy.js";

export const ABSENCE_TOOL_NAME = "explain_missing_tool";

const ENVELOPE = "outpocket.violation/1";

// The surface rules. Same shape as policy.js's RULES, disjoint id namespace: the
// policy document owns R, the surface owns S. Every answer this module returns
// traces to exactly one row here.
//
// TWO CONDITIONALS IN THE FROZEN ENVELOPE SHAPE THIS TABLE, and both are load-
// bearing rather than decorative:
//
//   1. `entity: "surface"` REQUIRES rule_id to match ^S[0-9]{2,3}$ and entity_id
//      to be lowercase snake_case. So the S namespace is not merely available for
//      surface findings, it is mandatory — and `entity: "report"` would force an
//      R rule_id, which would misattribute a surface fact to a policy rule that
//      did not produce it. Every answer here is therefore entity "surface". The
//      report is named in the message, where it is context rather than subject.
//
//   2. fix_class human_exception_required or not_reimbursable REQUIRES candidates
//      to be EMPTY (maxItems 0). That encodes something true and worth obeying:
//      when only a human can act, there is no value the agent could supply, and a
//      list of tools offered anyway is false helpfulness — it reads as a way
//      forward that does not exist. So the two reasons an agent genuinely cannot
//      act on — nobody is signed in, and the role has no such scope — carry an
//      empty candidate list ON PURPOSE, and say so in the fix instead. Every
//      reason the agent CAN act on carries real candidates.
export const SURFACE_RULES = Object.freeze({
  TOOL_UNKNOWN:     { id: "S01", severity: "warn",  fix_class: "informational",            field: "tool_name" },
  TOOL_PRESENT:     { id: "S02", severity: "warn",  fix_class: "informational",            field: "tool_name" },
  SIGNIN_REQUIRED:  { id: "S03", severity: "block", fix_class: "human_exception_required", field: "session" },
  ROLE_SCOPE:       { id: "S04", severity: "block", fix_class: "human_exception_required", field: "role" },
  NO_OPEN_REPORT:   { id: "S05", severity: "block", fix_class: "provide_missing_data",     field: "open_report" },
  REPORT_NOT_DRAFT: { id: "S06", severity: "block", fix_class: "provide_missing_data",     field: "status" },
  REPORT_EMPTY:     { id: "S07", severity: "block", fix_class: "provide_missing_data",     field: "lines" },
  REPORT_BLOCKED:   { id: "S08", severity: "block", fix_class: "provide_missing_data",     field: "lines" },
  SIGNED_IN:        { id: "S09", severity: "warn",  fix_class: "informational",            field: "session" },
});

// entity_id for a surface finding, and it must satisfy ^[a-z][a-z0-9_]{2,63}$.
// Spelled out rather than lowercased from the compiler's id on purpose: "s2" and
// "s3" carry a digit whose meaning has already been misread once in this project,
// and the export's S2/S3 mean the opposite draft to the compiler's. A reader of
// this field should never have to know which namespace produced it.
const STATE_ENTITY_ID = Object.freeze({
  S0: "s0_signed_out",
  S1: "s1_no_report_open",
  S2: "s2_draft_dirty",
  S3: "s3_draft_clean",
  S4: "s4_report_submitted",
  S5: "s5_auditor",
});

// The candidate list is empty exactly when the frozen envelope requires it to be.
const NO_CANDIDATES = Object.freeze([]);

const MAX_TEXT = 240;   // message and fix, per the frozen envelope
const MAX_LABEL = 60;   // candidate label; the envelope permits 80
const MAX_CANDIDATES = 3;

const trim = (s, n = MAX_TEXT) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

// Candidates are drawn from the surface AS IT STANDS, never from a typed list.
// `wanted` is a preference order; anything not registered right now is dropped,
// and if nothing preferred survives, the caller gets what is actually there.
// The result is always non-empty, because this tool is itself always on the
// surface — which is the honest floor: "here is what you can call instead."
function candidatesFrom(wanted, surfaceNames, describe) {
  let picks = wanted.filter((n) => surfaceNames.includes(n));
  if (!picks.length) picks = surfaceNames.filter((n) => n !== ABSENCE_TOOL_NAME);
  if (!picks.length) picks = [...surfaceNames];
  return picks.slice(0, MAX_CANDIDATES).map((n) => ({
    value: n,
    label: trim(describe?.(n) ?? "on this surface now", MAX_LABEL),
    origin: "existing_entity",
  }));
}

function envelope(rule, state, { code, message, fix, candidates, observed, limit }) {
  const humanOnly = rule.fix_class === "human_exception_required" || rule.fix_class === "not_reimbursable";
  const body = {
    schema: ENVELOPE,
    code,
    rule_id: rule.id,
    severity: rule.severity,
    entity: "surface",
    entity_id: STATE_ENTITY_ID[state] ?? "s_unknown_state",
    field: rule.field,
    message: trim(message),
    fix: trim(fix),
    fix_class: rule.fix_class,
    // Enforced here rather than trusted at the call sites: the envelope forbids
    // candidates on a human-exception finding, and a body that violated it would
    // be rejected downstream instead of being merely unhelpful.
    candidates: humanOnly ? [...NO_CANDIDATES] : candidates,
    policy_version: POLICY_VERSION,
  };
  if (observed !== undefined) body.observed = observed;
  if (limit !== undefined) body.limit = limit;
  return body;
}

/**
 * Why `name` is not on the surface right now, and what would bring it back.
 *
 * @param name         the tool the caller asked about
 * @param erp          the model, for the reasons that depend on real report state
 * @param state        the canonical internal state id, S0..S5
 * @param membership   the frozen per-state table (passed in; see the header)
 * @param catalogue    every name a definition exists for, this tool included
 * @param surfaceNames the names registered right now
 * @param describe     name -> its description, for candidate labels
 */
export function explainMissing({ name, erp, state, membership, catalogue, surfaceNames, describe }) {
  const asked = typeof name === "string" ? name.trim() : "";

  // The browser does not validate inputSchema — it parses JSON, checks for an
  // Object, and calls us. So the argument is checked here, in code, like every
  // other tool on this surface.
  if (!asked) {
    return envelope(SURFACE_RULES.TOOL_UNKNOWN, state, {
      code: "TOOL_NAME_MISSING",
      message: "No tool name was supplied, so there is no absence to explain.",
      fix: `Ask again with the name of a tool, for example one of: ${catalogue.slice(0, 3).join(", ")}.`,
      candidates: candidatesFrom([], surfaceNames, describe),
    });
  }

  if (!catalogue.includes(asked)) {
    return envelope(SURFACE_RULES.TOOL_UNKNOWN, state, {
      code: "TOOL_UNKNOWN",
      message: `No tool named ${asked} exists in this application in any state, so its absence is not a state the page can move to.`,
      fix: "Choose a tool that exists; the candidates are what is registered right now.",
      candidates: candidatesFrom([], surfaceNames, describe),
    });
  }

  // Present, including when the caller asks about this register itself. Reported
  // truthfully; nothing is invented.
  if (surfaceNames.includes(asked)) {
    return envelope(SURFACE_RULES.TOOL_PRESENT, state, {
      code: "TOOL_PRESENT",
      message: `${asked} is registered now; clients that snapshot the tool list per turn will see it on their next turn. Nothing is blocking it.`,
      fix: "No action is needed to make it available.",
      candidates: candidatesFrom([asked], surfaceNames, describe),
    });
  }

  // Genuinely absent. Which states DO hold it decides the reason.
  const presentIn = Object.keys(membership).filter((s) => membership[s].includes(asked));
  const session = erp.session();
  const open = erp.openReportOrNull();

  if (state === "S0") {
    return envelope(SURFACE_RULES.SIGNIN_REQUIRED, state, {
      code: "SIGNIN_REQUIRED",
      message: `${asked} needs a signed-in session and nobody is signed in, so the surface holds only the sign-in explainer.`,
      fix: "The employee signs in themselves, in the page, via company SSO — an agent cannot do it and is never shown credentials.",
      candidates: candidatesFrom(["get_signin_status"], surfaceNames, describe),
    });
  }

  if (presentIn.length === 1 && presentIn[0] === "S0") {
    return envelope(SURFACE_RULES.SIGNED_IN, state, {
      code: "ALREADY_SIGNED_IN",
      message: `${asked} exists only while nobody is signed in. ${session?.name ?? "Someone"} is signed in, so it has been replaced by this session's own tools.`,
      fix: "Read the current scope instead; there is nothing to recover.",
      candidates: candidatesFrom(["get_session_scope"], surfaceNames, describe),
    });
  }

  // Role. An auditor asking for a write tool, or an employee asking for one of
  // the auditor's read-only views, is out of scope rather than out of sequence,
  // and no amount of calling other tools changes it.
  const employeeStates = ["S1", "S2", "S3", "S4"];
  const auditorOnly = presentIn.length === 1 && presentIn[0] === "S5";
  const employeeOnly = presentIn.every((s) => employeeStates.includes(s));
  if ((state === "S5" && employeeOnly) || (state !== "S5" && auditorOnly)) {
    const role = session?.role ?? "none";
    return envelope(SURFACE_RULES.ROLE_SCOPE, state, {
      code: "ROLE_SCOPE",
      message: `${asked} is not in the ${role} role's scope, so it is not registered for this session at all.`,
      fix: `Nothing on this surface reaches it; a session with the other role is required. ${role === "auditor" ? "Auditors never hold write tools." : "This is an auditor-only view."}`,
      candidates: candidatesFrom([], surfaceNames, describe),
    });
  }

  if (state === "S1") {
    return envelope(SURFACE_RULES.NO_OPEN_REPORT, state, {
      code: "NO_OPEN_REPORT",
      message: `${asked} acts on an open report and no report is open, so it is not registered.`,
      fix: "Open an existing report or create one; the surface grows when a draft is open.",
      candidates: candidatesFrom(["open_expense_report", "create_expense_report", "list_expense_reports"], surfaceNames, describe),
    });
  }

  if (state === "S4") {
    return envelope(SURFACE_RULES.REPORT_NOT_DRAFT, state, {
      code: "REPORT_NOT_DRAFT",
      message: `Report ${open?.id ?? "?"} is ${open?.status ?? "not a draft"} and read-only, so ${asked} and every other editing tool are off the surface.`,
      fix: "A submitted report does not reopen. Open a different draft, or create a new report.",
      candidates: candidatesFrom(["create_expense_report", "open_expense_report", "list_expense_reports"], surfaceNames, describe),
    });
  }

  // A draft is open. The only catalogue tool absent here is submit_expense_report,
  // and it is absent for one of two reasons that are not the same reason.
  if (open && open.status === "draft") {
    const vd = erp.verdict(open.id);
    if (!open.lines.length) {
      return envelope(SURFACE_RULES.REPORT_EMPTY, state, {
        code: "REPORT_EMPTY",
        message: `Report ${open.id} has no expense lines, so ${asked} is not on the surface — there is nothing to submit.`,
        fix: "Add at least one expense line; the door opens when the report has lines and no blocking violation.",
        candidates: candidatesFrom(["add_expense_line"], surfaceNames, describe),
        observed: 0,
      });
    }
    const codes = blockingCodes(vd);
    return envelope(SURFACE_RULES.REPORT_BLOCKED, state, {
      code: "REPORT_BLOCKED",
      message: `Report ${open.id} has ${vd.blocking} blocking violation(s) — ${codes.join(", ") || "unspecified"} — so ${asked} is not registered.`,
      fix: "Clear every blocking violation; the door opens by itself when the verdict is clean.",
      candidates: candidatesFrom(blockedCandidateOrder(codes), surfaceNames, describe),
      observed: vd.blocking,
      limit: 0,
    });
  }

  // Not reachable from the six states as they stand. Kept because a silent
  // undefined here would be a lie by omission, and because MEMBERSHIP can grow.
  return envelope(SURFACE_RULES.REPORT_NOT_DRAFT, state, {
    code: "STATE_MISMATCH",
    message: `${asked} is registered in ${presentIn.join(", ") || "no"} state(s); the page is in ${state}.`,
    fix: "Reach one of the states that registers it; this surface does not.",
    candidates: candidatesFrom([], surfaceNames, describe),
  });
}

// The distinct blocking codes the real validator really returned, in report order.
function blockingCodes(vd) {
  const all = [...(vd.reportViolations ?? []), ...[...(vd.lineViolations?.values?.() ?? [])].flat()];
  return [...new Set(all.filter((x) => x.severity === "block").map((x) => x.code))];
}

// The envelope permits three candidates. The validator's first real blocking code
// selects the immediate repair class: receipt findings need discovery and linking,
// while field findings need the line editor. This matters when a costly field also
// lacks a receipt — the earlier field finding must not be hidden by a later receipt
// finding. Validation remains in both fronts so neither class can crowd it out.
function blockedCandidateOrder(codes) {
  const receiptBlocked = codes[0] === "RECEIPT_REQUIRED" || codes[0] === "RECEIPT_DUP";
  return receiptBlocked
    ? ["list_receipts", "link_receipt", "validate_expense_report", "update_expense_line", "remove_expense_line"]
    : ["update_expense_line", "validate_expense_report", "remove_expense_line", "list_receipts", "link_receipt"];
}

/**
 * The tool definition. `table` is supplied by ./compile.js, which owns the frozen
 * membership; this module never imports it. Everything is read through thunks so
 * the answer describes the surface at CALL time, not at build time.
 */
export function buildAbsenceTool(erp, table) {
  return {
    name: ABSENCE_TOOL_NAME,
    description:
      "Explain why a named tool is not on this page's tool surface right now, and what would bring it back. " +
      "Returns the same violation envelope the expense rules use: a code, a severity, the field at issue, a one-sentence fix, " +
      "and candidate tools taken from the surface as it currently stands. Tools that are present are reported as present.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: [...ALL_TOOL_NAMES, ABSENCE_TOOL_NAME],
          description: "The tool to explain, for example submit_expense_report.",
        },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (args = {}) =>
      ok(JSON.stringify(explainMissing({
        name: args.name,
        erp,
        state: table.stateOf(),
        membership: table.membership,
        catalogue: table.catalogue,
        surfaceNames: table.surfaceNames(),
        describe: table.describe,
      }))),
  };
}
