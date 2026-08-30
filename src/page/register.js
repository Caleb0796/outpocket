// src/page/register.js — node T2, seat I2: registration and revocation.
//
// This is the only file in the project that talks to the browser's tool API.
// ./tools/defs.js answers "what IS a tool", ./tools/compile.js answers "which
// tools exist RIGHT NOW", and this file makes the browser agree with the second
// answer — by registering what the compiler says exists and revoking what it
// says no longer does.
//
//   S0  signed out                     ->  1 tool
//   S1  employee, no report open       ->  5 tools
//   S2  employee, draft open and DIRTY -> 12 tools
//   S3  employee, draft open and CLEAN -> 13 tools   submit_expense_report exists
//   S4  employee, report submitted     ->  6 tools   every editing tool is gone
//   S5  auditor                        ->  6 tools   read-only by construction
//
// 13 is the CLEAN draft, 12 is the dirty one, and once a report leaves draft the
// surface SHRINKS to 6 — it does not grow after signing. S4 and S5 both hold six
// names and are not the same six, which is why everything downstream of here
// compares sets of names and never counts.
//
// A tool that must not be called right now is a tool that does not exist right
// now. Workflow order therefore never appears in a description; this state
// machine is the workflow. The tool surface is the intent surface; the boundary
// is on the server, which re-checks every write underneath this page.
//
// ── THE ONE HARD RULE: TOP-LEVEL DOCUMENT ONLY ────────────────────────────────
//
// Registration happens in the top-level document and nowhere else. Some clients
// discover no tools at all that were registered inside a frame — same origin or
// not (erp/FACTS.md; probe/README.md states this page registers everything at
// top level for that reason). A frame is not a weaker place to register; it is a
// place where registration silently does nothing, which is worse, because the
// page looks correct and the surface is empty. tools/check-toplevel.mjs proves
// statically that no call site is reachable from a frame or worker entry;
// mountedInTopLevelDocument below is the same rule asserted at run time.
//
// ── WHAT THIS FILE DOES NOT CLAIM ─────────────────────────────────────────────
//
// Aborting a registration signal takes the tool off the surface. It does not
// reach into a call that is already running: an execute that has already started
// runs to completion (Chrome 153+). The protection against a captured execute
// outliving its registration is the double lock in ./tools/compile.js, which
// re-checks membership at execution time — not the abort. Nothing here should be
// described as stopping work that is already under way.
//
// A surface flip is cheap but it is not free: it costs roughly one prompt-cache
// write on the agent's side, and the refreshed list reaches the agent on its
// NEXT turn, not mid-turn. Registration measured at ~37 µs per tool and
// revocation at ~1.1 µs per tool, so the whole 13-tool surface re-registers in
// well under a millisecond. There is nothing here worth optimising.
//
// ── WIRING (one line, owned by node F1) ───────────────────────────────────────
//
// src/page/index.html must load this module from the top-level document:
//
//     <script type="module" src="./register.js"></script>
//
// index.html is F1's output and this file is T2's, so that line is UX's to add;
// its header comment already names this file as the registrar. Until it lands,
// the module is loadable and correct but nothing evaluates it in the page.

import { createErp } from "../erp.js";
import { createToolset, compileSurface, surfaceState, writeTools } from "./tools/compile.js";

// ── where we are ──────────────────────────────────────────────────────────────
// Written as a positive assertion — "this IS the top-level document" — rather
// than as a test for being framed. That is not a stylistic preference. Code that
// asks whether it is inside a frame is the shape tools/check-toplevel.mjs reads
// as a self-identifying frame script, and a file that declared itself frame code
// in order to refuse to be frame code would make itself an iframe entry in that
// checker's graph and fail the very invariant it is guarding. The assertion
// below is also the honest description of this module: it belongs at the top
// level and declines to do anything anywhere else.
const inBrowser = typeof window !== "undefined" && typeof document !== "undefined";
const mountedInTopLevelDocument = inBrowser && window === window.top;

// ── the model ─────────────────────────────────────────────────────────────────
const erp = createErp();

// Listeners for anything in the page that wants to watch the surface move: F5's
// inspector, H3's in-page agent, the manual console. They are told what changed,
// not asked to recompute it.
const flipListeners = new Set();
const callListeners = new Set();

function emitFlip(detail) {
  for (const fn of flipListeners) {
    try { fn(detail); } catch (err) { console.error("register: flip listener failed", err); }
  }
}

// ── the signature seam ────────────────────────────────────────────────────────
// submit_expense_report suspends while the employee reviews the report and signs
// it in the page. That dialog is node F4 and it has not landed. The default
// below is the SAFE one and it is deliberately not a stub that pretends: with no
// human present to sign, nothing is signed and the draft stays editable. F4
// installs the real dialog by calling setSignatureProvider once.
let signatureProvider = null;

function setSignatureProvider(fn) {
  if (typeof fn !== "function") throw new TypeError("setSignatureProvider needs a function");
  signatureProvider = fn;
  return () => { if (signatureProvider === fn) signatureProvider = null; };
}

async function requestSignature(summary, signal) {
  if (!signatureProvider) {
    return {
      signed: false,
      reason: "no signature dialog is mounted in this page, so there is nobody to sign",
    };
  }
  return signatureProvider(summary, signal);
}

const hooks = {
  requestSignature,
  onCallStart: (rec) => rec,
  onCallEnd: (rec, result) => {
    for (const fn of callListeners) {
      try { fn({ ...rec, ...result }); } catch (err) { console.error("register: call listener failed", err); }
    }
  },
};

const toolset = createToolset(erp, hooks);

// ── the registry ──────────────────────────────────────────────────────────────
//
// One AbortController per GENERATION, not per tool, and the reason is a real
// bug rather than a simplification. buildDefs() captures the session once, when
// it builds, so a definition registered while chen was signed in keeps reporting
// chen's scope. Three names — get_session_scope, get_expense_policy,
// list_expense_reports — are on both the employee and the auditor surface, so a
// registry that diffed by name and left "unchanged" tools alone would leave
// exactly those three answering with the previous session's data after a persona
// switch. Every flip therefore re-registers every tool against freshly built
// definitions, and the previous generation is revoked whole.
//
// That costs ~0.5 ms for a 13-tool surface. The arrived/departed diff below is
// computed for reporting only; it never decides what gets registered.

let generation = null; // { n, controller, names: string[], state: string }
let flips = 0;
let syncing = false;

function modelContext() {
  return mountedInTopLevelDocument ? document.modelContext ?? null : null;
}

/**
 * What the browser actually receives.
 *
 * NOT the definition object itself. A raw definition hands the browser
 * `def.execute` directly, which walks past three things ./tools/compile.js
 * built and which every other caller in this project goes through: the double
 * lock that re-checks membership at execution time, the 1500-character output
 * budget, and the error envelope that turns an ErpError into readable text
 * instead of a rejected promise. The double lock is the one that matters most
 * here — aborting a signal does not reach a call that has already started, so
 * the membership re-check inside runTool is what stops a captured execute from
 * acting after its tool has left the surface.
 *
 * Wrapping is also why the in-page agent, the manual console and `node --test`
 * exercise identical behaviour to a real client: one dispatch path, four
 * callers.
 *
 * The shape is exactly four keys plus execute. Annotations are exactly the two
 * that exist — readOnlyHint and untrustedContentHint — and definitions carry
 * only the first. Nothing else is emitted, because nothing else is real.
 *
 * `source` is "agent": a call arriving through the browser's tool API is the
 * agent's act, and provenance downstream depends on that being recorded
 * honestly rather than defaulted.
 */
function toRegistration(def) {
  const reg = {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    execute: (args, opts) => toolset.runTool(def, args, opts, "agent"),
  };
  if (def.annotations) reg.annotations = def.annotations;
  return reg;
}

/**
 * Recompile the surface and make the browser agree with it.
 *
 * Synchronous end to end, with no await between revoking the old generation and
 * registering the new one, so there is never a moment where two definitions
 * share a name or where the surface is observably empty mid-flip.
 */
function sync(reason = "change") {
  if (syncing) return generation; // re-entrancy: an emit during a flip
  syncing = true;
  try {
    const state = surfaceState(erp);
    const defs = compileSurface(erp, hooks);
    const names = defs.map((d) => d.name);
    const previous = generation;

    // Nothing to do if the same names are already registered in this same state.
    // Identity of the definitions changed (buildDefs is fresh every call), but
    // if neither the state nor the membership moved, the captured session and
    // report are the same objects and re-registering would be churn.
    if (previous && previous.state === state && sameNames(previous.names, names)) {
      return previous;
    }

    const api = modelContext();

    // Revoke the whole previous generation, then register the whole new one.
    if (previous) previous.controller.abort();

    const controller = new AbortController();
    const registered = [];
    if (api) {
      for (const def of defs) {
        api.registerTool(toRegistration(def), { signal: controller.signal });
        registered.push(def.name);
      }
    }

    generation = {
      n: previous ? previous.n + 1 : 0,
      controller,
      names,
      state,
      registered,
      registeredWithBrowser: Boolean(api),
    };
    flips++;

    const before = previous?.names ?? [];
    const detail = {
      reason,
      generation: generation.n,
      state,
      names,
      arrived: names.filter((n) => !before.includes(n)),
      departed: before.filter((n) => !names.includes(n)),
      // R-20: the write set is every tool on the CURRENT surface whose
      // readOnlyHint is not true. Computed by the filter, never typed as a
      // number — a count that is right today is wrong on the next flip.
      writes: writeTools(defs).map((d) => d.name),
      registeredWithBrowser: Boolean(api),
    };
    emitFlip(detail);
    return generation;
  } finally {
    syncing = false;
  }
}

function sameNames(a, b) {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

// ── the session bridge ────────────────────────────────────────────────────────
//
// erp/contracts/session.contract.md: GET /api/me is the only persona check
// anything relies on, and F1's shell is what performs it. This file never reads
// a cookie and never decides who is signed in — it mirrors the shell's answer
// into the ERP, and a mirror that is already correct is left alone so no
// spurious flip is emitted.
function adoptSession(session) {
  const current = erp.session()?.id ?? null;
  const wanted = session?.persona ?? null;
  if (current === wanted) {
    sync("session");
    return;
  }
  if (wanted === null) erp.signOut("human");
  else erp.signIn(wanted, "human");
  // signIn/signOut emit, which calls sync through onChange; this call covers the
  // first paint, before any subscription exists.
  sync("session");
}

// ── the page object ───────────────────────────────────────────────────────────
//
// The seam every other in-page node uses, and the one H3's driver walks when it
// runs the same surface with the browser feature switched off. getTools() and
// executeTool() answer from the compiled surface, so the page and the browser
// are reading the same table rather than two tables that agree by luck.
export const registry = {
  erp,
  toolset,

  /** Canonical state id: S0 | S1 | S2 | S3 | S4 | S5. */
  state: () => surfaceState(erp),

  /** Names on the surface right now, in the frozen contract's order. */
  names: () => compileSurface(erp, hooks).map((d) => d.name),

  /** The page's own tool list, shaped like the browser's. */
  getTools: () =>
    compileSurface(erp, hooks).map((d) => ({
      name: d.name,
      description: d.description,
      inputSchema: d.inputSchema,
      annotations: d.annotations ?? {},
    })),

  /** The page's own dispatch. Same path the browser's execute takes. */
  executeTool: (name, args, opts) => toolset.call(name, args, opts),

  /** Generation number, and how many flips have happened. */
  generation: () => generation?.n ?? null,
  flips: () => flips,

  /** True once the browser has actually been handed a registration. */
  live: () => Boolean(modelContext()) && Boolean(generation?.registeredWithBrowser),

  /** Why the browser is not being driven, when it is not. */
  why: () => {
    if (!inBrowser) return "not running in a browser";
    if (!mountedInTopLevelDocument) return "not the top-level document — this module refuses to register here";
    if (!document.modelContext) return "document.modelContext is absent: Chromium is missing the WebMCP feature flag, or is too old";
    return "registering";
  },

  onFlip(fn) { flipListeners.add(fn); return () => flipListeners.delete(fn); },
  onCall(fn) { callListeners.add(fn); return () => callListeners.delete(fn); },
  setSignatureProvider,

  /** Recompile now. Callers that mutate the ERP directly do not need this — the
   *  ERP's own change events already drive it. */
  refresh: (reason = "manual") => sync(reason),
};

// ── mount ─────────────────────────────────────────────────────────────────────
if (mountedInTopLevelDocument) {
  globalThis.outpocketTools = registry;

  erp.onChange(({ type }) => sync(type));

  // F1's shell publishes itself on globalThis at module evaluation and re-reads
  // /api/me on load. Subscribing rather than importing keeps this module free of
  // a hard dependency on the shell's evaluation order; if the shell is not there
  // at all, the surface still compiles and still shows S0.
  const shell = globalThis.outpocketShell;
  if (shell?.onSession) shell.onSession(adoptSession);
  else sync("mount");
} else if (inBrowser) {
  // Registering here would silently do nothing while the page looked correct.
  console.warn(
    "outpocket: src/page/register.js was evaluated outside the top-level document. " +
    "No tools were registered — tools registered inside a frame are not discovered.",
  );
}
