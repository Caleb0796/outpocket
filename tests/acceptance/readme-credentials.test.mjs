// tests/acceptance/readme-credentials.test.mjs — node G2, owner I4.
//
// README.md is the only place a judge reads the demo logins from. This test
// parses every `login:` line out of README.md and proves each one actually
// works against a live server — a README claim is not evidence that the
// claim is true, running it is.

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

test("README.md documents both the ChatGPT-built-in-browser path and the Chrome-flag path", () => {
  const readme = readFileSync(README_PATH, "utf8");
  assert.match(readme, /ChatGPT desktop built-in browser/);
  assert.ok(
    readme.includes("--enable-features=WebMCPTesting"),
    "README.md must contain the literal string --enable-features=WebMCPTesting",
  );
});
