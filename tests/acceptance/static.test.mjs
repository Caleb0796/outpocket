// D-50, PM 2026-08-29: scope addition to S1 — server/index.mjs serves no
// static files, while the graph's own edge contracts (S1 -> T2, F1 -> D1)
// always assumed one. Proven here against an injected fixture root rather
// than depending on F1's src/page/index.html having landed: createApp()
// takes { pageRoot } so this test never depends on F1's page existing.
//
// D-66, PM 2026-08-29: the served root widened from src/page/ to src/, and
// GET / is now routed explicitly to page/index.html — so the fixture root
// mirrors that one level of nesting (root/page/index.html, not
// root/index.html), matching the real topology instead of the pre-widening
// one.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpServer } from "../../server/index.mjs";

const PAGE_HTML = readFileSync(new URL("../../src/page/index.html", import.meta.url), "utf8");

test("the first screen states the agent boundary, demo roles, contrast token, and keyboard focus", () => {
  assert.ok(PAGE_HTML.includes("<title>outpocket — expense desk</title>"));
  assert.ok(PAGE_HTML.includes("<h1>outpocket — safer expense reports with your own agent</h1>"));
  assert.ok(PAGE_HTML.includes(
    '<p class="lede">Bring your own agent to draft and check expenses inside the session you already use. ' +
    "The server rechecks every change; signing stays in this page and is not exposed as an agent tool. " +
    "Choose Chen to file a report or Ruiz to review one.</p>",
  ));
  assert.ok(PAGE_HTML.includes(">Choose a demo role</h2>"));
  assert.match(PAGE_HTML, /--ink-faint:\s*#6b6f80/);
  assert.match(PAGE_HTML,
    /button:focus-visible, input:focus-visible \{ outline: 3px solid #005fcc; outline-offset: 3px; \}/);
});

function makeFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "outpocket-static-"));
  mkdirSync(join(root, "page"));
  writeFileSync(join(root, "page", "index.html"), "<!doctype html><title>outpocket</title>");
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

  // D-66: the guard is now anchored at src/, and server/ is a real sibling
  // directory one level up — confirm the guard's own test refuses it rather
  // than assuming a re-anchored guard still holds. Plain ".." segments get
  // collapsed by the URL parser before reaching our code (proving nothing
  // about the guard), so this uses the same %2e%2e encoding as above to
  // reach the traversal check with a target that actually exists on disk.
  await withServer(undefined, async (base) => {
    const escaped = await fetch(`${base}/%2e%2e/server/index.mjs`);
    assert.equal(escaped.status, 404, "server/, a sibling of src/, must stay unreachable at the widened root");
    const personas = await fetch(`${base}/%2e%2e/server/personas.json`);
    assert.equal(personas.status, 404);
  });
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

test("the default served root is src/ (D-66) — GET / serves page/index.html and the page's module graph resolves", async () => {
  await withServer(undefined, async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);

    // index.html's one script tag: <script type="module" src="./ui/shell.js">.
    // Resolved against page/index.html, that lands at page/ui/shell.js.
    const shell = await fetch(`${base}/page/ui/shell.js`);
    assert.equal(shell.status, 200, "./ui/shell.js must resolve inside the served root");

    // src/page/tools/compile.js imports "../../erp.js" and
    // src/page/tools/defs.js imports "../../policy.js" — both resolve one
    // segment above src/page/, i.e. to src/erp.js and src/policy.js, which
    // must now be servable since the root widened to src/ (D-66). This is
    // the module-graph-under-the-serving-topology check D-67 named: proven
    // by fetching from a running server, not by reading the paths.
    const erp = await fetch(`${base}/erp.js`);
    assert.equal(erp.status, 200, "../erp.js must resolve inside the widened root");
    const policy = await fetch(`${base}/policy.js`);
    assert.equal(policy.status, 200, "../../policy.js must resolve inside the widened root");
  });
});

test("security and cache headers cover HTML, static assets, API errors, HEAD, and JSON 404s", async () => {
  await withServer(undefined, async (base) => {
    const responses = [
      await fetch(`${base}/`),
      await fetch(`${base}/page/skin.css`),
      await fetch(`${base}/api/me`),
      await fetch(`${base}/missing`),
      await fetch(`${base}/page/skin.css`, { method: "HEAD" }),
    ];

    for (const response of responses) {
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(
        response.headers.get("content-security-policy"),
        "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
      );
    }
  });
});
