// H5 — acceptance for src/page/env-banner.js.
//
// WHAT THIS FILE ASSERTS.
// The predicate in erp/graph.json H5.accept, in two halves:
//   (1) the banner text matches /^Chromium \d+ · WebMCP (present|absent)( · simulated agent)?$/
//   (2) a Chromium major below 153 ADDITIONALLY renders a node with [data-warn="chrome-lt-153"]
// Both halves are asserted against the real return values of real functions. There is no DOM
// in node, and no jsdom in this repo (ajv is the only dependency), so the banner is built as
// pure data — bannerText() returns the string, bannerNodes() returns the node descriptors —
// and renderBanner() is a thin walker that turns those descriptors into real elements. The
// accept rests on the pure halves; the walker gets one supplementary test against a ~15-line
// fake document, whose only job is to prove bannerNodes() is load-bearing rather than
// decorative. The fake is NOT evidence about a browser and nothing here claims it is.
//
// WHY THE PRESENCE CHECK IS GRADED OFF document.modelContext AND NEVER THE NAVIGATOR ALIAS —
// the reading evidence/V0.json and evidence/V1.json both record under `navigatorAliasPresent`.
// It is named that way rather than spelled out because tools/lint-layer0.mjs IR-1 bans the
// literal identifier throughout src/** and tests/**; do not "helpfully" restore it, the
// pre-commit gate will reject the commit.
// MEASURED, two independent engines, both recorded in this repo:
//   evidence/V0.json — Chrome 152.0.7977.64, major read from the BINARY, alias absent,
//                      document.modelContext present, 5 tools, invokeTool round-trip Completed.
//   evidence/V1.json — the ChatGPT built-in browser, Chromium 151 (UA-derived), alias absent,
//                      document.modelContext present, 5 tools.
// A banner grading off the alias would therefore print "absent" on BOTH engines while the
// tools worked fine. The two regression tests at the bottom of this file pin that down in
// both directions, because it is the failure this node exists to not ship.
//
// ON THE WARNING RENDERING EVERYWHERE. 152 and 151 are both below 153, so [data-warn] renders
// throughout the demo and throughout the video. erp/graph.json H5.notes (R-8) says that is
// correct and intended: revocation does not interrupt a suspended execute below 153, and this
// banner is how that gap becomes visible instead of mysterious.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readEnv, bannerText, bannerNodes, renderBanner } from "../../src/page/env-banner.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Quoted VERBATIM from erp/graph.json H5.accept. The `·` is U+00B7 MIDDLE DOT, not an ASCII
// full stop and not U+2022 BULLET. The drift guard at the bottom of this file proves this
// source line is still verbatim in the authority; do not edit it without re-running that test.
const BANNER_RE = /^Chromium \d+ · WebMCP (present|absent)( · simulated agent)?$/;
const WARN_ATTR = "data-warn";
const WARN_VALUE = "chrome-lt-153";

// A window-like input for readEnv(). Defaults describe the INSTALLED browser (V0): Chrome 152,
// WebMCP page API present, alias absent, no simulated agent.
function win({
  ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  doc = {},
  nav = {},
  simulated = false,
} = {}) {
  return {
    navigator: { userAgent: ua, ...nav },
    document: { ...doc },
    simulated,
  };
}

// Present / absent page API, spelled the way probe/index.html:74 spells it.
const API_PRESENT = { modelContext: { registerTool() {}, getTools() {}, executeTool() {} } };
const API_ABSENT = {};

function findByAttr(nodes, key, value) {
  const hits = [];
  const walk = (list) => {
    for (const n of list) {
      if (n.attrs && n.attrs[key] === value) hits.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return hits;
}

// ---------------------------------------------------------------------------
// ACCEPT HALF 1 — the banner text matches the predicate's regex.
// ---------------------------------------------------------------------------

test("banner text matches the accept regex with WebMCP present", () => {
  const text = bannerText(readEnv(win({ doc: API_PRESENT })));
  assert.match(text, BANNER_RE, `banner text was ${JSON.stringify(text)}`);
  assert.equal(text, "Chromium 152 · WebMCP present");
});

test("banner text matches the accept regex with WebMCP absent", () => {
  const text = bannerText(readEnv(win({ doc: API_ABSENT })));
  assert.match(text, BANNER_RE, `banner text was ${JSON.stringify(text)}`);
  assert.equal(text, "Chromium 152 · WebMCP absent");
});

test("banner text matches the accept regex with the simulated agent suffix", () => {
  // H3's fallback agent drives the page itself. The charter is explicit that an unlabelled
  // self-driving demo is dishonest, and this suffix is the label H5 owes it.
  const text = bannerText(readEnv(win({ doc: API_PRESENT, simulated: true })));
  assert.match(text, BANNER_RE, `banner text was ${JSON.stringify(text)}`);
  assert.equal(text, "Chromium 152 · WebMCP present · simulated agent");
});

test("banner text still matches the regex when the user-agent carries no Chrome token", () => {
  // The regex REQUIRES \d+, so an unparseable UA still has to yield digits. It reports 0,
  // which is honest (we did not read a major) and conservative (0 < 153, so the warning
  // renders rather than being silently suppressed on an engine we could not identify).
  const env = readEnv(win({ ua: "Mozilla/5.0 (curl)", doc: API_PRESENT }));
  const text = bannerText(env);
  assert.match(text, BANNER_RE, `banner text was ${JSON.stringify(text)}`);
  assert.equal(text, "Chromium 0 · WebMCP present");
  // And it says so, rather than passing 0 off as something it read.
  assert.equal(env.majorSource, "unknown");
});

test("the real headless Chrome 152 user-agent reads as major 152", () => {
  // MEASURED 2026-08-29 on this machine: Google Chrome 152.0.7977.64 launched
  // `--headless=new` reports the string below — note `HeadlessChrome/152.0.0.0`, NOT
  // `Chrome/152.0.0.0`. It matches only because `HeadlessChrome/152` CONTAINS `Chrome/152`.
  //
  // Added after measuring, and it passed on the first run — so it earns no test-first credit.
  // It is here because the near-miss is real: `/\sChrome\/(\d+)/`, requiring whitespace before
  // the token, is an equally natural regex that matches the HEADED user-agent and silently
  // returns 0 on this one. H2's evals run headless in CI, so that bug would have shown up only
  // there, only as a wrong banner. Every other UA in this file is synthetic; this one is not.
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36";
  const env = readEnv(win({ ua, doc: API_PRESENT }));
  assert.equal(env.chromiumMajor, 152);
  assert.equal(env.majorSource, "user-agent");
  assert.equal(bannerText(env), "Chromium 152 · WebMCP present");
  assert.equal(findByAttr(bannerNodes(env), WARN_ATTR, WARN_VALUE).length, 1);
});

test("the banner text node excludes the warning text", () => {
  // Structural, and the reason the warning is a SIBLING and not a child: if [data-warn] sat
  // inside the element being text-matched, its prose would land in that element's textContent
  // and break the regex. This test fails if anyone ever nests them.
  const nodes = bannerNodes(readEnv(win({ doc: API_PRESENT })));
  const [banner] = findByAttr(nodes, "data-env-banner", "");
  assert.ok(banner, "no node carried [data-env-banner]");
  assert.match(banner.text, BANNER_RE, `banner node text was ${JSON.stringify(banner.text)}`);
  assert.equal(
    findByAttr([banner], WARN_ATTR, WARN_VALUE).length,
    0,
    "warning is nested inside the banner text node",
  );
});

// ---------------------------------------------------------------------------
// ACCEPT HALF 2 — a Chromium major below 153 additionally renders [data-warn].
// ---------------------------------------------------------------------------

test("Chromium 152 — the installed major — additionally renders [data-warn=chrome-lt-153]", () => {
  // MEASURED, evidence/V0.json: the installed binary is Google Chrome 152.0.7977.64.
  const nodes = bannerNodes(readEnv(win({ ua: "Chrome/152.0.0.0", doc: API_PRESENT })));
  assert.equal(findByAttr(nodes, WARN_ATTR, WARN_VALUE).length, 1);
});

test("Chromium 151 — the ChatGPT built-in browser — additionally renders [data-warn=chrome-lt-153]", () => {
  // TRANSCRIBED, evidence/V1.json: the built-in browser is Chromium 151, UA-derived.
  const nodes = bannerNodes(readEnv(win({ ua: "Chrome/151.0.0.0", doc: API_PRESENT })));
  assert.equal(findByAttr(nodes, WARN_ATTR, WARN_VALUE).length, 1);
});

test("Chromium 152 renders the warning even when WebMCP is absent", () => {
  const nodes = bannerNodes(readEnv(win({ ua: "Chrome/152.0.0.0", doc: API_ABSENT })));
  assert.equal(findByAttr(nodes, WARN_ATTR, WARN_VALUE).length, 1);
});

// The two tests below are NEGATIVE assertions, and a bare `count === 0` passes vacuously
// against an empty tree — it cannot tell "correctly suppressed the warning" from "rendered
// nothing at all". Both were observed passing against an inert stub. Each therefore asserts
// the banner node IS present first, so the absence of the warning is a real observation.

test("Chromium 153 does not render [data-warn=chrome-lt-153]", () => {
  const nodes = bannerNodes(readEnv(win({ ua: "Chrome/153.0.0.0", doc: API_PRESENT })));
  assert.equal(findByAttr(nodes, "data-env-banner", "").length, 1, "banner node itself is missing");
  assert.equal(findByAttr(nodes, WARN_ATTR, WARN_VALUE).length, 0, "153 is not below 153");
});

test("Chromium 154 does not render [data-warn=chrome-lt-153]", () => {
  const nodes = bannerNodes(readEnv(win({ ua: "Chrome/154.0.0.0", doc: API_PRESENT })));
  assert.equal(findByAttr(nodes, "data-env-banner", "").length, 1, "banner node itself is missing");
  assert.equal(findByAttr(nodes, WARN_ATTR, WARN_VALUE).length, 0);
});

test("an unparseable user-agent renders the warning rather than suppressing it", () => {
  const nodes = bannerNodes(readEnv(win({ ua: "Mozilla/5.0 (curl)", doc: API_PRESENT })));
  assert.equal(findByAttr(nodes, WARN_ATTR, WARN_VALUE).length, 1);
});

// ---------------------------------------------------------------------------
// REGRESSION — presence is graded off document.modelContext, never the alias.
// ---------------------------------------------------------------------------

test("WebMCP reads present when document.modelContext exists and the navigator alias does not", () => {
  // This is the shape MEASURED on BOTH engines (V0: Chrome 152; V1: built-in Chromium 151).
  // Grading off the alias here would print "absent" on every browser this project runs on.
  const env = readEnv(win({ doc: API_PRESENT, nav: {} }));
  assert.equal(env.webmcpPresent, true);
  assert.equal(bannerText(env), "Chromium 152 · WebMCP present");
});

test("WebMCP reads absent when only the navigator alias exists", () => {
  // The inverse guard. HANDOVER §3 rule 1: the alias was removed in Chromium 150. If some
  // engine ever ships the alias without the page API, the tools are still unreachable and the
  // banner must say absent. Never grade off the alias in either direction.
  const env = readEnv(win({ doc: API_ABSENT, nav: { modelContext: {} } }));
  assert.equal(env.webmcpPresent, false);
  assert.equal(bannerText(env), "Chromium 152 · WebMCP absent");
});

test("a null document.modelContext reads absent", () => {
  // probe/index.html:74 tests `!== undefined && !== null`. Same rule here.
  const env = readEnv(win({ doc: { modelContext: null } }));
  assert.equal(env.webmcpPresent, false);
});

test("readEnv records that the major is user-agent derived, not read from the binary", () => {
  // evidence/V1.json flags exactly this caveat about its own chromiumMajor. A page cannot read
  // the binary's version; only the launcher can. The banner must not imply otherwise.
  const env = readEnv(win({ doc: API_PRESENT }));
  assert.equal(env.majorSource, "user-agent");
});

// ---------------------------------------------------------------------------
// The walker — proves bannerNodes() is load-bearing and reaches real DOM calls.
// ---------------------------------------------------------------------------

test("renderBanner sets the data-warn attribute through real DOM calls", () => {
  // A ~15-line fake document implementing exactly the four DOM methods renderBanner uses.
  // It proves the walker emits the attribute; it is not evidence about any browser.
  const created = [];
  const doc = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        attrs: {},
        children: [],
        textContent: "",
        setAttribute(k, v) {
          this.attrs[k] = String(v);
        },
        appendChild(c) {
          this.children.push(c);
          return c;
        },
      };
      created.push(el);
      return el;
    },
  };
  const root = renderBanner(doc, readEnv(win({ ua: "Chrome/152.0.0.0", doc: API_PRESENT })));
  assert.ok(created.length > 0, "renderBanner created no elements");
  assert.equal(findByAttr(root.children, WARN_ATTR, WARN_VALUE).length, 1);
  const [banner] = findByAttr(root.children, "data-env-banner", "");
  assert.ok(banner, "no rendered node carried [data-env-banner]");
  assert.match(banner.textContent, BANNER_RE, `rendered text was ${JSON.stringify(banner.textContent)}`);
});

// ---------------------------------------------------------------------------
// Drift guard — the regex above is still verbatim in the authority.
// ---------------------------------------------------------------------------

test("BANNER_RE is verbatim in erp/graph.json H5.accept", () => {
  // erp/graph.json is an authority and is never edited by this seat. This test proves the
  // constant at the top of this file was copied out of it and has not drifted since.
  const graph = JSON.parse(fs.readFileSync(path.join(ROOT, "erp", "graph.json"), "utf8"));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : Object.values(graph.nodes ?? {});
  const h5 = nodes.find((n) => n.id === "H5");
  assert.ok(h5, "no H5 node in erp/graph.json");
  assert.ok(
    h5.accept.includes(BANNER_RE.source),
    `H5.accept does not contain the regex source ${BANNER_RE.source}\naccept was:\n${h5.accept}`,
  );
  assert.ok(
    h5.accept.includes(`[${WARN_ATTR}="${WARN_VALUE}"]`),
    "H5.accept does not name the warn attribute selector",
  );
});
