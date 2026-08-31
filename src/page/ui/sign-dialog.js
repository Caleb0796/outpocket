// src/page/ui/sign-dialog.js — the confirmation a human sees before they
// certify an expense report.
//
// ── WHAT THIS DIALOG DOES NOT DO ─────────────────────────────────────────────
//
// It does not author a signature. It POSTs a decision to
// /api/sign/{request_id}/respond and the SERVER writes who signed and when,
// from the session cookie and its own clock. The frozen sign_respond_request
// has no key for either, so a client that tried would fail
// additionalProperties. An earlier design had the page assemble a signature
// object; that was a working forgery, and the job here is to OBTAIN a human
// decision, not to assert one.
//
// The only claim this file's copy may make is that a commit cannot be made
// without a POST from the authenticated session to /api/sign/{id}/respond.
// Not "without a human decision" — that is R-13 and it is false today: the
// arrival of this request on an open record from an authenticated session is
// strictly weaker than a person having decided.
//
// ── THE CONFIRM TOKEN ────────────────────────────────────────────────────────
//
// confirm_token is minted with the sign request and delivered ONLY into this
// dialog's rendered DOM. Nothing serves it over JSON — server/sign.mjs strips
// it from every response — so a caller that did not render this dialog cannot
// produce it. Therefore: it is read back OUT OF THE DOM at confirm time rather
// than out of a closure variable. That is not ceremony. A closure read would
// still pass a test that mocked the render, and would quietly keep working if
// the token stopped being planted in the markup at all.
//
// It is never logged, never echoed into a second attribute, and never handed to
// the F5 inspector. Be clear about what it buys: it raises the cost of a forged
// respond. It does not establish personhood, and against an agent that can read
// this page's DOM it buys nothing.
//
// ── WHY THE CERTIFICATION SENTENCE FAILS CLOSED ──────────────────────────────
//
// F4's accept wants the element above the signature line to match
// /you are certifying .+ if this is wrong, .+/i. That regex is satisfied by
// "You are certifying something. If this is wrong, something happens." — which
// passes the gate and tells the signer nothing. A certification text that is
// byte-identical across two different reports is a ritual, not a disclosure.
//
// So certificationSentence() NAMES the report id, the line count, the total and
// the worst case, all read from the live sign request; and when it cannot name
// them it returns null rather than a generic sentence. A null sentence leaves
// [data-worst-case] empty, and an empty [data-worst-case] disables confirming.
// Undisclosable therefore means unsignable, which is the behaviour we would
// want anyway and is cheaper to guarantee than to remember.

export const RESPOND_SCHEMA = "outpocket.sign_respond_request/1";
export const ALREADY_ANSWERED_TEXT = "already answered — start a new one";
export const POLICY_UNAVAILABLE_TEXT = "Policy version unavailable. Nothing was signed.";

/** Format integer cents as USD. */
function usd(cents) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Pull {reportId, lineCount, totalCents, worstCase} out of a sign request.
 * Returns null if any of them is missing — see "fails closed" above.
 */
export function certifiedFacts(signRequest) {
  const report = signRequest?.snapshot?.report;
  const lines = report?.lines;
  const reportId = signRequest?.report_id ?? report?.id ?? null;
  const worstCase = signRequest?.worst_case ?? null;
  if (!reportId || !Array.isArray(lines) || !worstCase) return null;

  // Prefer a total the server computed; fall back to summing the lines. Both
  // are integer cents — never floats, and never re-derived from a display
  // string.
  let totalCents = report?.total_usd_cents;
  if (typeof totalCents !== "number") {
    totalCents = lines.reduce((sum, l) => {
      const c = typeof l?.usdCents === "number" ? l.usdCents
        : typeof l?.amountCents === "number" ? l.amountCents : null;
      return c === null || sum === null ? null : sum + c;
    }, 0);
  }
  if (typeof totalCents !== "number") return null;

  return { reportId, lineCount: lines.length, totalCents, worstCase };
}

/**
 * The sentence above the signature line. ONE LINE, deliberately: the accept's
 * regex uses `.`, which does not match a newline, so a sentence broken across
 * lines would fail a predicate it otherwise satisfies.
 */
export function certificationSentence(signRequest) {
  const f = certifiedFacts(signRequest);
  if (!f) return null;
  const lines = `${f.lineCount} line${f.lineCount === 1 ? "" : "s"}`;
  return `You are certifying that expense report ${f.reportId} — ${lines}, ${usd(f.totalCents)} — is complete and true. ` +
    `If this is wrong, ${f.worstCase}`;
}

function el(doc, tag, attrs = {}, text = null) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== null) node.textContent = text;
  return node;
}

function validPolicyVersion(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function policySummary(revision, version) {
  const prefix = `revision ${revision ?? "unavailable"} · `;
  return version ? `${prefix}policy ${version}` : `${prefix}${POLICY_UNAVAILABLE_TEXT}`;
}

/**
 * Replace the dialog's policy state without rebuilding it. Rebuilding was
 * rejected because the confirmation token lives in this exact DOM and the
 * signature controls may already have listeners attached. Updating one line
 * and the existing button preserves both while making the fetched result the
 * value a person actually sees.
 */
function applyPolicyVersion(root, { revision, version }) {
  const policyVersion = validPolicyVersion(version);
  const note = root?.querySelector?.("[data-sign-policy-note]");
  if (note) {
    note.textContent = policySummary(revision, policyVersion);
    if (policyVersion) note.setAttribute("data-sign-policy-version", policyVersion);
    else note.removeAttribute("data-sign-policy-version");
  }

  const confirm = root?.querySelector?.("[data-sign-confirm]");
  if (!confirm) return policyVersion;
  if (canConfirm(root)) {
    confirm.removeAttribute("disabled");
    confirm.removeAttribute("data-sign-blocked");
  } else {
    confirm.setAttribute("disabled", "");
    confirm.setAttribute("data-sign-blocked",
      policyVersion ? "no-disclosure" : "no-policy-version");
  }
  return policyVersion;
}

/**
 * Read the version from the same endpoint as the surface inspector. The sign
 * request can carry an absent or stale version, so it is useful for the pure
 * renderer but is not enough for the mounted page. Any HTTP, JSON or transport
 * failure becomes the explicit unavailable state; no placeholder is promoted
 * into something a person could mistake for a policy version.
 */
async function refreshPolicyVersion(root, { revision, fetchImpl }) {
  let version = null;
  try {
    const res = await fetchImpl("/api/policy", { credentials: "same-origin" });
    if (res.ok) {
      const body = await res.json();
      version = validPolicyVersion(body?.version);
    }
  } catch {
    version = null;
  }
  return applyPolicyVersion(root, { revision, version });
}

/**
 * Build the eight-field body. Exactly eight: the frozen schema is
 * additionalProperties:false and requires all of them, so a ninth is rejected
 * and an eighth missing fails `required`. No signed_by, no at, and no key for
 * either — the server takes both.
 */
export function respondBody({ requestId, decision, reason = null, confirmToken, acknowledgedDigest, acknowledgedRevision }) {
  return {
    schema: RESPOND_SCHEMA,
    request_id: requestId,
    decision,
    reason,
    method: "click",
    acknowledged_digest: acknowledgedDigest,
    acknowledged_revision: acknowledgedRevision,
    confirm_token: confirmToken,
  };
}

/**
 * Render the dialog.
 *
 * DOM ORDER IS PART OF THE CONTRACT: [data-worst-case] is the element
 * IMMEDIATELY PRECEDING [data-signature-line], as siblings. A judge reading a
 * still frame should not have to scroll between the consequence and the place
 * they put their name.
 */
export function renderSignDialog(doc, { signRequest, confirmToken, fetchImpl = null } = {}) {
  const root = el(doc, "div", { "data-sign-dialog": "", role: "dialog", "aria-modal": "true" });
  const sentence = certificationSentence(signRequest);
  const policyVersion = validPolicyVersion(signRequest?.policy_version);

  root.appendChild(el(doc, "h2", { class: "sign-heading" }, "Sign this report"));

  const digestBox = el(doc, "div", { "data-snapshot-digest": signRequest?.snapshot_digest ?? "" });
  digestBox.appendChild(el(doc, "span", { class: "digest-label" }, "Snapshot digest"));
  digestBox.appendChild(el(doc, "code", {}, signRequest?.snapshot_digest ?? "(none)"));
  const policyAttrs = { class: "digest-note", "data-sign-policy-note": "" };
  if (policyVersion) policyAttrs["data-sign-policy-version"] = policyVersion;
  digestBox.appendChild(el(doc, "span", policyAttrs,
    policySummary(signRequest?.revision, policyVersion)));
  root.appendChild(digestBox);

  // Empty when the facts could not be named. Never a generic sentence.
  root.appendChild(el(doc, "p", { "data-worst-case": "" }, sentence ?? ""));

  // IMMEDIATELY AFTER, as a sibling. Do not insert anything between these two.
  const line = el(doc, "div", { "data-signature-line": "" });
  line.appendChild(el(doc, "span", { class: "sig-rule" }, "—————————————"));
  line.appendChild(el(doc, "span", { class: "sig-who" },
    signRequest?.persona_name ? `${signRequest.persona_name}, signing as themselves` : "signing as the session holder"));
  root.appendChild(line);

  // The one place confirm_token ever exists in this product outside the server.
  const token = el(doc, "input", { type: "hidden", "data-confirm-token": "" });
  token.value = confirmToken ?? "";
  root.appendChild(token);

  const controls = el(doc, "div", { class: "sign-controls" });
  const confirm = el(doc, "button", { type: "button", "data-sign-confirm": "" }, "Sign this report");
  if (!sentence || !policyVersion) {
    confirm.setAttribute("disabled", "");
    confirm.setAttribute("data-sign-blocked", sentence ? "no-policy-version" : "no-disclosure");
  }
  controls.appendChild(confirm);
  controls.appendChild(el(doc, "button", { type: "button", "data-sign-decline": "" }, "Send back instead"));
  root.appendChild(controls);

  root.appendChild(el(doc, "p", { "data-sign-claim": "" },
    "A commit cannot be made without a POST from this authenticated session to " +
    `/api/sign/${signRequest?.request_id ?? "{id}"}/respond.`));

  root.appendChild(el(doc, "p", { "data-sign-status": "" }, ""));

  // Wire the buttons to the same guarded path a caller would use. Handlers are
  // attached even when confirm is disabled, on purpose: `disabled` is the
  // markup's claim and submitDecision() is what enforces it, so a click that
  // reaches the handler anyway must still be refused there. That is the case
  // the test dispatches.
  if (fetchImpl) {
    // THE PROMISE IS NOT DISCARDED. It used to be — `submitDecision(...)` with
    // no catch — so anything that threw inside became an unhandled rejection
    // and the dialog rendered nothing. submitDecision handles its own failures
    // now, and this catch is the belt behind that brace: whatever goes wrong,
    // the person at the camera sees a sentence rather than a frozen dialog.
    const run = (opts) => {
      Promise.resolve(submitDecision(root, { signRequest, fetchImpl, doc, ...opts }))
        .catch((err) => {
          console.error("sign-dialog: the decision could not be sent", err);
          setStatus(root,
            "Something went wrong sending your decision, so nothing was signed. " +
            "Your report is unchanged. Start a new signature request.", { kind: "error" });
        });
    };
    confirm.addEventListener("click", () => run({ decision: "signed" }));
    root.querySelector("[data-sign-decline]")?.addEventListener("click", () =>
      run({ decision: "declined", reason: "sent back from the dialog" }));
  }

  return root;
}

/**
 * Write the dialog's status line. ONE PLACE, AND IT IS NEVER LEFT EMPTY.
 *
 * THE INVARIANT THIS FILE NOW HOLDS: A CLICK NEVER LEAVES THE DIALOG SILENT.
 * Before this, submitDecision's fetch was unwrapped and its promise was
 * discarded by the click handler — so a POST that THREW (server down, network
 * gone, request aborted) rejected into nothing and the page rendered NOTHING AT
 * ALL. Not an error, not a retry, not a state: a dead dialog, mid-take, with no
 * way for the person at the camera to know why.
 *
 * That is the failure mode worth the most here and the least visible: a 4xx or
 * 5xx already rendered a line, because the response came back. Only a THROWN
 * fetch was silent, and a thrown fetch is exactly what a server that has just
 * died produces.
 */
function setStatus(root, text, { kind = null } = {}) {
  const el = root?.querySelector?.("[data-sign-status]");
  if (!el) return;
  el.textContent = text;
  if (kind) el.setAttribute("data-sign-status-kind", kind);
  else el.removeAttribute("data-sign-status-kind");
}

/** Offer a retry. Only ever shown when we know NOTHING reached the server. */
function offerRetry(root, doc, onRetry) {
  if (!root || root.querySelector("[data-sign-retry]")) return;
  const again = el(doc, "button", { type: "button", "data-sign-retry": "" }, "Try again");
  again.addEventListener?.("click", onRetry);
  root.querySelector(".sign-controls")?.appendChild(again);
}

/** True when the dialog is in a state that may be confirmed. */
export function canConfirm(root) {
  const worst = root?.querySelector?.("[data-worst-case]");
  const version = root?.querySelector?.("[data-sign-policy-version]")
    ?.getAttribute?.("data-sign-policy-version");
  return Boolean(worst && worst.textContent.trim().length > 0 && validPolicyVersion(version));
}

/**
 * Confirm (or decline) from a rendered dialog.
 *
 * THE GUARD IS HERE, NOT ONLY ON THE BUTTON. A `disabled` attribute states an
 * intention; this function is what makes it true. The two come apart the moment
 * anything re-enables the control — a stylesheet, a later script, a judge with
 * devtools open — and this is the node where that difference is a signature.
 * So the request is refused on the state of [data-worst-case], and the button's
 * attribute is only the visible half of the same rule.
 */
export async function submitDecision(root, {
  signRequest, decision, reason = null, fetchImpl = globalThis.fetch, doc = globalThis.document,
} = {}) {
  // A mounted dialog begins its policy request before it is returned. Waiting
  // here keeps a forced or scripted click closed even if it bypasses the
  // disabled button while that request is still unresolved.
  if (root?.policyVersionReady) await root.policyVersionReady;

  if (!canConfirm(root)) {
    const policyVersion = root?.querySelector?.("[data-sign-policy-version]")
      ?.getAttribute?.("data-sign-policy-version");
    if (!validPolicyVersion(policyVersion)) {
      setStatus(root, POLICY_UNAVAILABLE_TEXT, { kind: "refused" });
      return { posted: false, refused: "no-policy-version" };
    }
    return { posted: false, refused: "no-disclosure" };
  }

  // Read the token back out of the RENDERED DOM — see the header.
  const confirmToken = root.querySelector("[data-confirm-token]")?.value ?? "";

  // The request_id comes from the sign request this dialog was OPENED with, and
  // is used for BOTH the URL and the body. A dialog that signed a different
  // report than the one on screen is the exact failure this product exists to
  // prevent, and "a POST happened" does not exclude it.
  const requestId = signRequest.request_id;

  const body = respondBody({
    requestId,
    decision,
    reason,
    confirmToken,
    acknowledgedDigest: signRequest.snapshot_digest,
    acknowledgedRevision: signRequest.revision,
  });

  setStatus(root, "Sending your decision to the server…", { kind: "pending" });

  let res;
  try {
    res = await fetchImpl(`/api/sign/${requestId}/respond`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // NOTHING REACHED THE SERVER. That is the one case where a retry is
    // unambiguously safe: the record is untouched and still open, so trying
    // again cannot double-answer it. Say what happened in words a person can
    // act on, not a stack trace.
    setStatus(root,
      "Could not reach the server, so nothing was signed. Your report is unchanged and this " +
      "request is still open — try again.", { kind: "unreachable" });
    offerRetry(root, doc, () => submitDecision(root, { signRequest, decision, reason, fetchImpl, doc }));
    return { posted: false, refused: "unreachable", error: String(err?.message ?? err) };
  }

  const payload = await res.json().catch(() => ({}));

  if (res.status === 409 && payload?.error === "E_ALREADY_ANSWERED") {
    renderAlreadyAnswered(root, doc);
    return { posted: true, status: 409, alreadyAnswered: true, body };
  }

  if (res.ok) {
    setStatus(root, "Signed. The server recorded who and when.", { kind: "signed" });
    return { posted: true, status: res.status, response: payload, body };
  }

  // THE SERVER REFUSED, AND IT SAYS WHY — so show ITS sentence, not our
  // paraphrase of its code. server/index.mjs's sendSignError returns
  // {error, message}; a bare code tells the person at the camera nothing, and
  // new refusal conditions land on this path faster than this file can learn
  // their names.
  const code = payload?.error ?? `HTTP ${res.status}`;
  const detail = payload?.message ? ` ${payload.message}` : "";
  setStatus(root, `The server refused this signature (${code}).${detail} Nothing was signed.`,
    { kind: "refused" });
  return { posted: true, status: res.status, response: payload, body };
}

/**
 * R-34 recovery. Someone holding the confirm_token answered this request before
 * the human's click landed, so the record is spent.
 *
 * It is rendered as a RECOVERY, not as a transport error and not as a retry:
 * the machine is one-shot by construction, so retrying the same request_id can
 * only fail again. And a human who is told nothing has had a signature
 * cancelled without being shown that it was — which is the part that matters,
 * because the severity here is nuisance-grade denial, not forgery. Nothing was
 * committed and nothing was attested in their name.
 */
export function renderAlreadyAnswered(root, doc = globalThis.document) {
  const status = root.querySelector("[data-sign-status]");
  if (status) {
    status.textContent = ALREADY_ANSWERED_TEXT;
    status.setAttribute("data-sign-already-answered", "");
  }
  const confirm = root.querySelector("[data-sign-confirm]");
  if (confirm) confirm.setAttribute("disabled", "");

  if (!root.querySelector("[data-sign-restart]")) {
    const again = el(doc, "button", { type: "button", "data-sign-restart": "" }, "Start a new signature request");
    root.querySelector(".sign-controls")?.appendChild(again);
  }
  return root;
}

/**
 * Mint a fresh sign request and re-render. This is what [data-sign-restart]
 * does: a NEW request_id, not a retry of the spent one.
 */
export async function restartSignRequest({
  signRequest, fetchImpl = globalThis.fetch, doc = globalThis.document, confirmTokenFor = null,
} = {}) {
  const res = await fetchImpl("/api/sign", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      report_id: signRequest.report_id,
      revision: signRequest.revision,
      policy_version: signRequest.policy_version,
      policy_digest: signRequest.snapshot?.policy_digest,
      report: signRequest.snapshot?.report,
      verdict: signRequest.snapshot?.verdict,
      worst_case: signRequest.worst_case,
      violation_history_count: signRequest.violation_history_count,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  const fresh = payload?.sign_request ?? null;
  if (!fresh) return { signRequest: null, root: null, response: payload };

  // The server plants the token in the rendered dialog; in the page that is
  // this render. confirmTokenFor is how the caller supplies it.
  const token = confirmTokenFor ? await confirmTokenFor(fresh.request_id) : "";
  return { signRequest: fresh, root: renderSignDialog(doc, { signRequest: fresh, confirmToken: token }), response: payload };
}

/** Mount into the shell's sign region. */
export function mountSignDialog({ doc = globalThis.document, signRequest, confirmToken, fetchImpl = globalThis.fetch } = {}) {
  const region = doc?.querySelector?.('[data-region="sign"]');
  if (!region || !signRequest) return null;
  region.textContent = "";
  const root = renderSignDialog(doc, { signRequest, confirmToken, fetchImpl });
  region.appendChild(root);

  // Keep mount synchronous because the dialog port attaches its own listeners
  // to the returned root. The button closes during the request, and the submit
  // path awaits the same promise, so an unavailable version cannot race a POST.
  const confirm = root.querySelector("[data-sign-confirm]");
  if (confirm) {
    confirm.setAttribute("disabled", "");
    confirm.setAttribute("data-sign-blocked", "policy-loading");
  }
  const note = root.querySelector("[data-sign-policy-note]");
  if (note) note.textContent = `revision ${signRequest.revision ?? "unavailable"} · checking policy version…`;
  root.policyVersionReady = refreshPolicyVersion(root, { revision: signRequest.revision, fetchImpl });
  return root;
}

export const signDialog = {
  renderSignDialog, certificationSentence, certifiedFacts, respondBody,
  submitDecision, canConfirm, renderAlreadyAnswered, restartSignRequest, mountSignDialog,
  POLICY_UNAVAILABLE_TEXT,
};

if (typeof document !== "undefined" && document.querySelector) {
  globalThis.outpocketSignDialog = signDialog;
}
