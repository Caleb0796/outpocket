// harness/rehearse.mjs — node H6.
//
//   node harness/rehearse.mjs --runs 5
//   node harness/rehearse.mjs --runs 5 --break-run 3     (prove the rig can fail)
//
// Runs the demo unattended, N times, and writes evidence/rehearsal.json. D4 — the
// one-take video — depends on this, because you cannot shoot one take of a flow
// that has never survived five unattended runs.
//
// ═════════════════════════════════════════════════════════════════════════════
// THIS NODE'S PREDICATE IS THE WEAKEST ONE THIS SEAT HAS BEEN GIVEN
// ═════════════════════════════════════════════════════════════════════════════
//
// "5 of 5 passes, each under 120 seconds, with per-step timings" is satisfied
// PERFECTLY by a rig that starts and stops. A rehearsal that does nothing passes
// five times, finishes in milliseconds, and writes timings for steps that never
// ran. Every clause is green and nothing was rehearsed.
//
// So the job here was never "make it green". It was "make 5/5 mean something",
// and the rule this seat drew on H4 is the one it is built from:
//
//     WHEN A CHECK REPORTS SUCCESS, ASK WHAT IT WOULD HAVE PRINTED HAD IT
//     FAILED. IF THE ANSWER IS "THE SAME THING", THE CHECK IS NOT A CHECK.
//
// Applied to the pass counter itself, that forbids the obvious implementation. A
// run must NOT be counted as a pass because nothing threw. In this repo the
// error path RETURNS NORMALLY BY DESIGN — compile.js's toolset.call hands back a
// readable content block for an unknown tool and an error envelope for a refusal,
// which is right for an agent and a trap for a harness. This seat was caught by
// exactly that on H4: seven `ok` flags sitting on top of a demo that had created
// no report.
//
// A run therefore passes only if it REACHED THE STATE IT CLAIMS:
//
//   1. the subprocess exited 0;
//   2. the dump PARSES;
//   3. harness/dump-state.mjs accepted it — the same observer H4 is graded on,
//      not a second one written here, so its E_EMPTY_DUMP and E_DEMO_INCOMPLETE
//      guards apply to every rehearsal run for free;
//   4. the surface reached S3;
//   5. a report exists that is NOT the pre-seeded archive RP-1017, with at least
//      one line and no blocking policy violation.
//
// Clause 5 is the one that catches the interesting failure. The archive report is
// present in EVERY run from boot, so "a report exists" is true of a run that did
// nothing at all — that is the empty-input trap wearing the shape of this node.
//
// ═════════════════════════════════════════════════════════════════════════════
// WHAT FIVE RUNS DO NOT PROVE — written here rather than left to be inferred
// ═════════════════════════════════════════════════════════════════════════════
//
// This is a rehearsal of a SEEDED, DETERMINISTIC demo. It is NOT evidence of
// flake resistance under varying input, because the demo's input is a seed and
// the state it produces is fixed by that seed. What five runs actually establish
// is narrower and still worth having: the flow completes end to end without a
// human, it completes well inside the time budget, the same seed produces the
// same filing on repeat, and nothing in the stack leaks between runs.
//
// Each run uses a DIFFERENT seed, because varying them is free and it converts
// "the demo works" from a claim about one filing into a claim about five
// different ones — different titles, line counts, merchants, amounts and dates.
// That is still not flake resistance. It is coverage of the demo's own input
// space, which is a smaller and honest claim.
//
// NOT rehearsed here, and named so nobody infers it: the ChatGPT built-in
// browser (this drives plain Chrome over CDP), the deployed origin (this boots
// its own server on 127.0.0.1), and the human beats of the video — sign-in is
// clicked by the rig, and signing is never performed at all.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BUDGET_MS = 120_000;

const err = (s) => process.stderr.write(s + "\n");

// ── the server, booted here ──────────────────────────────────────────────────
// The accept runs `node harness/rehearse.mjs --runs 5` with no $URL, so this
// brings its own origin up exactly as S1/S9 do — server/index.mjs IMPORTED, never
// a second copy of the routes. 127.0.0.1 and not a LAN address: MEASURED, the
// page API is silently `undefined` on 192.168.x.x and .local.
async function serveApp() {
  const { createHttpServer } = await import(resolve(REPO, "server", "index.mjs"));
  const server = createHttpServer();
  await new Promise((res, rej) => { server.once("error", rej); server.listen(0, "127.0.0.1", res); });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

function runDrive(url, { extraArgs = [] } = {}) {
  return new Promise((res) => {
    const t0 = Date.now();
    const child = spawn(process.execPath,
      [join(REPO, "harness", "drive.mjs"), "--url", url, "--dump-state", ...extraArgs],
      { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", errOut = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { errOut += d; });
    child.on("close", (code) => res({ code, out, errOut, ms: Date.now() - t0 }));
  });
}

/** The per-step timings drive.mjs writes as one labelled JSON line on stderr. */
function parseTimings(errOut) {
  const line = errOut.split("\n").find((l) => l.startsWith("drive: timings "));
  if (!line) return null;
  try { return JSON.parse(line.slice("drive: timings ".length)); } catch { return null; }
}

/**
 * Grade one run on OBSERVED END STATE. Returns { pass, code, why, ... }.
 * `code` is null on a pass and a named failure code otherwise, so a red run in
 * evidence/rehearsal.json says what went wrong rather than only that it did.
 */
function grade(run, dump) {
  if (run.code !== 0) {
    const named = /drive: ([A-Z_]+) —/.exec(run.errOut);
    return { pass: false, code: named ? named[1] : "E_DRIVE_EXIT", why: `drive.mjs exited ${run.code}` };
  }
  if (!dump) return { pass: false, code: "E_UNPARSEABLE_DUMP", why: "stdout was not JSON" };

  const reached = dump.demo?.reachedState ?? null;
  if (reached !== "S3") {
    return { pass: false, code: "E_NOT_S3", why: `the surface reached ${reached}, not S3` };
  }

  // NOT "a report exists" — the pre-seeded archive RP-1017 is present from boot,
  // so that clause is true of a run that did nothing. The filing has to be new.
  const filed = (dump.state?.reports ?? []).filter((r) => r.id !== "RP-1017");
  if (filed.length === 0) {
    return { pass: false, code: "E_NO_FILING",
      why: "the only report present is the pre-seeded archive RP-1017 — nothing was filed" };
  }
  const lines = filed.reduce((n, r) => n + (r.lines?.length ?? 0), 0);
  if (lines === 0) return { pass: false, code: "E_NO_LINES", why: `${filed[0].id} has no lines` };

  const blocking = dump.verdict?.blocking ?? null;
  if (blocking !== 0) {
    return { pass: false, code: "E_NOT_CLEAN", why: `the filing has ${blocking} blocking violation(s)` };
  }
  return { pass: true, code: null, reportId: filed[0].id, lines, blocking };
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * --selftest: prove every grading clause can FAIL.
 *
 * --break-run proves the rig notices a broken subprocess, which is the EASY
 * half — it only exercises the exit-code path. The clauses that carry the real
 * weight (E_NO_FILING, E_NOT_S3, E_NOT_CLEAN) sit behind dump-state.mjs's own
 * E_DEMO_INCOMPLETE guard and cannot be reached through a live run at all, so a
 * live run can never show them working. Unexercised branches in a grader are
 * indistinguishable from branches that do not work.
 *
 * The RP-1017 case is the one worth staring at: a dump containing ONLY the
 * pre-seeded archive report is what a rehearsal that did nothing produces, and
 * it is well-formed, parses cleanly, and would sail past "a report exists".
 */
function selftest() {
  const ok = (extra = {}) => ({
    demo: { reachedState: "S3" },
    state: { reports: [{ id: "RP-1017", lines: [{ id: "ln_a1" }] }, { id: "RP-1018", lines: [{ id: "ln_1" }] }] },
    verdict: { blocking: 0 },
    ...extra,
  });
  const R0 = { code: 0, out: "", errOut: "" };
  const cases = [
    ["a real filing passes",             R0, ok(), true, null],
    ["subprocess exit != 0 fails",       { code: 1, errOut: "" }, ok(), false, "E_DRIVE_EXIT"],
    ["a named drive error is carried",   { code: 1, errOut: "drive: E_DEMO_INCOMPLETE — x" }, ok(), false, "E_DEMO_INCOMPLETE"],
    ["unparseable stdout fails",         R0, null, false, "E_UNPARSEABLE_DUMP"],
    ["stopping short of S3 fails",       R0, { ...ok(), demo: { reachedState: "S2" } }, false, "E_NOT_S3"],
    ["ONLY the pre-seeded archive fails", R0,
      { demo: { reachedState: "S3" }, state: { reports: [{ id: "RP-1017", lines: [{ id: "ln_a1" }] }] }, verdict: { blocking: 0 } },
      false, "E_NO_FILING"],
    ["a filing with no lines fails",     R0,
      { demo: { reachedState: "S3" }, state: { reports: [{ id: "RP-1018", lines: [] }] }, verdict: { blocking: 0 } },
      false, "E_NO_LINES"],
    ["a blocking violation fails",       R0, { ...ok(), verdict: { blocking: 2 } }, false, "E_NOT_CLEAN"],
  ];
  let bad = 0;
  for (const [name, run, dump, wantPass, wantCode] of cases) {
    const g = grade(run, dump);
    const good = g.pass === wantPass && g.code === wantCode;
    if (!good) bad++;
    process.stdout.write(`${good ? "ok  " : "FAIL"}  ${name} -> pass=${g.pass} code=${g.code}\n`);
  }
  process.stdout.write(bad === 0 ? "selftest: all green\n" : `selftest: ${bad} failure(s)\n`);
  return bad === 0 ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
  if (argv.includes("--selftest")) return selftest();
  const runs = Number(at("--runs", "5"));
  // --break-run N points run N at a URL with no ?demo=1, so the rig has to
  // report a failure. Not a test hook that stubs the grader: it breaks the RUN
  // and lets the ordinary grading path notice, which is the only version of this
  // that proves anything.
  const breakRun = at("--break-run", null) === null ? null : Number(at("--break-run", null));
  if (!Number.isInteger(runs) || runs < 1) { err("rehearse: --runs must be a positive integer"); return 2; }

  const app = await serveApp();
  err(`rehearse: server on ${app.origin}; ${runs} run(s), budget ${BUDGET_MS / 1000}s each` +
      (breakRun ? `; run ${breakRun} DELIBERATELY BROKEN` : ""));

  const results = [];
  try {
    for (let i = 1; i <= runs; i++) {
      // A different seed per run. Free, and it makes five runs five different
      // filings rather than the same one five times.
      const seed = 6 + i;
      const broken = breakRun === i;
      const url = broken ? `${app.origin}/` : `${app.origin}/?demo=1&seed=${seed}`;

      const r = await runDrive(url);
      let dump = null;
      try { dump = JSON.parse(r.out); } catch { dump = null; }
      const verdict = grade(r, dump);
      const steps = parseTimings(r.errOut) ?? [];

      results.push({
        run: i, seed: broken ? null : seed, url,
        deliberatelyBroken: broken || undefined,
        pass: verdict.pass,
        failureCode: verdict.code,
        why: verdict.why ?? undefined,
        wallMs: r.ms,
        withinBudget: r.ms < BUDGET_MS,
        reportId: verdict.reportId ?? null,
        lines: verdict.lines ?? null,
        blockingViolations: verdict.blocking ?? null,
        steps,
      });
      err(`rehearse: run ${i}/${runs} seed ${broken ? "(broken)" : seed} — ` +
          `${verdict.pass ? "PASS" : "FAIL " + verdict.code} in ${(r.ms / 1000).toFixed(1)}s`);
    }
  } finally {
    await app.close();
  }

  const passes = results.filter((r) => r.pass);
  const overBudget = results.filter((r) => !r.withinBudget);

  // Per-step aggregate across runs: which step is the slow one, before it
  // becomes a 120-second problem in front of a judge.
  const byStep = new Map();
  for (const r of results) {
    for (const s of r.steps) {
      if (typeof s.ms !== "number") continue;
      if (!byStep.has(s.tool)) byStep.set(s.tool, []);
      byStep.get(s.tool).push(s.ms);
    }
  }
  const stepStats = [...byStep.entries()]
    .map(([tool, ms]) => ({ tool, samples: ms.length, medianMs: median(ms), maxMs: Math.max(...ms) }))
    .sort((a, b) => b.medianMs - a.medianMs);

  const doc = {
    node: "H6",
    rehearsal: "outpocket.rehearsal/1",
    observedAt: new Date().toISOString(),

    whatFiveRunsProve:
      "The seeded demo completes end to end, unattended, five times, well inside the 120-second " +
      "budget, on five DIFFERENT seeds — so five different filings, not the same one five times.",
    whatFiveRunsDoNotProve:
      "NOT flake resistance. This is a seeded deterministic demo: the input never varies except by " +
      "seed, and the state each seed produces is fixed. Varying the seed covers the demo's own input " +
      "space; it does not simulate a hostile network, a slow machine, a different browser, or a human " +
      "doing something unexpected. Also NOT rehearsed: the ChatGPT built-in browser (this drives plain " +
      "Chrome over CDP), the deployed origin (this boots its own server on 127.0.0.1), and the human " +
      "beats of the video — sign-in is clicked by the rig and signing is never performed at all.",

    howARunIsGraded:
      "On OBSERVED END STATE, never on the absence of a throw. In this repo the error path returns " +
      "normally by design, so a run that failed every tool call still exits 0 with readable text. A run " +
      "passes only if: drive.mjs exited 0; the dump parsed; harness/dump-state.mjs accepted it (the same " +
      "observer H4 is graded on, so E_EMPTY_DUMP and E_DEMO_INCOMPLETE apply here for free); the surface " +
      "reached S3; and a report OTHER THAN the pre-seeded archive RP-1017 exists with at least one line " +
      "and zero blocking violations. That last clause matters: RP-1017 is present from boot, so " +
      "\"a report exists\" is true of a run that did nothing.",

    runs: results.length,
    passes: passes.length,
    summary: `${passes.length} of ${results.length} passes`,
    budgetMs: BUDGET_MS,
    allWithinBudget: overBudget.length === 0,
    slowestRunMs: Math.max(...results.map((r) => r.wallMs)),
    medianRunMs: median(results.map((r) => r.wallMs)),

    perStep: stepStats,
    slowestStep: stepStats[0] ?? null,

    results,
  };

  // --out exists for ONE caller: the deliberately-broken proving run. That run
  // must not overwrite evidence/rehearsal.json, which is this node's record of a
  // real rehearsal — a 4-of-5 sitting in the evidence file would misreport the
  // build's actual state to anyone reading it later.
  const outPath = at("--out", null) ?? join(REPO, "evidence", "rehearsal.json");
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
  err(`rehearse: wrote ${outPath} — ${doc.summary}` +
      (stepStats[0] ? `; slowest step ${stepStats[0].tool} median ${stepStats[0].medianMs}ms` : ""));

  if (passes.length !== results.length) { err("rehearse: not every run passed"); return 1; }
  if (overBudget.length) { err(`rehearse: ${overBudget.length} run(s) over the ${BUDGET_MS}ms budget`); return 1; }
  return 0;
}

main().then((c) => process.exit(c), (e) => { err(`rehearse: ${e.stack || e.message}`); process.exit(1); });
