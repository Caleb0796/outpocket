// src/page/sign-bridge.js — the client half of the human sign gate.
//
// Node S5. One named file inside the page tree; everything else under
// src/page/** belongs to UX/T1/T2. This module owns exactly one thing: the
// mode-switchable bridge between a tool's execute() and the server's sign
// state machine (server/sign.mjs). It is a pure fetch-based module — no DOM,
// no CDP — so it runs the same inside a real page and inside a plain
// `node --test`.
//
// MODE: contingencies[4] has fired (R-43). `handshake` is the SHIPPED,
// DEFAULT position: execute() resolves within ~2s carrying
// `{status:'awaiting_signature', ticket}`, and the agent must call again
// (continueSign) to learn the outcome. `suspend` is this node's OWN
// NEGATIVE CONTROL, kept behind the switch: it holds execute() unresolved
// until the record is answered, and is EXPECTED TO BE UNRUNNABLE against a
// client that abandons a suspended tool call under ~22s (evidence/V4.json) —
// that is precisely what V4 measured. Both arms are real code; only one is
// the default.
//
// WHAT THE TOOL RESULT DOES NOT CARRY, ON PURPOSE (R-13/R-44): no
// confirm_token, no snapshot_digest, no revision. Handing those out of a
// tool call would give x-signRequestState.survivingVector its two echoed
// values for free. Withholding them from the RESULT does not withhold them
// from the CALLER — any caller holding the session cookie can still read
// snapshot_digest and revision from GET /api/sign/{request_id} — so this is
// a discipline about this module's own surface, not a claim that it closes
// the vector. See erp/contracts/signature.schema.json x-signRequestState.
//
// D-89: openForDialog() below is the ONE deliberate exception, and it does
// not weaken the paragraph above — beginSign()/continueSign() (what a
// tool's execute() calls) are UNCHANGED, still exactly {status, ticket} or
// the server's own sign_response. openForDialog() exists for a DIFFERENT
// caller — src/page/sign-install.js's dialogPort, which mounts F4's dialog
// and whose own return value passes request_id back only to the submit tool
// that must address the matching commit. The full signRequest and confirmToken
// still stop at the dialog seam. Confirm_token reaches it via GET
// /api/sign/{request_id}/confirm-token, a session-scoped route that is not,
// and must never become, a registered tool.

export const SIGN_MODE = Object.freeze({ HANDSHAKE: "handshake", SUSPEND: "suspend" });

// The shipped default. Do not flip this without a PM/L1 ruling — see the S5
// node notes in erp/graph.json and RISK.md section 4.
export const DEFAULT_SIGN_MODE = SIGN_MODE.HANDSHAKE;

const POLL_INTERVAL_MS = 300;

/**
 * createSignBridge(opts) -> { beginSign, continueSign, openForDialog }
 *
 * opts.fetchImpl: fetch-compatible function (default global fetch). Injected
 *   so tests can run against a plain Node http.Server without a browser.
 * opts.baseUrl: origin to call, e.g. 'http://127.0.0.1:PORT'. Default ''.
 * opts.mode: SIGN_MODE.HANDSHAKE (default) or SIGN_MODE.SUSPEND.
 * opts.pollIntervalMs: only used by SUSPEND mode's internal poll loop.
 */
export function createSignBridge({
  fetchImpl = fetch,
  baseUrl = "",
  mode = DEFAULT_SIGN_MODE,
  pollIntervalMs = POLL_INTERVAL_MS,
  // In the real page, the session cookie rides along automatically via
  // credentials:'include'. Node's fetch() has no per-origin cookie jar, so
  // tests/acceptance/sign-state.test.mjs passes an explicit Cookie header
  // here instead — the same mechanism, made visible for a headless caller.
  headers = {},
} = {}) {
  if (mode !== SIGN_MODE.HANDSHAKE && mode !== SIGN_MODE.SUSPEND) {
    throw new Error(`sign-bridge: unknown mode '${mode}' — must be 'handshake' or 'suspend'`);
  }

  async function postJson(path, body, signal) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
      credentials: "include",
      signal,
    });
    const json = await res.json();
    return { ok: res.ok, status: res.status, body: json };
  }

  /**
   * beginSign(openBody, signal) -> Promise<{status:'awaiting_signature', ticket} | sign_response>
   *
   * openBody: {report_id, worst_case, violation_history_count}. The latter
   * two fields are presentation metadata; all authority fields are loaded
   * by the server from report_id.
   *
   * In HANDSHAKE mode this resolves as soon as the server has opened the
   * record — the caller must present `ticket` to continueSign() to learn
   * whether the human answered.
   *
   * In SUSPEND mode this does not resolve until the record is answered
   * (polling continueSign internally) — the caller never sees a ticket.
   */
  async function beginSign(openBody, signal) {
    const opened = await postJson("/api/sign", openBody, signal);
    if (!opened.ok) {
      const err = new Error(opened.body?.message || opened.body?.error || "sign-bridge: open failed");
      err.code = opened.body?.error;
      err.status = opened.status;
      throw err;
    }
    const { ticket } = opened.body;
    // Deliberately narrow: exactly these two keys, nothing echoed from the
    // sign_request the server just returned.
    const awaiting = Object.freeze({ status: "awaiting_signature", ticket });

    if (mode === SIGN_MODE.HANDSHAKE) return awaiting;

    // SUSPEND (the negative control): loop continueSign until it stops
    // reporting 'awaiting_signature'. Unbounded by design — the point of
    // this arm is that nothing here imposes a timeout; the client does, or
    // doesn't (V4).
    for (;;) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const result = await continueSign(ticket, openBody.report_id, signal);
      if (result.status !== "awaiting_signature") return result;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * continueSign(ticket, reportId, signal) -> Promise<{status:'awaiting_signature', ticket} | sign_response>
   *
   * The second tool call, in HANDSHAKE mode. Read-only on the server side
   * (server/sign.mjs `continueTicket`): calling it twice, including
   * concurrently, is safe and returns the same answer.
   */
  async function continueSign(ticket, reportId, signal) {
    const res = await postJson("/api/sign/continue", { ticket, report_id: reportId }, signal);
    if (!res.ok) {
      const err = new Error(res.body?.message || res.body?.error || "sign-bridge: continue failed");
      err.code = res.body?.error;
      err.status = res.status;
      throw err;
    }
    return res.body;
  }

  async function getJson(path, signal) {
    const res = await fetchImpl(`${baseUrl}${path}`, { headers, credentials: "include", signal });
    const json = await res.json();
    return { ok: res.ok, status: res.status, body: json };
  }

  /**
   * openForDialog(openBody, signal) -> Promise<{requestId, signRequest, ticket, confirmToken}>
   *
   * D-89. NOT beginSign — this is the PAGE-SIDE-ONLY companion, for code
   * that MOUNTS F4's dialog (src/page/sign-install.js's dialogPort, never a
   * tool's execute()). It opens the SAME sign request beginSign would, but
   * — unlike beginSign, which deliberately withholds everything except
   * {status, ticket} per R-13/R-44 — it also returns the full signRequest
   * and fetches confirm_token from the new session-scoped, non-tool route
   * (GET /api/sign/{request_id}/confirm-token). The caller may hand only the
   * requestId back to submit_expense_report for the matching commit. It must not
   * return signRequest or confirmToken in tool text or any other agent-visible
   * value.
   */
  async function openForDialog(openBody, signal) {
    const opened = await postJson("/api/sign", openBody, signal);
    if (!opened.ok) {
      const err = new Error(opened.body?.message || opened.body?.error || "sign-bridge: open failed");
      err.code = opened.body?.error;
      err.status = opened.status;
      throw err;
    }
    const { sign_request: signRequest, ticket } = opened.body;
    const tokenRes = await getJson(`/api/sign/${signRequest.request_id}/confirm-token`, signal);
    if (!tokenRes.ok) {
      const err = new Error(tokenRes.body?.message || tokenRes.body?.error || "sign-bridge: confirm-token fetch failed");
      err.code = tokenRes.body?.error;
      err.status = tokenRes.status;
      throw err;
    }
    return { requestId: signRequest.request_id, signRequest, ticket, confirmToken: tokenRes.body.confirm_token };
  }

  return { beginSign, continueSign, openForDialog };
}
