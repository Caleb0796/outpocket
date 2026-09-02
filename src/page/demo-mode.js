// src/page/demo-mode.js — node H4.
//
// A demo that runs the same way every time. `?demo=1&seed=N` drives the page
// through a scripted expense filing whose every choice comes from N, so the
// video can be re-shot, a judge can reproduce what they saw, and H4's accept can
// compare two runs byte for byte.
//
// ── WHY SEEDED AND NOT SCRIPTED ──────────────────────────────────────────────
//
// A hard-coded script would also be deterministic, and it would make the accept
// pass while proving nothing about determinism: every run would be identical
// because nothing ever varied, exactly as two empty files diff clean. Deriving
// the choices from the seed means seed 7 and seed 8 produce DIFFERENT state, so
// "the dump is stable" and "the dump is observing anything at all" become two
// separate, separately falsifiable claims. The second is the one that catches a
// broken dump.
//
// ── WHAT IT DRIVES, AND WHAT IT REFUSES TO DRIVE ─────────────────────────────
//
// Sign-in is a HUMAN act in this project — the employee authenticates in the
// page, via company SSO, and no tool can do it. So the demo does not fake a
// session: it clicks the page's own [data-persona] affordance, the same one a
// judge clicks, and waits for the shell to adopt the session. Everything after
// that goes through the TOOL SURFACE (globalThis.outpocketTools), which is the
// same dispatch path a real agent's call takes — through compile.js's double
// lock, output budget and error envelope. A demo that reached into the ERP
// directly would show a filing this system's tools could not actually perform.
//
// It stops at S3 — one clean line, submit_expense_report on the surface, door
// open — and does NOT submit. Submitting needs a human signature (S5's gate),
// and a demo that signed on the human's behalf would be a lie about the one
// property this project exists to demonstrate.
//
// ── HONESTY, THE SAME CONDITION H3 CARRIES ───────────────────────────────────
//
// Demo mode says so on the page. An automated run that looks like a human
// filing is dishonest for the same reason an unlabelled self-driving agent is,
// and this label is cheaper than the argument.

import { LIMITS } from "../policy.js";

const DEMO_FLAG = "demo";
const SEED_PARAM = "seed";

const DEMO_BANNER = Object.freeze({
  start: (seed) => `Automated demo · seed ${seed} · Signing in as Chen… Nothing will be submitted.`,
  working: (seed) => `Automated demo · seed ${seed} · Building and checking a draft… Nothing will be submitted.`,
  complete: (seed) => `Demo complete · seed ${seed} · Clean draft ready to review below. Nothing was submitted; signing still requires you.`,
});

const inBrowser = typeof window !== "undefined" && typeof document !== "undefined";

/** mulberry32 — small, exact, and dependency-free. Same seed, same stream, forever. */
export function makeRng(seed) {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];
const intBetween = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// EVERY LINE MUST BE CLEAN, AND THE BINDING CONSTRAINT IS NOT THE ONE YOU EXPECT.
// The per-category caps are generous (TRANSPORT_PER_LINE 150_00, SUPPLIES_PER_LINE
// 200_00, MEAL_PER_PERSON 80_00) — but RECEIPT_REQUIRED_AT is 25_00, and a line at
// or above it needs a LINKED RECEIPT. Receipts are attached by the human in the
// page; no tool can do it, and the demo must not pretend otherwise. So the real
// ceiling is one cent below RECEIPT_REQUIRED_AT.
//
// MEASURED: the first working version of this demo drew amounts up to $90 and
// landed on S2 with RECEIPT_REQUIRED blocking two of three lines. It would have
// been a stable dump, and a wrong one.
//
// The ceiling is DERIVED from src/policy.js, never typed. A cap that moves must
// not silently start producing violations — that is how an assertion goes vacuous
// with nobody editing it, and it is the same rule drive.mjs follows when it
// derives its deliberate violation from LIMITS instead of hard-coding 250.
const CEILING = LIMITS.RECEIPT_REQUIRED_AT - 1;
const clamp = (hi) => Math.min(hi, CEILING);

const CATALOGUE = [
  { merchant: "City Cab Co.",     category: "transport", lo:  6_00, hi: clamp(60_00), description: "Airport transfer" },
  { merchant: "Meridian Rail",    category: "transport", lo:  8_00, hi: clamp(90_00), description: "Rail to site" },
  { merchant: "Harbour Deli",     category: "meals",     lo:  9_00, hi: clamp(42_00), description: "Working lunch" },
  { merchant: "Corner Press",     category: "supplies",  lo:  7_00, hi: clamp(80_00), description: "Print run" },
  { merchant: "Dockside Coffee",  category: "meals",     lo:  6_00, hi: clamp(28_00), description: "Client coffee" },
  { merchant: "Wharf Stationers", category: "supplies",  lo: 11_00, hi: clamp(65_00), description: "Notebooks" },
];

const TITLES = [
  "Client visit — Portland",
  "Site inspection — Heron",
  "Vendor review — Falcon",
  "Quarterly audit prep",
];

/** The whole plan, decided up front from the seed. Pure: no clock, no DOM, no I/O. */
export function planFor(seed, { daysAgo }) {
  const rng = makeRng(seed);
  const title = pick(rng, TITLES);
  const lineCount = intBetween(rng, 1, 3);
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    const item = pick(rng, CATALOGUE);
    const cents = intBetween(rng, item.lo, item.hi);
    // Inside DATE_WINDOW_DAYS (90) with room to spare, so no line is ever stale.
    const offset = intBetween(rng, 3, 40);
    lines.push({
      date: daysAgo(offset),
      merchant: item.merchant,
      category: item.category,
      amount: (cents / 100).toFixed(2),
      currency: "USD",
      description: item.description,
      ...(item.category === "meals" ? { attendees: intBetween(rng, 1, 3) } : {}),
    });
  }
  return { seed, title, lines };
}

/**
 * Read the chargeable projects out of get_session_scope's own answer and choose
 * one by seed. Same parse drive.mjs uses for the flip walk, and the same rule:
 * anything marked CLOSED is skipped.
 */
export function pickProject(scopeText, rng) {
  const m = /Chargeable projects:\s*([^.]*)/i.exec(scopeText ?? "");
  if (!m) return null;
  const open = [];
  for (const entry of m[1].split(";")) {
    if (/CLOSED/i.test(entry)) continue;
    const code = /([A-Z][A-Z0-9_-]{2,})/.exec(entry.trim());
    if (code) open.push(code[1]);
  }
  if (open.length === 0) return null;
  return open[Math.floor(rng() * open.length)];
}

function qs() {
  try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); }
}

export function readDemoParams(search = qs()) {
  const on = search.get(DEMO_FLAG) === "1";
  const rawSeed = search.get(SEED_PARAM);
  const parsed = Number.parseInt(rawSeed ?? "", 10);
  return { on, seed: Number.isFinite(parsed) ? parsed : 0, seedWasGiven: rawSeed !== null };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeoutMs = 15000, everyMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let v = null;
    try { v = fn(); } catch { v = null; }
    if (v) return v;
    if (Date.now() > deadline) return null;
    await sleep(everyMs);
  }
}

/**
 * The banner is a progress witness, not merely a disclosure label.
 *
 * The old implementation wrote one "running" sentence and never touched it
 * again, so a finished S3 draft and a stalled sign-in were visually identical.
 * These three phases are deliberately complete sentences: a still frame says
 * what the automation is doing, whether it has finished, and that no submission
 * occurred. The final write happens before `done`, making the harness's settled
 * bit and the sentence a single observable state rather than a race.
 */
export function demoBannerText(seed, phase = "start") {
  return (DEMO_BANNER[phase] ?? DEMO_BANNER.start)(seed);
}

export function labelAsDemo(doc, seed, phase = "start") {
  try {
    const b = doc && doc.getElementById("agent-banner");
    if (!b) return false;
    b.textContent = demoBannerText(seed, phase);
    return true;
  } catch { /* a label is not worth failing a demo over */ }
  return false;
}

/**
 * Run the scripted filing through the page's own tool surface.
 * Returns a transcript. Never throws: a failed step is recorded and the run
 * continues, so the dump shows how far it got instead of vanishing.
 */
export async function runDemo({ seed, tools, shell, doc }) {
  const steps = [];
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // A CALL THAT RETURNED IS NOT A CALL THAT WORKED, and this is the one place
  // that mistake is easy to make here. compile.js's `toolset.call` NEVER THROWS
  // for the two failures that matter: an unknown tool comes back as a normal
  // content block reading `No tool named "x" exists on the current surface`, and
  // a refused action comes back as `Error [CODE]: ...` through the error
  // envelope. Both are ok() blocks. A try/catch around this therefore reports
  // ok:true for a demo that did nothing at all — MEASURED: the first run of this
  // module recorded 7/7 steps green while creating no report, because the
  // project argument was missing and every later tool was off the surface. That
  // is a derived boolean disagreeing with the raw text it came from.
  //
  // So a step is graded on TWO things it cannot fake: the tool was actually on
  // the surface when called, and the returned text is not an envelope.
  const isErrorText = (t) =>
    typeof t === "string" && (/^Error \[[A-Z_]+\]:/.test(t) || /^No tool named "/.test(t));

  // Each step is timed INDIVIDUALLY. H6 rehearses this flow and its whole value
  // is being able to say WHICH step is slow before it becomes a 120-second
  // problem in front of a judge; one total divided by six is not a timing.
  //
  // `ms` deliberately never reaches harness/dump-state.mjs — drive.mjs's read
  // projects each step to {tool, ok} only. A duration in the dump would make it
  // vary run to run and would break H4's accept, which is a byte-for-byte diff
  // of two runs at the same seed. Timings travel on their own channel.
  const call = async (name, args) => {
    const t0 = now();
    const onSurface = tools.names().includes(name);
    if (!onSurface) {
      steps.push({ tool: name, ok: false, ms: Math.round(now() - t0),
        text: `not on the surface at ${tools.state()}; present: ${tools.names().join(", ")}` });
      return { ok: false };
    }
    try {
      const res = await tools.executeTool(name, args ?? {}, { source: "agent" });
      const text = res?.content?.[0]?.text ?? null;
      const ok = !isErrorText(text);
      steps.push({ tool: name, ok, ms: Math.round(now() - t0), text });
      return { ok, text };
    } catch (e) {
      steps.push({ tool: name, ok: false, ms: Math.round(now() - t0), text: String((e && e.message) || e) });
      return { ok: false };
    }
  };

  // 1 — sign in the way a human does. Not a tool, and not faked.
  const tSignIn = now();
  const btn = doc.querySelector('[data-persona="chen"]');
  if (btn) {
    btn.click();
    await waitFor(() => tools.state() !== "S0", { timeoutMs: 10000 });
  }
  if (tools.state() === "S0") {
    steps.push({ tool: "(sign-in)", ok: false, ms: Math.round(now() - tSignIn),
      text: "no session — [data-persona] missing or not wired" });
    return { steps, reachedState: tools.state() };
  }
  steps.push({ tool: "(sign-in)", ok: true, ms: Math.round(now() - tSignIn),
    text: "signed in via the page's own [data-persona] affordance" });
  labelAsDemo(doc, seed, "working");

  // 2 — the plan, decided entirely by the seed.
  const erpNow = () => tools.erp.now();
  const daysAgo = (n) => {
    const t = erpNow();
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const plan = planFor(seed, { daysAgo });

  // THE PROJECT IS DISCOVERED, NOT TYPED, and a CLOSED one is skipped. Charging a
  // closed project is itself a blocking violation (PROJECT_INACTIVE), and an
  // out-of-scope one is refused outright (PROJECT_SCOPE) — either would fail the
  // filing for a reason that has nothing to do with the seed. A hard-coded code
  // would also rot silently the moment server/personas.json moves.
  const scope = await call("get_session_scope", {});
  const project = pickProject(scope.text, makeRng(seed + 1));
  if (!project) {
    steps.push({ tool: "(pick-project)", ok: false, text: `no open project in scope: ${scope.text ?? "(no scope text)"}` });
    return { steps, plan, reachedState: tools.state() };
  }
  plan.project = project;

  await call("create_expense_report", { title: plan.title, project });
  for (const line of plan.lines) await call("add_expense_line", line);
  await call("validate_expense_report", {});

  // Deliberately no submit_expense_report. See the header.
  return { steps, plan, reachedState: tools.state() };
}

// ── mount ────────────────────────────────────────────────────────────────────
export const demoMode = {
  readDemoParams, planFor, runDemo, makeRng, labelAsDemo, demoBannerText, pickProject,
};

if (inBrowser) {
  globalThis.outpocketDemo = demoMode;
  const params = readDemoParams();
  demoMode.params = params;

  if (params.on) {
    labelAsDemo(document, params.seed);
    // A promise the harness can await, so --dump-state reads settled state
    // rather than racing the demo. `done` is set last, so a reader that polls
    // for it can never observe a half-finished filing.
    demoMode.ready = (async () => {
      const tools = await waitFor(() => globalThis.outpocketTools);
      if (!tools) {
        demoMode.result = { steps: [], error: "globalThis.outpocketTools never appeared — src/page/register.js did not mount" };
        demoMode.done = true;
        return demoMode.result;
      }
      await waitFor(() => globalThis.outpocketShell, { timeoutMs: 5000 });
      const result = await runDemo({
        seed: params.seed, tools, shell: globalThis.outpocketShell, doc: document,
      });
      demoMode.result = result;
      labelAsDemo(document, params.seed, "complete");
      demoMode.done = true;
      return result;
    })();
  }
}
