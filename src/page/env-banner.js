// H5 — the first-screen environment banner.
//
// Renders, on the demo's first screen:
//     Chromium 152 · WebMCP present · simulated agent
// matching /^Chromium \d+ · WebMCP (present|absent)( · simulated agent)?$/ (erp/graph.json
// H5.accept), plus — on any Chromium major below 153 — an ADDITIONAL sibling node carrying
// [data-warn="chrome-lt-153"].
//
// THE ONE THING NOT TO CHANGE HERE: presence is graded off `document.modelContext`, never off
// the navigator alias — the reading evidence/V0.json and evidence/V1.json both record under
// `navigatorAliasPresent`. It is named that way rather than spelled out because
// tools/lint-layer0.mjs IR-1 bans the literal identifier throughout src/** and tests/**, so a
// reader grepping for it finds zero hits in shipped code; probe/** is the one exempt scope,
// being a legitimate feature-detect. MEASURED on two independent engines, both in this repo —
// evidence/V0.json (Chrome 152.0.7977.64, major read from the binary) and evidence/V1.json
// (the ChatGPT built-in browser, Chromium 151) — the navigator alias is ABSENT while the page
// API is PRESENT and five tools register and execute. HANDOVER §3 rule 1: the alias was removed
// in Chromium 150. A banner reading the alias would print "absent" on every browser this
// project runs on, while the tools worked fine. probe/index.html:74 spells the check the same
// way, and tests/acceptance/banner.test.mjs pins it in both directions.
//
// WHY THE WARNING IS ALWAYS ON, HERE AND IN THE VIDEO. 152 (installed) and 151 (built-in
// browser) are both below 153, so [data-warn] renders throughout. erp/graph.json H5.notes
// (R-8) says that is correct and intended, not a defect to hide: revocation does not interrupt
// a suspended execute below 153, and this banner is how that gap becomes visible instead of
// mysterious. Do not suppress it, and do not demand a browser upgrade over it.
//
// The major is USER-AGENT DERIVED and `majorSource` says so. A page cannot read the browser
// binary's version — only the launcher can (tools/chrome.mjs, and evidence/V0.json's
// chromeMajor). evidence/V1.json carries this same caveat about its own reading.

// Below this major, revocation does not interrupt a suspended execute.
const WARN_BELOW_MAJOR = 153;

// Same shape probe/index.html:69-78 uses, so the banner and the probe can never disagree.
const UA_MAJOR = /Chrome\/(\d+)/;

/**
 * Read the environment from a window-like object.
 * Pass the real globals from the page: readEnv({ navigator, document, simulated }).
 * `simulated` is true when H3's in-page fallback agent is driving.
 */
export function readEnv({ navigator = {}, document = {}, simulated = false } = {}) {
  const matched = String(navigator.userAgent ?? "").match(UA_MAJOR);

  return {
    // 0, not null: the accept regex requires \d+, so an engine we could not identify still has
    // to render digits. 0 is also conservative — it is below 153, so the warning shows rather
    // than being silently suppressed on an unknown browser.
    chromiumMajor: matched ? parseInt(matched[1], 10) : 0,
    majorSource: matched ? "user-agent" : "unknown",
    webmcpPresent: typeof document.modelContext !== "undefined" && document.modelContext !== null,
    simulatedAgent: Boolean(simulated),
  };
}

/** The banner string itself. Must match the accept regex for every env readEnv can produce. */
export function bannerText(env) {
  const suffix = env.simulatedAgent ? " · simulated agent" : "";
  return `Chromium ${env.chromiumMajor} · WebMCP ${env.webmcpPresent ? "present" : "absent"}${suffix}`;
}

/** True when this engine has the below-153 suspended-execute gap. */
export function needsChromeWarning(env) {
  return env.chromiumMajor < WARN_BELOW_MAJOR;
}

/**
 * The banner as pure data: a flat list of sibling node descriptors.
 *
 * The warning is a SIBLING of the banner text node, never a child. If it were nested, its
 * prose would land in the banner element's textContent and break the accept regex.
 */
export function bannerNodes(env) {
  const nodes = [
    {
      tag: "span",
      attrs: { "data-env-banner": "" },
      text: bannerText(env),
      children: [],
    },
  ];

  if (needsChromeWarning(env)) {
    nodes.push({
      tag: "span",
      attrs: { "data-warn": "chrome-lt-153" },
      text: `Chromium ${env.chromiumMajor} is below 153 — revocation does not interrupt a suspended execute on this engine.`,
      children: [],
    });
  }

  return nodes;
}

/**
 * Turn the descriptors into real elements and return the root.
 * The caller attaches it: `container.prepend(renderBanner(document, readEnv(window)))`.
 *
 * Text is set through textContent, never innerHTML, so nothing read out of the user-agent can
 * be parsed as markup.
 */
export function renderBanner(doc, env) {
  const root = doc.createElement("div");
  root.setAttribute("data-env-banner-root", "");

  for (const node of bannerNodes(env)) {
    const el = doc.createElement(node.tag);
    for (const [key, value] of Object.entries(node.attrs)) el.setAttribute(key, value);
    el.textContent = node.text;
    root.appendChild(el);
  }

  return root;
}
