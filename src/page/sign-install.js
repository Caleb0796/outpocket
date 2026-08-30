// src/page/sign-install.js — node F7 (lane F, owner UX): the glue.
//
// ── WHY THIS FILE EXISTS, AND WHY NOTHING CAUGHT ITS ABSENCE ─────────────────
//
// Three modules each drew their boundary correctly and the seam between them
// belonged to no node:
//
//   src/page/register.js   (T2) exposes setSignatureProvider and stops.
//   src/page/ui/sign-dialog.js (F4) is deliberately DOM-only — no imports.
//   src/page/sign-bridge.js    (S5) is deliberately DOM-free — no document.
//
// register.js:97 said "F4 installs the real dialog by calling
// setSignatureProvider once", and F4 correctly did not, because doing so would
// have given a DOM-only module a dependency on the transport. The scoping is
// why they are good modules; it is also exactly why the gap was invisible. This
// file is the only place that is allowed to know about all three.
//
// ── WHAT WAS ACTUALLY MISSING ────────────────────────────────────────────────
//
// A DEMONSTRATION, NOT A GUARANTEE. The server already refuses an unsigned
// commit — S12's sign lock answers 423, S6 answers 409 E_SNAPSHOT_MISMATCH, and
// E3's N-15 asserts 409 E_NOT_SIGNED against the live URL. What was missing is
// that nothing on the page raised a dialog, so the human step was enforced and
// invisible. SB-10 and SB-11 are on-camera shots of a thing that was happening
// only in the server's refusal path.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────
//
//   submit_expense_report            (agent calls it)
//     -> hooks.requestSignature(summary, signal)      register.js
//        -> bridge.beginSign(openBody)                S5: opens the record
//        -> dialogPort.present(context)               F4: the human decides
//        -> bridge.continueSign(ticket, reportId)     S5: reads the answer
//     <- {signed, reason}                             register.js resumes
//
// The decision is the human's and the ANSWER is the server's: continueSign
// reports what the server recorded, not what the dialog told us. Returning the
// dialog's own word would make this file the forgery that the whole sign gate
// exists to prevent — it is one line shorter and completely wrong.

import { createSignBridge } from "./sign-bridge.js";

/** Reason strings. Named, because the accept turns on the two outcomes DIFFERING. */
export const REASONS = Object.freeze({
  DECLINED: "the employee reviewed the report and sent it back",
  NO_DIALOG: "no signature dialog is mounted in this page, so there is nobody to sign",
  NOT_ANSWERED: "the sign request was not answered",
});

/**
 * Build the POST /api/sign body from the summary register.js hands us plus the
 * live ERP. server/sign.mjs `open` names these fields.
 */
export function buildOpenBody(summary, { erp, policy } = {}) {
  const report = erp?.openReportOrNull?.() ?? null;
  const verdict = report ? erp?.verdict?.(report.id) : null;
  return {
    report_id: summary.reportId,
    revision: report?.revision ?? 1,
    policy_version: policy?.version ?? null,
    policy_digest: policy?.digest ?? null,
    report: report ?? { id: summary.reportId, lines: summary.lines ?? [] },
    verdict: verdict ?? { clean: true, warnings: summary.warnings ?? 0 },
    worst_case: worstCaseFor(summary),
    violation_history_count: verdict?.warnings ?? summary.warnings ?? 0,
  };
}

/**
 * The consequence F4 prints immediately above the signature line. It is built
 * here rather than in the dialog because the dialog renders what it is given
 * and this is the module that knows what is being submitted and to whom.
 */
export function worstCaseFor(summary) {
  const approver = summary?.approver ? ` ${summary.approver}` : " your approver";
  return `${approver.trim()} approves a claim that is not owed, your employer pays it in your name, ` +
    "and unwinding it is an audit finding against you.";
}

/**
 * Make the provider register.js will call.
 *
 * `dialogPort.present(context) -> Promise<{approved:boolean, reason?:string}>`
 * is the seam. In the page it raises F4's dialog; in a test it is stubbed to
 * approve or decline, which is the only way to show that the WIRE CARRIES A
 * DECISION rather than merely existing.
 */
export function createSignatureProvider({ bridge, dialogPort, erp, policy } = {}) {
  if (!bridge) throw new TypeError("createSignatureProvider needs a sign bridge");
  if (!dialogPort?.present) throw new TypeError("createSignatureProvider needs a dialogPort with present()");

  return async function requestSignature(summary, signal) {
    const openBody = buildOpenBody(summary, { erp, policy });

    // 1. open the record server-side. This is what makes a digest exist.
    const awaiting = await bridge.beginSign(openBody, signal);
    const ticket = awaiting?.ticket ?? null;

    // 2. the human decides, in the page.
    const decision = await dialogPort.present({ summary, openBody, awaiting, signal });

    if (!decision?.approved) {
      return { signed: false, reason: decision?.reason || REASONS.DECLINED, ticket };
    }

    // 3. ASK THE SERVER WHAT IT RECORDED. Not what the dialog told us — the
    //    dialog's word is a claim, the server's record is the answer, and this
    //    is the whole difference between a sign gate and a decoration.
    const answered = await bridge.continueSign(ticket, summary.reportId, signal);

    if (answered?.status === "awaiting_signature") {
      return { signed: false, reason: REASONS.NOT_ANSWERED, ticket };
    }
    if (answered?.decision && answered.decision !== "signed") {
      return { signed: false, reason: answered.reason || REASONS.DECLINED, ticket, response: answered };
    }
    return { signed: true, reason: null, ticket, response: answered };
  };
}

// ── installation, exactly once ───────────────────────────────────────────────
//
// Not zero, and not once per registration. A provider re-installed on every
// surface flip leaks one closure per flip and looks fine until the day it does
// not; and register.js's setSignatureProvider returns an UNDO, so a second
// install silently orphans the first one's teardown.

let installed = null;

/** installSignatureProvider(...) -> {installed:boolean, uninstall} */
export function installSignatureProvider({ registry, bridge, dialogPort, erp, policy, force = false } = {}) {
  if (installed && !force) return { installed: false, already: true, uninstall: installed };
  if (typeof registry?.setSignatureProvider !== "function") {
    return { installed: false, reason: "registry has no setSignatureProvider" };
  }
  const provider = createSignatureProvider({
    bridge,
    dialogPort,
    erp: erp ?? registry.erp,
    policy,
  });
  const uninstall = registry.setSignatureProvider(provider);
  installed = () => { uninstall?.(); installed = null; };
  return { installed: true, uninstall: installed, provider };
}

/** Test-only: forget that we installed, so a fresh registry can be wired. */
export function resetInstallForTests() { installed = null; }

/**
 * The browser dialog port: raise F4's dialog and resolve when the human acts.
 *
 * F4's module is DOM-only and publishes itself on globalThis rather than being
 * imported, which keeps it free of any transport dependency — so this port
 * reaches it the same way the rest of the page does.
 */
export function browserDialogPort({ doc = globalThis.document, signDialog = null } = {}) {
  return {
    async present({ openBody, awaiting }) {
      const dialog = signDialog ?? globalThis.outpocketSignDialog;
      if (!dialog?.mountSignDialog) return { approved: false, reason: REASONS.NO_DIALOG };

      const signRequest = {
        request_id: awaiting?.request_id ?? null,
        report_id: openBody.report_id,
        revision: openBody.revision,
        policy_version: openBody.policy_version,
        snapshot_digest: awaiting?.snapshot_digest ?? null,
        worst_case: openBody.worst_case,
        snapshot: { report: openBody.report },
      };

      const root = dialog.mountSignDialog({ doc, signRequest, confirmToken: awaiting?.confirm_token ?? "" });
      if (!root) return { approved: false, reason: REASONS.NO_DIALOG };

      return new Promise((resolve) => {
        root.querySelector("[data-sign-confirm]")?.addEventListener("click", () => resolve({ approved: true }));
        root.querySelector("[data-sign-decline]")?.addEventListener("click", () =>
          resolve({ approved: false, reason: REASONS.DECLINED }));
      });
    },
  };
}

// ── mount ────────────────────────────────────────────────────────────────────
// One tag in index.html, no wiring, same convention as register.js and
// fallback-agent.js. Guarded so importing this module from a test installs
// nothing into a page that does not exist.
if (typeof document !== "undefined" && document.querySelector) {
  globalThis.outpocketSignInstall = {
    installSignatureProvider, createSignatureProvider, browserDialogPort, buildOpenBody, REASONS,
  };
  const registry = globalThis.outpocketTools;
  if (registry) {
    globalThis.outpocketSignInstall.result = installSignatureProvider({
      registry,
      bridge: createSignBridge({}),
      dialogPort: browserDialogPort({ doc: document }),
      erp: registry.erp,
    });
  }
}
