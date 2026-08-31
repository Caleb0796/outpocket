// 账房 COUNTINGHOUSE — deterministic expense policy engine.
// Pure module: no DOM, no I/O. The same code runs in the page, in the
// in-page simulated agent, and in `node --test`.
//
// Design rule (drift governance): the policy lives HERE, versioned, served to
// agents via get_expense_policy and enforced on every write. Agents never need
// it in a prompt, and swapping the model never changes what counts as valid.
//
// Node S3 (owner I3), the port of countinghouse/src/policy.js, with two
// required changes (erp/CONTRACTS.md §8): FX becomes integer micro-USD —
// OCF-1 forbids non-integer numbers, so a float rate could never be
// canonicalised the same way by two implementations — and every `fix` string
// is rewritten to pass the x-fixLint substring scan in
// erp/contracts/violation.schema.json.
import { canon, digest } from "./canonical.js";

export const POLICY_VERSION = "2026-08.1";
export const POLICY_EFFECTIVE_FROM = "2026-08-01";

// All money is integer cents. Inputs arrive as decimal `amount` in the
// receipt's currency and are converted once, at the edge.
export const LIMITS = {
  MEAL_PER_PERSON: 80_00, // per attendee per meal
  LODGING_PER_NIGHT: 260_00,
  TRANSPORT_PER_LINE: 150_00,
  SUPPLIES_PER_LINE: 200_00,
  AIRFARE_REVIEW_ABOVE: 1200_00, // warn only
  RECEIPT_REQUIRED_AT: 25_00, // linked receipt required at/above
  MEALS_ITEMIZE_AT: 75_00, // itemization required at/above (meals)
  REPORT_REVIEW_ABOVE: 2000_00, // warn only
  DATE_WINDOW_DAYS: 90,
};

export const CATEGORIES = ["meals", "lodging", "transport", "airfare", "supplies", "other"];

// Integer micro-USD per one unit of the currency (part of the versioned
// policy). usd_cents = round_half_up(amount_cents * micros / 1_000_000),
// computed once at the edge. Was float (EUR: 1.09, JPY: 0.0067) in the spike
// — countinghouse/src/policy.js:28 — which cannot enter a canonical form two
// implementations agree on.
export const FX = { USD: 1_000_000, EUR: 1_090_000, GBP: 1_280_000, CNY: 140_000, JPY: 6_700 };

// Non-reimbursable items, detected deterministically over the agent-declared
// itemization labels (never over free text scanning of receipts — the page
// does not read receipts by design; see threat model in README). Broader than
// the versioned document's non_reimbursable_labels (erp/contracts/policy.schema.json
// examples[0]), which is the closed, published word list; this lexicon also
// catches plurals and specific wine/liquor names the published list does not
// enumerate.
const ALCOHOL_RE =
  /\b(wine|beer|beers|ale|ipa|lager|stout|cocktail|cocktails|alcohol|liquor|whiskey|whisky|bourbon|vodka|gin|rum|tequila|sake|champagne|prosecco|chianti|merlot|cabernet|margarita|martini|spirits)\b/i;

// Verbatim from erp/contracts/policy.schema.json examples[0].non_reimbursable_labels
// — part of the frozen, digested document. Do not reorder or extend.
const NON_REIMBURSABLE_LABELS = [
  "alcohol", "ale", "beer", "bourbon", "champagne", "cocktail", "gin", "ipa",
  "lager", "liquor", "martini", "prosecco", "rum", "sake", "spirits", "stout",
  "tequila", "vodka", "whiskey", "wine",
];

export function toCents(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const scaled = amount * 100;
  const cents = Math.round(scaled + Number.EPSILON * Math.abs(scaled));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function toUsdCents(cents, currency) {
  const micros = FX[currency];
  if (micros === undefined || !Number.isSafeInteger(cents) || cents < 0) return null;
  const rounded = (BigInt(cents) * BigInt(micros) + 500_000n) / 1_000_000n;
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}

export function fmtUsd(cents) {
  if (cents === null || cents === undefined) return "n/a";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function fmtMoney(cents, currency) {
  const abs = Math.abs(cents);
  const body = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return currency === "USD" ? `$${body}` : `${body} ${currency}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return null;
  const [year, month, day] = s.split("-").map(Number);
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())
      || d.getFullYear() !== year
      || d.getMonth() !== month - 1
      || d.getDate() !== day) return null;
  return d;
}

function daysFrom(date, now) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((midnight.getTime() - date.getTime()) / 86_400_000);
}

function v(code, severity, field, message, fix) {
  return { code, severity, field, message, fix };
}

// ── Line validation ────────────────────────────────────────────────
// line: normalized by the ERP core (amountCents, usdCents, currency, category,
//       date, merchant, attendees?, nights?, itemization?[{label,amountCents}],
//       description?, receiptId?)
// ctx:  { now: Date, receiptById: (id)=>receipt|undefined,
//         receiptHashUse: (hash)=>{lineId,reportId}|undefined, lineId, reportId }
export function validateLine(line, ctx) {
  const out = [];
  const push = (...args) => out.push(v(...args));

  // Required fields
  if (!line.merchant) push("MISSING_FIELD", "block", "merchant", "Merchant is missing.", "Provide the merchant name from the receipt.");
  if (!CATEGORIES.includes(line.category))
    push("MISSING_FIELD", "block", "category", `Category must be one of: ${CATEGORIES.join(", ")}.`, "Re-file the line with a valid category.");
  if (line.amountCents === null)
    push("MISSING_FIELD", "block", "amount", "Amount is missing or not a positive number.", "Provide the receipt total as a decimal amount.");

  // Date window
  const d = parseDate(line.date);
  if (!d) {
    push("MISSING_FIELD", "block", "date", "Date is missing or not YYYY-MM-DD.", "Use the receipt date in YYYY-MM-DD form.");
  } else {
    const age = daysFrom(d, ctx.now);
    if (age < 0) push("DATE_FUTURE", "block", "date", `Date ${line.date} is in the future.`, "Use the actual receipt date.");
    else if (age > LIMITS.DATE_WINDOW_DAYS)
      push("DATE_STALE", "block", "date", `Receipt is ${age} days old; the filing window is ${LIMITS.DATE_WINDOW_DAYS} days.`, "Stale expenses need a written exception from the approver — ask the employee.");
  }

  // Currency
  if (line.usdCents === null && line.amountCents !== null)
    push("CURRENCY_UNSUPPORTED", "block", "currency", `Currency ${line.currency} is not in the policy conversion table (${Object.keys(FX).join(", ")}).`, "Re-file in a supported currency.");

  const usd = line.usdCents;
  if (usd !== null && line.amountCents !== null) {
    // Category caps
    if (line.category === "meals") {
      const attendees = line.attendees ?? 1;
      const cap = LIMITS.MEAL_PER_PERSON * attendees;
      if (usd > cap)
        push("CAP_MEALS", "block", "amount",
          `${fmtUsd(usd)} exceeds the meal cap of ${fmtUsd(LIMITS.MEAL_PER_PERSON)} × ${attendees} attendee(s) = ${fmtUsd(cap)}.`,
          "If more people attended, update `attendees` to match the receipt; otherwise reduce the claimed amount.");
      if (usd >= LIMITS.MEALS_ITEMIZE_AT && !(line.itemization?.length))
        push("ITEMIZATION_REQUIRED", "block", "itemization",
          `Meals at/above ${fmtUsd(LIMITS.MEALS_ITEMIZE_AT)} must include the receipt's itemization.`,
          "Update the line with `itemization`: [{label, amount}] transcribed from the receipt.");
    }
    if (line.category === "lodging") {
      const nights = line.nights ?? 1;
      const cap = LIMITS.LODGING_PER_NIGHT * nights;
      if (usd > cap)
        push("CAP_LODGING", "block", "amount",
          `${fmtUsd(usd)} exceeds ${fmtUsd(LIMITS.LODGING_PER_NIGHT)}/night × ${nights} night(s) = ${fmtUsd(cap)}.`,
          "If the stay was longer, update `nights` to match the folio; otherwise reduce the claimed amount.");
    }
    if (line.category === "transport" && usd > LIMITS.TRANSPORT_PER_LINE)
      push("CAP_TRANSPORT", "block", "amount", `${fmtUsd(usd)} exceeds the ${fmtUsd(LIMITS.TRANSPORT_PER_LINE)} per-trip transport cap.`, "A trip above the limit needs a written exception from your approver before it can be filed.");
    if (line.category === "supplies" && usd > LIMITS.SUPPLIES_PER_LINE)
      push("CAP_SUPPLIES", "block", "amount", `${fmtUsd(usd)} exceeds the ${fmtUsd(LIMITS.SUPPLIES_PER_LINE)} supplies cap.`, "Purchases above the cap go through procurement, not expenses.");
    if (line.category === "airfare" && usd > LIMITS.AIRFARE_REVIEW_ABOVE)
      push("AIRFARE_REVIEW", "warn", "amount", `Airfare above ${fmtUsd(LIMITS.AIRFARE_REVIEW_ABOVE)} gets a routing review by the approver.`, "No action needed; noted for the approver.");
  }

  // Itemization checks (declared data only)
  if (line.itemization?.length) {
    const boozy = line.itemization.filter((it) => ALCOHOL_RE.test(it.label));
    if (boozy.length) {
      const total = boozy.reduce((s, it) => s + it.amountCents, 0);
      push("ALCOHOL", "block", "itemization",
        `Alcohol is not reimbursable: ${boozy.map((it) => `"${it.label}" ${fmtUsd(toUsdCents(it.amountCents, line.currency))}`).join(", ")}.`,
        `Remove the alcohol item(s) from the itemization and reduce the claimed amount by ${fmtMoney(total, line.currency)}.`);
    }
    const sum = line.itemization.reduce((s, it) => s + it.amountCents, 0);
    if (line.amountCents !== null) {
      const gap = Math.abs(sum - line.amountCents);
      if (gap > Math.max(200, Math.round(line.amountCents * 0.05)))
        push("ITEMIZATION_GAP", "warn", "itemization",
          `Itemization sums to ${fmtMoney(sum, line.currency)} but the claimed amount is ${fmtMoney(line.amountCents, line.currency)}.`,
          "Transcribe all receipt items (tax and tip included) or correct the amount.");
    }
  }

  // Description
  if (line.category === "other" && !line.description)
    push("DESC_REQUIRED", "block", "description", "Category `other` requires a description of the business purpose.", "Update the line with a one-sentence business purpose.");

  // Receipt evidence
  if (usd !== null && usd >= LIMITS.RECEIPT_REQUIRED_AT) {
    if (!line.receiptId) {
      push("RECEIPT_REQUIRED", "block", "receipt",
        `Lines at/above ${fmtUsd(LIMITS.RECEIPT_REQUIRED_AT)} need a linked receipt. The employee attaches the file in the page; then link it to this line.`,
        "Once a receipt file appears in list_receipts, call link_receipt with this line's id.");
    } else {
      const rc = ctx.receiptById(line.receiptId);
      if (!rc) {
        push("RECEIPT_REQUIRED", "block", "receipt", `Linked receipt ${line.receiptId} no longer exists.`, "Link an existing receipt from list_receipts.");
      } else {
        const use = ctx.receiptHashUse(rc.sha256);
        if (use && !(use.lineId === ctx.lineId && use.reportId === ctx.reportId))
          push("RECEIPT_DUP", "block", "receipt",
            `Receipt ${rc.filename} (sha256 ${rc.sha256.slice(0, 12)}…) is already backing line ${use.lineId} on report ${use.reportId}.`,
            "Each receipt backs exactly one line. Link a different receipt or remove the duplicate line.");
      }
    }
  }

  return out;
}

// ── Report validation ──────────────────────────────────────────────
// report: { id, project, lines[] } — session: persona of the report owner.
export function validateReport(report, session, ctx) {
  const reportViolations = [];
  const lineViolations = new Map();

  if (!report.lines.length)
    reportViolations.push(v("EMPTY_REPORT", "block", "lines", "The report has no expense lines.", "Add at least one line."));

  const project = session?.projects?.find((p) => p.code === report.project);
  if (!project)
    reportViolations.push(v("PROJECT_SCOPE", "block", "project", `Project ${report.project} is not in ${session?.name ?? "this employee"}'s scope.`, "Re-create the report against a project from get_session_scope."));
  else if (!project.active)
    reportViolations.push(v("PROJECT_INACTIVE", "block", "project", `Project ${project.code} (${project.name}) is closed and no longer accepts charges.`, "Re-create the report against an active project."));

  // First-linked-wins map for duplicate receipt detection, deterministic in line order.
  const firstUse = new Map();
  for (const line of report.lines) {
    if (!line.receiptId) continue;
    const rc = ctx.receiptById(line.receiptId);
    if (rc && !firstUse.has(rc.sha256)) firstUse.set(rc.sha256, { lineId: line.id, reportId: report.id });
  }
  const hashUse = (hash) => ctx.priorHashUse?.(hash) ?? firstUse.get(hash);

  let totalUsd = 0;
  for (const line of report.lines) {
    const vs = validateLine(line, { ...ctx, lineId: line.id, reportId: report.id, receiptHashUse: hashUse });
    lineViolations.set(line.id, vs);
    if (line.usdCents !== null) totalUsd += line.usdCents;
  }

  if (totalUsd > LIMITS.REPORT_REVIEW_ABOVE)
    reportViolations.push(v("REPORT_REVIEW", "warn", "total", `Report total ${fmtUsd(totalUsd)} is above ${fmtUsd(LIMITS.REPORT_REVIEW_ABOVE)}; the approver's director is added as second approver.`, "No action needed; noted for approval routing."));

  const all = [...reportViolations, ...[...lineViolations.values()].flat()];
  const blocking = all.filter((x) => x.severity === "block").length;
  const warnings = all.filter((x) => x.severity === "warn").length;

  return { reportViolations, lineViolations, blocking, warnings, clean: blocking === 0, totalUsd };
}

// ── The versioned policy document (erp/contracts/policy.schema.json) ──────
// The only place a rule exists. Every rule that can emit a violation, with
// its rule_id, so every finding traces to one line of one version of this
// document. All money is integer cents; FX is integer micro-USD; there is no
// decimal number anywhere in this document (OCF-1). 15 line-level codes plus
// 4 report-level codes (EMPTY_REPORT, PROJECT_SCOPE, PROJECT_INACTIVE,
// REPORT_REVIEW) — 19 rules, not 16.
const RULES = [
  { id: "R01", code: "MISSING_FIELD", severity: "block", fix_class: "provide_missing_data" },
  { id: "R02", code: "DATE_FUTURE", severity: "block", fix_class: "correct_transcription" },
  { id: "R03", code: "DATE_STALE", severity: "block", fix_class: "human_exception_required" },
  { id: "R04", code: "CURRENCY_UNSUPPORTED", severity: "block", fix_class: "not_reimbursable" },
  { id: "R05", code: "CAP_MEALS", severity: "block", fix_class: "human_exception_required" },
  { id: "R06", code: "CAP_LODGING", severity: "block", fix_class: "human_exception_required" },
  { id: "R07", code: "CAP_TRANSPORT", severity: "block", fix_class: "human_exception_required" },
  { id: "R08", code: "CAP_SUPPLIES", severity: "block", fix_class: "human_exception_required" },
  { id: "R09", code: "AIRFARE_REVIEW", severity: "warn", fix_class: "informational" },
  { id: "R10", code: "ITEMIZATION_REQUIRED", severity: "block", fix_class: "provide_missing_data" },
  { id: "R11", code: "ITEMIZATION_GAP", severity: "warn", fix_class: "correct_transcription" },
  { id: "R12", code: "ALCOHOL", severity: "block", fix_class: "not_reimbursable" },
  { id: "R13", code: "DESC_REQUIRED", severity: "block", fix_class: "provide_missing_data" },
  { id: "R14", code: "RECEIPT_REQUIRED", severity: "block", fix_class: "attach_evidence" },
  { id: "R15", code: "RECEIPT_DUP", severity: "block", fix_class: "not_reimbursable" },
  { id: "R16", code: "EMPTY_REPORT", severity: "block", fix_class: "provide_missing_data" },
  { id: "R17", code: "PROJECT_SCOPE", severity: "block", fix_class: "human_exception_required" },
  { id: "R18", code: "PROJECT_INACTIVE", severity: "block", fix_class: "human_exception_required" },
  { id: "R19", code: "REPORT_REVIEW", severity: "warn", fix_class: "informational" },
];

// erp/contracts/policy.schema.json properties.limits_cents — snake_case keys,
// same integer-cent values as LIMITS above.
const LIMITS_CENTS = {
  meal_per_attendee: LIMITS.MEAL_PER_PERSON,
  lodging_per_night: LIMITS.LODGING_PER_NIGHT,
  transport_per_line: LIMITS.TRANSPORT_PER_LINE,
  supplies_per_line: LIMITS.SUPPLIES_PER_LINE,
  airfare_review_above: LIMITS.AIRFARE_REVIEW_ABOVE,
  receipt_required_at: LIMITS.RECEIPT_REQUIRED_AT,
  meals_itemize_at: LIMITS.MEALS_ITEMIZE_AT,
  report_review_above: LIMITS.REPORT_REVIEW_ABOVE,
};

// The document itself — must reproduce erp/contracts/policy.schema.json
// examples[0] byte-for-byte under OCF-1 (digest sha256:b7ccc1ff9fdadb66399f48b26617a53572dd793ac7c57af55d72929561965b38,
// 2458 canonical bytes, pinned in erp/contracts/policy-versions.json).
export const POLICY_DOCUMENT = Object.freeze({
  kind: "outpocket.policy",
  ocf: 1,
  version: POLICY_VERSION,
  effective_from: POLICY_EFFECTIVE_FROM,
  reimbursement_currency: "USD",
  categories: [...CATEGORIES].sort(),
  fx_micros_per_unit_usd: FX,
  limits_cents: LIMITS_CENTS,
  filing_window_days: LIMITS.DATE_WINDOW_DAYS,
  non_reimbursable_labels: NON_REIMBURSABLE_LABELS,
  rules: RULES,
});

// erp/contracts/policy-versions.json digest_prefix.
export const POLICY_DIGEST_PREFIX = "outpocket/policy/1";
export const POLICY_DIGEST = digest(POLICY_DIGEST_PREFIX, POLICY_DOCUMENT);
export const POLICY_CANONICAL_BYTES = new TextEncoder().encode(canon(POLICY_DOCUMENT)).length;

// ── The policy as an agent-readable projection ─────────────────────
// get_expense_policy does NOT serve POLICY_DOCUMENT: its canonical form is
// over the 1500-character per-tool output budget. This serves caps,
// thresholds, categories, currencies and window, plus `version` and the
// first 12 hex of `policy_digest`, so an agent or an eval can bind what it
// read to what is enforced (erp/contracts/policy.schema.json x-agentView).
// `rules` is excluded. No decimal number anywhere — money stays integer
// cents, FX stays integer micro-USD.
export function policyForAgent() {
  return {
    version: POLICY_VERSION,
    policy_digest_prefix: POLICY_DIGEST.slice("sha256:".length, "sha256:".length + 12),
    reimbursement_currency: "USD",
    categories: POLICY_DOCUMENT.categories,
    fx_micros_per_unit_usd: FX,
    limits_cents: LIMITS_CENTS,
    filing_window_days: LIMITS.DATE_WINDOW_DAYS,
    non_reimbursable: "itemized alcohol — excluded; reduce the claimed amount",
    notes: "Every write is validated against this document; violations return a code, severity (block|warn) and a fix hint. Blocking violations prevent submission.",
  };
}
