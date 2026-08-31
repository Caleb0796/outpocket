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
//   first submit_expense_report      (agent calls it)
//     -> bridge.openForDialog(openBody)               opens one server record
//     -> dialogPort.present(context)                  mounts F4 and returns
//     <- {status:'awaiting_signature', ticket}        tool call ends promptly
//
//   later submit_expense_report
//     -> bridge.continueSign(ticket, reportId)        reads the server answer
//     <- signed / declined / still awaiting           never trusts local click state
//
// openForDialog rather than beginSign, and the difference is not cosmetic: see
// step 1 below. beginSign is what a TOOL's execute() calls and is deliberately
// too narrow to build a dialog from.
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
 * Build the POST /api/sign body from the report reference plus presentation
 * copy. Report content, provenance, receipt metadata, revision, policy identity
 * and verdict are read by the server from its own aggregate.
 */
export function buildOpenBody(summary) {
  return {
    report_id: summary.reportId,
    worst_case: worstCaseFor(summary),
    violation_history_count: summary.warnings ?? 0,
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
 * `dialogPort.present(context) -> {mounted:boolean}` is the seam. It mounts F4
 * and returns immediately; the provider learns the decision only through the
 * server-side continuation ticket on a later tool call.
 */
export function createSignatureProvider({ bridge, dialogPort } = {}) {
  if (!bridge) throw new TypeError("createSignatureProvider needs a sign bridge");
  if (!dialogPort?.present) throw new TypeError("createSignatureProvider needs a dialogPort with present()");

  // openForDialog() IS REQUIRED, AND THE ABSENCE IS LOUD ON PURPOSE.
  // The obvious kindness here is to fall back to beginSign() when the bridge is
  // an older one. That fallback is exactly the defect this change repairs: it
  // would silently restore a path that posts to /api/sign/null/respond, and a
  // silent revert to a broken path is worse than a startup error naming the
  // reason.
  if (typeof bridge.openForDialog !== "function") {
    throw new TypeError(
      "createSignatureProvider needs a sign bridge with openForDialog() (D-89). " +
      "beginSign() deliberately carries only {status, ticket} — no request_id, no " +
      "snapshot_digest, no confirm_token — so a dialog built from its result cannot " +
      "address the record it is signing.");
  }

  let pending = null;
  let opening = null;

  const keyFor = (summary) => `${summary.personaId ?? "session"}:${summary.reportId}`;
  const awaiting = (record) => Object.freeze({
    status: "awaiting_signature",
    ticket: record.ticket,
  });

  async function restart(record) {
    if (pending !== record) return { status: "stale" };
    let answered;
    try {
      answered = await bridge.continueSign(record.ticket, record.reportId);
    } catch {
      pending = null;
      return open(record.summary);
    }
    if (answered?.decision === "signed") {
      dialogPort.finish?.({
        kind: "signed",
        message: "Signature recorded by the server. Call submit_expense_report again to finish submission.",
      });
      return { status: "signed" };
    }
    if (answered?.status === "awaiting_signature") return awaiting(record);
    pending = null;
    return open(record.summary);
  }

  async function open(summary, signal) {
    const key = keyFor(summary);
    if (opening?.key === key) return opening.promise;
    if (typeof dialogPort.available === "function" && !dialogPort.available()) {
      return { unavailable: true, reason: REASONS.NO_DIALOG };
    }

    const promise = (async () => {
      const openBody = buildOpenBody(summary);
      const opened = await bridge.openForDialog(openBody, signal);
      const record = {
        key,
        reportId: summary.reportId,
        summary,
        openBody,
        opened,
        ticket: opened?.ticket ?? null,
        request_id: opened?.requestId ?? null,
        commitClaimed: false,
      };
      pending = record;
      const presented = await dialogPort.present({
        summary,
        openBody,
        opened,
        signal,
        onRestart: () => restart(record),
      });
      if (presented?.mounted === false) {
        pending = null;
        return { unavailable: true, reason: presented.reason || REASONS.NO_DIALOG };
      }
      return record;
    })();

    opening = { key, promise };
    try {
      return await promise;
    } finally {
      if (opening?.promise === promise) opening = null;
    }
  }

  return async function requestSignature(summary, signal) {
    const key = keyFor(summary);
    if (pending && pending.key !== key) pending = null;

    if (!pending) {
      const record = await open(summary, signal);
      if (record?.unavailable) {
        return { signed: false, reason: record.reason || REASONS.NO_DIALOG };
      }
      return awaiting(record);
    }

    const record = pending;
    let answered;
    try {
      answered = await bridge.continueSign(record.ticket, record.reportId, signal);
    } catch (error) {
      if (error?.code === "E_NO_CONFIRM_TOKEN" || error?.status === 410) {
        pending = null;
        dialogPort.finish?.({
          kind: "expired",
          message: "This signature request expired. Call submit_expense_report to open a new review.",
        });
        return { signed: false, reason: "the signature request expired" };
      }
      throw error;
    }

    if (answered?.status === "awaiting_signature") return awaiting(record);

    if (answered?.decision === "declined") {
      pending = null;
      const reason = answered.reason || REASONS.DECLINED;
      dialogPort.finish?.({
        kind: "declined",
        message: `Sent back. Nothing was submitted; the draft remains editable.${answered.reason ? ` Reason: ${answered.reason}` : ""}`,
      });
      return {
        signed: false,
        reason,
        ticket: record.ticket,
        request_id: record.request_id,
        response: answered,
      };
    }

    if (answered?.decision !== "signed") {
      return { signed: false, reason: REASONS.NOT_ANSWERED, ticket: record.ticket };
    }

    if (record.commitClaimed) {
      return { status: "submission_in_progress", ticket: record.ticket };
    }
    record.commitClaimed = true;
    dialogPort.finish?.({
      kind: "submitting",
      message: "Signature recorded by the server. Submission is finishing.",
    });

    return {
      signed: true,
      reason: null,
      ticket: record.ticket,
      request_id: record.request_id,
      response: answered,
      settle({ status, confirmation = null, message = null } = {}) {
        if (pending !== record) return;
        if (status === "committed") {
          pending = null;
          dialogPort.finish?.({
            kind: "committed",
            confirmation,
            message: message || `Submitted${confirmation ? `. Confirmation ${confirmation}.` : "."}`,
          });
          return;
        }
        record.commitClaimed = false;
        dialogPort.finish?.({
          kind: "retryable",
          message: message || "The server did not finish submission. Call submit_expense_report again to retry the signed commit.",
        });
      },
    };
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
export function installSignatureProvider({ registry, bridge, dialogPort, force = false } = {}) {
  if (installed && !force) return { installed: false, already: true, uninstall: installed };
  if (typeof registry?.setSignatureProvider !== "function") {
    return { installed: false, reason: "registry has no setSignatureProvider" };
  }
  const provider = createSignatureProvider({
    bridge,
    dialogPort,
  });
  const uninstall = registry.setSignatureProvider(provider);
  installed = () => { uninstall?.(); installed = null; };
  return { installed: true, uninstall: installed, provider };
}

/** Test-only: forget that we installed, so a fresh registry can be wired. */
export function resetInstallForTests() { installed = null; }

/**
 * The browser dialog port: raise F4's dialog and return as soon as it is shown.
 *
 * F4's module is DOM-only and publishes itself on globalThis rather than being
 * imported, which keeps it free of any transport dependency — so this port
 * reaches it the same way the rest of the page does.
 */
export function browserDialogPort({ doc = globalThis.document, signDialog = null } = {}) {
  const resolveDialog = () => signDialog ?? globalThis.outpocketSignDialog;
  return {
    available() {
      return Boolean(resolveDialog()?.mountSignDialog);
    },
    async present({ opened, onRestart }) {
      const dialog = resolveDialog();
      if (!dialog?.mountSignDialog) return { mounted: false, reason: REASONS.NO_DIALOG };

      // THE SERVER'S OWN sign_request, NOT ONE ASSEMBLED HERE. The previous
      // version rebuilt this object out of openBody and read request_id /
      // snapshot_digest off beginSign()'s result, which never carried them —
      // so the dialog acknowledged a digest of null and posted to
      // /api/sign/null/respond. The digest the human is shown and the digest
      // the POST acknowledges have to be the SAME value the server issued, or
      // the acknowledgement means nothing; taking the record whole is the only
      // way to guarantee that.
      const signRequest = opened?.signRequest ?? null;
      if (!signRequest?.request_id) {
        return { mounted: false, reason: "the sign request could not be opened, so there is nothing to sign" };
      }

      const root = dialog.mountSignDialog({
        doc,
        signRequest,
        confirmToken: opened.confirmToken ?? "",
        onRestart,
      });
      return root ? { mounted: true, root } : { mounted: false, reason: REASONS.NO_DIALOG };
    },
    finish(result) {
      return resolveDialog()?.showSignResult?.({ doc, ...result }) ?? null;
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
    });
  }
}
