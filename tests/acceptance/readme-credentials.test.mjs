// tests/acceptance/readme-credentials.test.mjs — node G2, owner I4.
//
// README.md is the first path a judge uses for both credentials and browser
// setup. This test parses every `login:` line and proves each one against a
// live server, then locks the launch spelling and deterministic demo URL that
// make the page reachable. The same judge path carries copied tool instructions
// and the demo-state disclosure, so this test also keeps a natural-language
// business purpose from becoming a nonexistent schema key and keeps shared
// persona state from reading like tenant isolation. The flag-page slug contains
// "testing" while the documented CLI feature is WebMCP; checking whole strings
// keeps those two similar-looking interfaces from drifting back together. Exact
// positioning checks preserve the qualified runtime and credential claims and
// identify which historical export the one-shot blind review evaluated.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHttpServer } from "../../server/index.mjs";

const README_PATH = new URL("../../README.md", import.meta.url);
const DEVPOST_PATH = new URL("../../docs/DEVPOST.md", import.meta.url);
const JUDGE_GUIDE_PATH = new URL("../../docs/JUDGE-GUIDE.md", import.meta.url);

function parseLoginLines(readme) {
  const matches = [...readme.matchAll(/`login:\s*([a-z0-9_-]+)`/gi)];
  return matches.map((m) => m[1]);
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

async function withServer(fn) {
  const server = createHttpServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("every `login:` line in README.md logs in against the live /api/login, covering exactly {employee, auditor}", async () => {
  const readme = readFileSync(README_PATH, "utf8");
  const personas = parseLoginLines(readme);

  assert.equal(personas.length, 2, "README.md must declare exactly two logins");

  await withServer(async (base) => {
    const roles = new Set();
    for (const persona of personas) {
      const res = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      assert.equal(res.status, 200, `login: ${persona} must return 200`);
      const body = await res.json();
      roles.add(body.role);
    }
    assert.deepEqual([...roles].sort(), ["auditor", "employee"]);
  });
});

test("README.md documents the no-flag ChatGPT path and the canonical Chrome WebMCP setup", () => {
  const readme = readFileSync(README_PATH, "utf8");
  assert.match(readme, /ChatGPT\s+desktop built-in browser/);
  assert.match(readme, /Chrome 149\+/);
  assert.ok(readme.includes("Linux:   google-chrome --enable-features=WebMCP"));
  assert.ok(readme.includes('macOS:   open -a "Google Chrome" --args --enable-features=WebMCP'));
  assert.ok(readme.includes("Windows: chrome.exe --enable-features=WebMCP"));
  assert.ok(readme.includes("chrome://flags/#enable-webmcp-testing"));
  assert.ok(readme.includes("'modelContext' in document"));
  assert.doesNotMatch(readme, /--enable-features=WebMCPTesting/);
});

test("README.md puts the deterministic moving demo on the judge path", () => {
  const readme = readFileSync(README_PATH, "utf8");
  assert.ok(readme.includes("https://outpocket.onrender.com/?demo=1&seed=7"));
  assert.match(readme, /17 distinct tools across 6 registration states/);
});

test("judge-facing copy matches the tool-visible field, result, timing, and demo-state model", () => {
  const readme = readFileSync(README_PATH, "utf8");
  const devpost = readFileSync(DEVPOST_PATH, "utf8");
  const guide = readFileSync(JUDGE_GUIDE_PATH, "utf8");
  const promptField = 'set the description (business purpose) to "Airport transfer"';

  for (const [name, copy] of [["README.md", readme], ["docs/DEVPOST.md", devpost], ["docs/JUDGE-GUIDE.md", guide]]) {
    assert.ok(copy.includes(promptField), `${name} must map the business purpose to description`);
    assert.doesNotMatch(copy, /USD 20\.00, business purpose "Airport transfer"/);
  }

  assert.doesNotMatch(guide, /30-second visual preview/);
  assert.match(guide, /visual preview that completes in a few seconds/);
  assert.ok(guide.includes("The tool's text\nstates `Chain verification: verified`, the `Head:` digest, and the numbered\nday-book entries."));
  assert.ok(readme.includes("The demo personas are shared, not a multi-tenant account model."));
  assert.ok(readme.includes("visitors using one persona in the same running process see and can edit one\n  another's drafts."));
  assert.ok(readme.includes("A deployment restart clears those drafts with the rest of\n  the in-memory state."));
});

test("judge-facing positioning keeps bounded claims and blind-review provenance", () => {
  const readme = collapseWhitespace(readFileSync(README_PATH, "utf8"));
  const devpost = collapseWhitespace(readFileSync(DEVPOST_PATH, "utf8"));

  assert.ok(readme.includes("This site ships no model and runs no model-backed agent: package.json declares no runtime dependencies, and there is no inference call or deployed API key in the repository. When WebMCP is absent, the page can run a clearly labelled deterministic fallback/demo driver through the same dispatcher; it performs no inference."));
  assert.ok(readme.includes("A conventional backend MCP deployment for this ERP would introduce a credential path separate from the employee's current page session and perform the work away from the page the employee is watching. Other backend designs can use delegated or short-lived credentials; our narrower fit claim is that Outpocket adds no new standing ERP credential holder and keeps the work on the page."));
  assert.ok(readme.includes("blind review (the blind review was a one-shot run registered against the export at 5ba890a; later surface changes are covered by the deterministic suites)"));

  assert.ok(devpost.includes("The site ships no model and runs no model-backed agent — package.json declares no runtime dependencies, and the clearly labelled fallback/demo driver performs no inference — so the operator carries no inference hosting or model-specific prompt maintenance."));
  assert.ok(devpost.includes("Relative to the conventional backend MCP deployment we compared, no new standing credential is minted here: that deployment would hold a separate ERP credential and work away from the page, while Outpocket starts from the employee's existing login and keeps the work on the page."));
  assert.ok(devpost.includes("WebMCP is not a wrapper here: the page compiles six distinct registered surfaces from live role, report, and validation state, then replaces each generation so the agent's next turn sees only the actions that currently exist."));
  assert.ok(devpost.includes("The same visible report survives agent entry, human review, the second-call commit, reload, and auditor read-back, making the demo one coherent product path rather than a collection of tool calls."));
  assert.ok(devpost.includes("The first deployable audience is finance teams whose employees already use a browser-based expense desk: they can reduce duplicate entry and policy rework without requiring Outpocket to hold a new standing ERP integration credential."));
  assert.ok(devpost.includes("The ambitious part is the composition: a state-shaped WebMCP menu, server-recomputed policy verdict, snapshot-bound two-call signature, per-field provenance, and a linked audit chain all meet in one browser session."));
});
