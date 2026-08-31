// tests/acceptance/readme-credentials.test.mjs — node G2, owner I4.
//
// README.md is the first path a judge uses for both credentials and browser
// setup. This test parses every `login:` line and proves each one against a
// live server, then locks the launch spelling and deterministic demo URL that
// make the page reachable. The flag-page slug contains "testing" while the
// documented CLI feature is WebMCP; checking whole strings keeps those two
// similar-looking interfaces from drifting back together.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHttpServer } from "../../server/index.mjs";

const README_PATH = new URL("../../README.md", import.meta.url);

function parseLoginLines(readme) {
  const matches = [...readme.matchAll(/`login:\s*([a-z0-9_-]+)`/gi)];
  return matches.map((m) => m[1]);
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
