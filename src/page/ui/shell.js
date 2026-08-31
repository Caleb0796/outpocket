// src/page/ui/shell.js — the application shell.
//
// Session interface: erp/contracts/session.contract.md.
// The contract is the authority here, not server/index.mjs. Three facts from
// it drive every line below:
//
//   1. `POST /api/login {"persona":"chen"|"ruiz"}` answers 200 {persona, role}
//      and sets `sid`; any other persona value answers 400 E_BAD_PERSONA and
//      creates no session. The shell never invents a third id to send.
//   2. `GET /api/me` answers 200 {persona, role} or 401 E_NO_SESSION, and it is
//      the ONLY persona check anything may rely on. This shell therefore never
//      caches a role in page state and re-reads /api/me after every login: the
//      server's answer is the session. A page-held copy would restore the
//      client-authored shortcut the session contract exists to close.
//   3. The `sid` cookie is HttpOnly. Page JavaScript cannot read it, so
//      `document.cookie` is never consulted; "am I signed in?" is a request,
//      not a variable.
//
// The contract's stated non-goals bind this file too: there is no logout route,
// so "Switch persona" does not call one. It reopens the picker, and signing in
// again issues a fresh sid that replaces the old cookie.

import { readEnv, renderBanner } from "../env-banner.js";

const LOGIN_URL = "/api/login";
const ME_URL = "/api/me";

const el = {
  loginPanel: document.querySelector("[data-login-panel]"),
  loginError: document.querySelector("[data-login-error]"),
  identity: document.querySelector("[data-signed-in-as]"),
  sessionName: document.querySelector("[data-session-name]"),
  sessionPersona: document.querySelector("[data-session-persona]"),
  sessionRole: document.querySelector("[data-session-role]"),
  regions: Array.from(document.querySelectorAll("[data-region]")),
};

const displayNames = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-persona]"))
    .map((card) => [card.dataset.persona, card.querySelector(".name")?.textContent?.trim()])
    .filter(([, name]) => Boolean(name)),
);

/** Subscribers registered by later nodes; called on every session change. */
const listeners = new Set();

/** Last answer from /api/me. `null` means signed out. Never written by hand. */
let session = null;

function showError(message) {
  if (el.loginError) el.loginError.textContent = message || "";
}

/**
 * Render the signed-in / signed-out split.
 *
 * The login panel is HIDDEN, never removed. Two reasons, and both are load-
 * bearing: F1's acceptance predicate counts `[data-persona]` elements and that
 * count must hold in every session state, and docs/STORYBOARD.md shots SB-05
 * and SB-06 name `[data-persona="chen"]` and `[data-persona="ruiz"]` as
 * selectors on the built page.
 */
function render() {
  const signedIn = session !== null;

  if (el.loginPanel) el.loginPanel.hidden = signedIn;
  if (el.identity) el.identity.hidden = !signedIn;

  if (signedIn) {
    if (el.sessionName) el.sessionName.textContent = displayNames[session.persona] ?? session.persona;
    if (el.sessionPersona) el.sessionPersona.textContent = session.persona;
    if (el.sessionRole) el.sessionRole.textContent = session.role;
    showError("");
  }

  // The signed-out surface is deliberately visible: its two tools explain what
  // an agent can do before a session exists. The other panels depend on a
  // signed-in report or receipt store, so their visibility still follows the
  // session. The shell decides visibility only and never writes into a region.
  for (const region of el.regions) {
    region.hidden = !signedIn && region.getAttribute("data-region") !== "surface";
  }

  document.body.dataset.sessionState = signedIn ? session.persona : "none";

  for (const fn of listeners) {
    try {
      fn(session);
    } catch (err) {
      // A subscriber's failure is that node's problem, not a reason for the
      // shell to stop rendering.
      console.error("shell: session listener failed", err);
    }
  }
}

/** Re-read the session from the server and re-render. Returns the session. */
async function refreshSession() {
  let res;
  try {
    res = await fetch(ME_URL, { credentials: "same-origin", headers: { accept: "application/json" } });
  } catch {
    session = null;
    render();
    showError("Could not reach the server.");
    return null;
  }

  session = res.ok ? await res.json() : null; // 401 E_NO_SESSION is the signed-out answer, not an error
  render();
  return session;
}

/**
 * Sign in as one of the two seeded personas.
 *
 * The success path deliberately DISCARDS the login response body and asks
 * /api/me instead. The two agree today; asking again is what keeps the rule in
 * the contract — /api/me is the only persona check anything relies on — true
 * of this page rather than merely true of the server.
 */
async function login(personaId) {
  showError("");

  let res;
  try {
    res = await fetch(LOGIN_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ persona: personaId }),
    });
  } catch {
    showError("Could not reach the server.");
    return null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    showError(
      body.error === "E_BAD_PERSONA"
        ? "That is not one of the two seeded logins."
        : `Sign-in failed (${res.status}).`,
    );
    return null;
  }

  return refreshSession();
}

/**
 * Reopen the persona picker. There is no logout route — the session contract
 * names that an explicit non-goal — so this clears nothing on the server. The
 * next successful login issues a fresh sid and the browser replaces the old
 * cookie with it.
 */
function showPicker() {
  session = null;
  render();
}

/**
 * Delegated click handling.
 *
 * THE WHOLE PERSONA CARD IS THE TARGET, not just the button inside it, and that
 * is a correctness requirement rather than a convenience. `closest()` walks UP
 * the tree, so a handler that looks only for `[data-login]` can never match a
 * click that lands on the enclosing `<li data-persona>` — the button is a
 * DESCENDANT of the card, below the click, not an ancestor above it.
 *
 * harness/drive.mjs --smoke-login clicks `[data-persona="<id>"]` at the
 * element's centre via a trusted Input.dispatchMouseEvent, because that is what
 * a judge's mouse produces. MEASURED on this page: the centre of the card is
 * the `<li>` itself, `closest('[data-login]')` from there is null, and
 * `closest('[data-persona]')` is the persona id. So the card must resolve.
 *
 * Order matters. `[data-login]` is checked first so a click on the button takes
 * the button's own branch and the card branch never sees it; a click anywhere
 * else on the card falls through to the second branch. One login call either
 * way, never two.
 */
document.addEventListener("click", (event) => {
  const loginButton = event.target.closest("[data-login]");
  if (loginButton) {
    event.preventDefault();
    login(loginButton.dataset.login);
    return;
  }

  const personaCard = event.target.closest("[data-persona]");
  if (personaCard?.dataset.persona) {
    event.preventDefault();
    login(personaCard.dataset.persona);
    return;
  }

  if (event.target.closest('[data-action="switch"]')) {
    event.preventDefault();
    showPicker();
  }
});

/**
 * Mount the environment banner into the slot index.html reserves for it.
 *
 * src/page/env-banner.js (node H5, seat I1) is a PURE module — it exports
 * readEnv/renderBanner and mounts nothing itself; its own doc comment says
 * "The caller attaches it: container.prepend(renderBanner(document, readEnv(window)))".
 * #env-banner is the shell's element, so the shell is that caller. Without this,
 * H5's own tests still pass (they import the functions directly) while the
 * banner never renders in a browser and the slot reads "not yet checked"
 * forever — including on camera.
 *
 * The placeholder is cleared only on success, so a failure here leaves the
 * honest "not yet checked" text rather than an empty bar that reads as "fine".
 * The banner is not decoration: the installed Chromium major is below 153, so
 * this is the element that puts a real platform gap on screen for the whole
 * demo instead of leaving it mysterious.
 */
function mountEnvBanner({ simulated = false } = {}) {
  const container = document.getElementById("env-banner");
  if (!container) return;
  try {
    const banner = renderBanner(document, readEnv({ navigator, document, simulated }));
    container.textContent = "";
    container.appendChild(banner);
  } catch (err) {
    console.error("shell: environment banner failed to render", err);
  }
}

/**
 * The shell's interface to the nodes that mount into its regions (F2, F3, F4,
 * F5, and I1's banners). Deliberately small: read the session, hear about
 * changes, find your slot. Nothing here registers a tool — that is I2's
 * src/page/register.js, at the top level of the document.
 */
export const shell = {
  getSession: () => session,
  onSession(fn) {
    listeners.add(fn);
    fn(session);
    return () => listeners.delete(fn);
  },
  region: (name) => document.querySelector(`[data-region="${name}"]`),
  refreshSession,

  /**
   * Re-render the environment banner. H3's in-page fallback agent (I1) calls
   * this with `{ simulated: true }` when it starts driving, so the banner says
   * so in plain words. An unlabelled self-driving demo is dishonest, and the
   * banner is where that label belongs — the shell cannot know at load time
   * whether the fallback agent will take over, so it exposes the seam rather
   * than guessing.
   */
  refreshEnvBanner: mountEnvBanner,
};

globalThis.outpocketShell = shell;

mountEnvBanner();
refreshSession();
