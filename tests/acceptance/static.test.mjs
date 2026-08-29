// D-50, PM 2026-08-29: scope addition to S1 — server/index.mjs serves no
// static files, while the graph's own edge contracts (S1 -> T2, F1 -> D1)
// always assumed one. Proven here against an injected fixture root rather
// than depending on F1's src/page/index.html having landed: createApp()
// takes { pageRoot } so this test never depends on F1's page existing.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpServer } from "../../server/index.mjs";

function makeFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "outpocket-static-"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>outpocket</title>");
  mkdirSync(join(root, "sub"));
  writeFileSync(join(root, "sub", "app.js"), "console.log('hi');");
  writeFileSync(join(root, "style.css"), "body{margin:0}");
  return root;
}

async function withServer(pageRoot, fn) {
  const server = createHttpServer({ pageRoot });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET / serves index.html from the page root", async () => {
  const root = makeFixtureRoot();
  try {
    await withServer(root, async (base) => {
      const res = await fetch(`${base}/`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type"), /text\/html/);
      assert.match(await res.text(), /outpocket/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a nested static asset resolves with the right content type", async () => {
  const root = makeFixtureRoot();
  try {
    await withServer(root, async (base) => {
      const js = await fetch(`${base}/sub/app.js`);
      assert.equal(js.status, 200);
      assert.match(js.headers.get("content-type"), /javascript/);
      assert.match(await js.text(), /console\.log/);

      const css = await fetch(`${base}/style.css`);
      assert.equal(css.status, 200);
      assert.match(css.headers.get("content-type"), /text\/css/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a missing asset falls through to the JSON 404, not a crash", async () => {
  const root = makeFixtureRoot();
  try {
    await withServer(root, async (base) => {
      const res = await fetch(`${base}/does-not-exist.js`);
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.error, "E_NOT_FOUND");
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("path traversal outside the page root is refused, not served", async () => {
  const root = makeFixtureRoot();
  try {
    await withServer(root, async (base) => {
      const res = await fetch(`${base}/../../../../../../etc/passwd`);
      assert.equal(res.status, 404);
      const encoded = await fetch(`${base}/%2e%2e/%2e%2e/%2e%2e/etc/passwd`);
      assert.equal(encoded.status, 404);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("/api/ routes are never shadowed by static serving, even when a same-named file exists on disk", async () => {
  const root = makeFixtureRoot();
  try {
    mkdirSync(join(root, "api"));
    writeFileSync(join(root, "api", "me"), "not the real handler");
    await withServer(root, async (base) => {
      const res = await fetch(`${base}/api/me`);
      assert.equal(res.status, 401, "the real /api/me handler must still run, not the static file");
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("without an index.html, GET / falls through to the JSON 404 rather than throwing", async () => {
  const root = mkdtempSync(join(tmpdir(), "outpocket-static-empty-"));
  try {
    await withServer(root, async (base) => {
      const res = await fetch(`${base}/`);
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.error, "E_NOT_FOUND");
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the default page root is src/page — F1's index.html has landed and GET / serves it", async () => {
  await withServer(undefined, async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
  });
});
