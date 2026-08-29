// outpocket — the surface compiler (node T1, seat I2).
//
// PORTED, not rewritten, from src/tools.js. ./defs.js answers "what IS a tool";
// this file answers "which tools exist RIGHT NOW", and then dispatches calls to
// them. Compiling (session role x open-report state x validation verdict) into a
// set of names is the whole mechanism:
//
//   S0  signed out                     ->  1 tool   get_signin_status
//   S1  employee, no report open       ->  5 tools
//   S2  employee, draft open and DIRTY -> 12 tools
//   S3  employee, draft open and CLEAN -> 13 tools  (submit_expense_report appears)
//   S4  employee, report submitted     ->  6 tools  (shrinks; every editing tool gone)
//   S5  auditor                        ->  6 tools  (read-only by construction)
//
// Read that table in the right direction: 13 is the CLEAN draft and 12 is the dirty
// one, and once a report leaves draft the surface SHRINKS to 6. It does not grow
// after signing. S4 and S5 both hold six names and are not the same six, which is
// why anything downstream compares sets of names and never counts.
//
// A tool that must not be called right now is a tool that does not exist right now.
// Workflow order therefore never appears in a description; the registration state
// machine is the workflow. The tool surface is the intent surface; the boundary is
// on the server, which re-checks every write underneath this.
//
// Pure module: no DOM. The page bridge, the in-page simulated agent, the manual tool
// console and `node --test` all dispatch through the same runTool() path, so every
// mode exercises identical behaviour.

import { buildDefs, clip, ok, OUTPUT_BUDGET, DESC_BUDGET, ALL_TOOL_NAMES } from "./defs.js";
import { ErpError } from "../../erp.js";

export { clip, OUTPUT_BUDGET, DESC_BUDGET, ALL_TOOL_NAMES };

// The canonical state ids, frozen in erp/contracts/tool-surface.contract.md §1.
export const STATES = Object.freeze(["S0", "S1", "S2", "S3", "S4", "S5"]);

// Per-state membership, copied from the frozen contract §1 in the contract's own
// order. This is a table rather than a chain of pushes precisely so that a diff of
// this constant against the frozen document is a line-by-line comparison a human
// can do. Names and membership may not change without a freeze bump.
const BASE = ["get_session_scope", "get_expense_policy", "list_expense_reports", "create_expense_report", "open_expense_report"];
const EDITING = [...BASE, "get_open_report", "add_expense_line", "update_expense_line", "remove_expense_line", "list_receipts", "link_receipt", "validate_expense_report"];

export const MEMBERSHIP = Object.freeze({
  S0: Object.freeze(["get_signin_status"]),
  S1: Object.freeze([...BASE]),
  S2: Object.freeze([...EDITING]),
  S3: Object.freeze([...EDITING, "submit_expense_report"]),
  S4: Object.freeze([...BASE, "get_open_report"]),
  S5: Object.freeze(["get_session_scope", "get_expense_policy", "list_expense_reports", "get_report", "get_open_report", "get_day_book"]),
});

// Which of the six states the world is in. Single source of truth: compileSurface
// switches on this and nothing else re-derives it, so the state id and the tool set
// cannot disagree with each other.
export function surfaceState(erp) {
  const session = erp.session();
  if (!session) return "S0";
  if (session.role === "auditor") return "S5";
  const open = erp.openReportOrNull();
  if (!open) return "S1";
  if (open.status !== "draft") return "S4";
  const vd = erp.verdict(open.id);
  return vd.clean && open.lines.length ? "S3" : "S2";
}

// The tools that exist right now, in the frozen contract's order.
export function compileSurface(erp, hooks = {}) {
  const built = buildDefs(erp, hooks);
  return MEMBERSHIP[surfaceState(erp)].map((name) => built[name]);
}

// The names NOT on the surface right now, with the state that put them there. This
// is the raw material for T3's absence register; it is computed from the same
// membership table as the surface itself, never typed.
export function compileAbsent(erp) {
  const state = surfaceState(erp);
  const present = new Set(MEMBERSHIP[state]);
  return { state, absent: ALL_TOOL_NAMES.filter((n) => !present.has(n)) };
}

// The write set: every tool on the CURRENT surface whose readOnlyHint is not true.
// R-20 — computed, never hard-coded. Counting it is the caller's business; this
// returns the filter's result so the number is whatever the surface actually holds.
export function writeTools(surfaceDefs) {
  return surfaceDefs.filter((d) => d.annotations?.readOnlyHint !== true);
}

// ── toolset: one dispatch path for every mode ──────────────────
export function createToolset(erp, hooks = {}) {
  const surface = () => compileSurface(erp, hooks);

  function surfaceKey() {
    return surface().map((d) => d.name).join("|");
  }

  async function runTool(def, args, opts, source) {
    const t0 = hooks.now ? hooks.now() : Date.now();
    const rec = hooks.onCallStart?.({ name: def.name, args, source });
    try {
      // Double lock: a captured execute must not outlive its registration.
      if (!surface().some((d) => d.name === def.name)) {
        const res = ok(`Tool ${def.name} is no longer on the surface — the page state moved on. Current tools: ${surfaceKey().replaceAll("|", ", ")}.`);
        hooks.onCallEnd?.(rec, { status: "gone", text: res.content[0].text, ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
        return res;
      }
      const raw = await def.execute(args ?? {}, opts, source);
      raw.content[0].text = clip(raw.content[0].text);
      hooks.onCallEnd?.(rec, { status: "ok", text: raw.content[0].text, ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
      return raw;
    } catch (e) {
      if (e?.name === "AbortError") {
        hooks.onCallEnd?.(rec, { status: "aborted", text: "aborted", ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
        throw e;
      }
      const text = e instanceof ErpError ? `Error [${e.code}]: ${e.message}` : `Error: ${e?.message ?? String(e)}`;
      hooks.onCallEnd?.(rec, { status: "err", text, ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
      return ok(clip(text));
    }
  }

  async function call(name, args, { source = "agent", signal } = {}) {
    const def = surface().find((d) => d.name === name);
    if (!def) {
      const text = `No tool named "${name}" exists on the current surface. Available: ${surfaceKey().replaceAll("|", ", ") || "(none)"}.`;
      hooks.onCallEnd?.(hooks.onCallStart?.({ name, args, source }), { status: "gone", text, ms: 0 });
      return ok(text);
    }
    return runTool(def, args, { signal }, source);
  }

  return { surface, surfaceKey, runTool, call, state: () => surfaceState(erp) };
}
