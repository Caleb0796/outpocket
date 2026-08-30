// harness/dump-state.mjs — node H4.
//
// Turns the page's live ERP state into a byte-stable JSON document, so two runs
// of the same seeded demo can be compared with `diff` and disagree ONLY when the
// state genuinely differs.
//
// ─────────────────────────────────────────────────────────────────────────────
// READ THE PREDICATE AS AN ADVERSARY FIRST. H4's accept is
//
//     drive --dump-state > a.json && drive --dump-state > b.json && diff a b
//
// and `diff` exits 0 on two EMPTY files. It exits 0 on two copies of `{}`. It
// exits 0 on a dump that faithfully records a version string and a timestamp and
// nothing the seed can reach. Every one of those is a green node that proved
// nothing, and that shape has cost this sprint more than every other bug
// combined. So this file is built to make the dump FALSIFIABLE:
//
//   * it refuses to emit a dump with no report and no day-book entry, because a
//     demo that did nothing is the single most likely way to pass this predicate
//     while observing nothing (`E_EMPTY_DUMP`);
//   * it carries `coverage` counts — reports, lines, receipts, day-book entries,
//     policy violations — so a reader can see at a glance whether the dump
//     reaches the ledger, or only its own header;
//   * it never invents a canonicaliser. src/canonical.js (OCF-1, node S11) is
//     the one in this project and `canon()` below is imported from it, so the
//     dump and the server's /api/state-digest cannot disagree about what
//     canonical means.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE NORMALISATION LIST IS A CLAIM ABOUT THE SYSTEM, SO IT IS IN THE OPEN.
//
// It is not hidden in a filter and it is not silent: every dump carries a
// `normalized` block naming what was rewritten, how many values, and why. Two
// rules, and only two:
//
//   1. FULL ISO INSTANTS ("2026-08-29T22:41:27.875Z") -> "<instant>".
//      These come from `now().toISOString()` in src/erp.js — day-book `ts`,
//      `createdAt`, `submittedAt`, `signature.at`. They differ between two runs
//      milliseconds apart and carry no information the array order does not.
//      The COUNT is reported, so a demo that stopped writing day-book entries
//      changes the dump even though each value is normalised.
//
//   2. DATE-ONLY STRINGS ("2026-08-15") -> "T-14", relative to the dump's own
//      reference date.
//      These are NOT dropped, because the seed reaches them: the demo picks line
//      dates by seeded offset, so seed 7 and seed 8 differ here and that
//      difference must stay visible. Relativising instead of excluding also
//      fixes a bug that would otherwise have detonated unattended: the policy's
//      DATE_WINDOW_DAYS is 90, so every date in this system is anchored to
//      "today" (src/erp.js daysAgoIso). An absolute date makes the dump change
//      at MIDNIGHT for reasons having nothing to do with the state — and the
//      judging window (2026-09-04 -> 09-21) is unattended and spans 17 of them.
//      Against a reference captured in the same read, the stored date and the
//      reference move together and the relative form does not move at all.
//
// Nothing else is touched. Ids, amounts, currencies, merchants, categories,
// statuses, counters, receipt hashes, policy violation codes and severities all
// appear verbatim — they are the state a judge cares about, and they are exactly
// what the seed must be able to move.

import { canon } from "../src/canonical.js";

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const INSTANT_PLACEHOLDER = "<instant>";

export class DumpError extends Error {
  constructor(code, message) { super(message); this.name = "DumpError"; this.code = code; }
}

/** Whole days from `date` back to `reference`, both YYYY-MM-DD. */
function daysBefore(dateStr, referenceStr) {
  const [ay, am, ad] = dateStr.split("-").map(Number);
  const [by, bm, bd] = referenceStr.split("-").map(Number);
  // UTC midnights on both sides: no timezone, no DST, no clock.
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

/**
 * Walk the state, applying the two rules above. Returns the rewritten value and
 * the tally, so the caller can put the tally in the dump rather than trusting it.
 */
function normalize(value, referenceDate, tally, path = "") {
  if (typeof value === "string") {
    if (INSTANT.test(value)) {
      tally.instants.push(path);
      return INSTANT_PLACEHOLDER;
    }
    if (DATE_ONLY.test(value)) {
      tally.dates.push(path);
      const n = daysBefore(value, referenceDate);
      return n === 0 ? "T-0" : n > 0 ? `T-${n}` : `T+${-n}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => normalize(v, referenceDate, tally, `${path}/${i}`));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = normalize(value[k], referenceDate, tally, `${path}/${k}`);
    return out;
  }
  return value;
}

function countLines(reports) {
  return reports.reduce((n, r) => n + (Array.isArray(r.lines) ? r.lines.length : 0), 0);
}

/**
 * dumpState(raw) -> a plain object ready to be serialised.
 *
 * `raw` is what harness/drive.mjs reads out of the page:
 *   { seed, referenceDate, state, verdict }
 * `state` is src/erp.js's live state object; `verdict` is the policy engine's
 * answer for the open report, carried alongside because it is DERIVED state a
 * judge cares about and it is not reachable by walking `state` alone.
 */
export function dumpState(raw) {
  if (!raw || typeof raw !== "object") throw new DumpError("E_NO_INPUT", "no state object was read from the page");
  const { seed, referenceDate, state, verdict = null, demo = null } = raw;

  if (typeof referenceDate !== "string" || !DATE_ONLY.test(referenceDate)) {
    throw new DumpError("E_NO_REFERENCE",
      `referenceDate must be a YYYY-MM-DD string read from the page in the same pass as the state; got ${JSON.stringify(referenceDate)}`);
  }
  if (!state || typeof state !== "object") throw new DumpError("E_NO_STATE", "the page exposed no ERP state");

  const reports = Array.isArray(state.reports) ? state.reports : [];
  const receipts = Array.isArray(state.receipts) ? state.receipts : [];
  const dayBook = Array.isArray(state.dayBook) ? state.dayBook : [];

  const coverage = {
    reports: reports.length,
    lines: countLines(reports),
    receipts: receipts.length,
    dayBookEntries: dayBook.length,
    policyViolations: Array.isArray(verdict?.violations) ? verdict.violations.length : 0,
    openReportId: state.openReportId ?? null,
    signedInAs: state.session?.id ?? null,
  };

  // THE GUARD THAT MAKES THE PREDICATE MEAN SOMETHING. An empty dump is the
  // cheapest way to pass `diff`, so it is refused here rather than being emitted
  // twice and compared successfully. A demo that never ran, a page that never
  // mounted the module, a URL without ?demo=1 — all land here, loudly, instead
  // of exiting 0 with a straight face.
  if (coverage.reports === 0 && coverage.dayBookEntries === 0) {
    throw new DumpError("E_EMPTY_DUMP",
      "the dump has no reports and no day-book entries — there is no state to compare. " +
      "Two of these would diff clean and prove nothing. Check that the page mounted " +
      "src/page/demo-mode.js and that the URL carried ?demo=1.");
  }

  // AND THE SAME TRAP ONE STEP FURTHER IN. A demo that signed in and then failed
  // every tool call leaves a NON-empty dump — the pre-seeded archive report and a
  // sign-in day-book entry are already there — and two of those diff clean just
  // as happily. MEASURED: the first run of this node did exactly that, reporting
  // 7/7 steps green while creating no report, because `create_expense_report` was
  // missing its `project` argument and every later tool was off the surface.
  // Exit 0 twice, identical files, nothing observed.
  //
  // So the dump also refuses a demo that did not finish: every step must have
  // succeeded, and the filing must have reached S3 — one clean line, the submit
  // door open. That end state is the demo's whole point and it is not optional.
  if (demo) {
    const failed = (demo.steps ?? []).filter((s) => s.ok === false);
    if (failed.length) {
      throw new DumpError("E_DEMO_INCOMPLETE",
        `${failed.length} demo step(s) failed (${failed.map((s) => s.tool).join(", ")}). ` +
        "A half-run demo still produces a stable dump — the pre-seeded archive report is always " +
        "there — so two of them would diff clean while observing nothing. Fix the demo, not the dump.");
    }
    if (demo.reachedState && demo.reachedState !== "S3") {
      throw new DumpError("E_DEMO_INCOMPLETE",
        `the demo stopped at ${demo.reachedState}, not S3. S3 is one clean line with the submit door ` +
        "open, which is the state this demo exists to reach; anything earlier means the filing did not happen.");
    }
  }

  const tally = { instants: [], dates: [] };
  const normalizedState = normalize({ ...state }, referenceDate, tally, "/state");
  const normalizedVerdict = verdict === null ? null : normalize(verdict, referenceDate, tally, "/verdict");

  return {
    dump: "outpocket.demo-state/1",
    seed,
    demo,
    coverage,
    // The claim, in the open: what was rewritten, how much of it, and why.
    normalized: {
      instants: {
        rule: "full ISO-8601 instants -> \"<instant>\"",
        why: "now().toISOString() in src/erp.js; differs between two runs milliseconds apart and carries nothing the array order does not",
        count: tally.instants.length,
        paths: tally.instants,
      },
      dates: {
        rule: "date-only strings -> \"T-<days before the reference date>\"",
        why: "relativised, NOT excluded: the seed picks line dates by offset so this is seed-visible state, and relative form keeps the dump stable across midnight, which matters because the judging window is unattended and DATE_WINDOW_DAYS anchors every date to today",
        count: tally.dates.length,
        paths: tally.dates,
      },
      nothingElse: "ids, amounts, currencies, merchants, categories, statuses, counters, receipt hashes and policy violations are verbatim",
    },
    state: normalizedState,
    verdict: normalizedVerdict,
  };
}

/**
 * The bytes written to stdout.
 *
 * OCF-1 via src/canonical.js, so key order is fixed by the canonicaliser and not
 * by JSON.stringify's insertion order — two runs cannot differ because a key
 * arrived in a different order. Pretty-printing is deliberately NOT used: `diff`
 * on one canonical line is exact, and the falsifiability runs re-print with
 * JSON.stringify(…, 2) when a human needs to read the difference.
 */
export function dumpText(raw) {
  return canon(dumpState(raw)) + "\n";
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Reads the raw page read from stdin (or a file) and writes the dump. Kept
// separate from drive.mjs so the transformation can be tested without a browser.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const file = process.argv[2];
  const input = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
  try {
    process.stdout.write(dumpText(JSON.parse(input)));
  } catch (e) {
    process.stderr.write(`dump-state: ${e.code ? e.code + " — " : ""}${e.message}\n`);
    process.exit(1);
  }
}
