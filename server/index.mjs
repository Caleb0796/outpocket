// server/index.mjs — outpocket: single-file Node server, cookie session.
//
// Node S1. Contract: erp/contracts/session.contract.md
// Exactly two personas — chen (employee), ruiz (auditor) — matching the frozen
// enum in erp/contracts/eval-case.schema.json. Sessions live in an in-memory
// Map inside this one process; a second instance would not share it, which is
// why deployment must stay at exactly one instance (see S1's node notes and
// S6's TOCTOU closure, both of which depend on that same fact).

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { policyHandler } from "./routes/policy.mjs";
import { seedState } from "./seed.mjs";
import { createStateDigestHandler } from "./routes/state-digest.mjs";

// D-50, PM 2026-08-29: S1's accept never specified a static route, but the
// graph's own edge contracts always assumed one (S1 -> T2 "there is no
// server to serve the page under test"; F1 -> D1 "something to serve").
// Default root is src/page/ — F1's output. Parameterized (not hardcoded) so
// tests can point it at a fixture without depending on F1 having landed.
//
// D-66, PM 2026-08-29: widened from src/page/ to src/. Three files under
// src/page/ import above the page root (register.js -> ../erp.js,
// tools/compile.js -> ../../erp.js, tools/defs.js -> ../../policy.js) —
// src/policy.js and src/erp.js are shared by server/, tests/, harness/ AND
// the page, so re-homing or duplicating them was rejected on architecture,
// not cost. server/ is a SIBLING of src/, not a descendant, so it stays
// unreachable through this root at any depth — see the traversal guard
// below, unchanged, now anchored one level higher. GET / is routed
// explicitly to page/index.html since there is no src/index.html.
const DEFAULT_PAGE_ROOT = fileURLToPath(new URL("../src/", import.meta.url));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function makeStaticHandler(pageRoot) {
  const root = pageRoot.endsWith(sep) ? pageRoot : pageRoot + sep;

  return async function serveStatic(req, res, url) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    if (url.pathname.startsWith("/api/")) return false;

    let reqPath;
    try {
      // D-66: GET / is routed to page/index.html explicitly — there is no
      // src/index.html now that the root is src/, not src/page/.
      reqPath = url.pathname === "/" ? "/page/index.html" : decodeURIComponent(url.pathname);
    } catch {
      return false;
    }
    const resolved = normalize(join(root, reqPath));
    // Traversal guard: the resolved path must stay inside root. Anchored at
    // whatever root is passed in, so widening the root (D-66) re-anchors the
    // guard for free — server/, a sibling of src/, stays unreachable.
    if (!resolved.startsWith(root)) return false;

    let info;
    try {
      info = await stat(resolved);
    } catch {
      return false;
    }
    if (!info.isFile()) return false;

    const contentType = MIME_TYPES[extname(resolved).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(req.method === "HEAD" ? undefined : await readFile(resolved));
    return true;
  };
}

const PERSONAS = {
  chen: Object.freeze({ persona: "chen", role: "employee" }),
  ruiz: Object.freeze({ persona: "ruiz", role: "auditor" }),
};

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

/**
 * createApp() -> request handler, with its own session store closed over it.
 * Kept as a factory (rather than module-level state) so tests can spin up
 * independent servers with independent sessions in the same process.
 */
export function createApp({ pageRoot = DEFAULT_PAGE_ROOT } = {}) {
  const sessions = new Map(); // sid -> persona id
  const state = seedState(); // S9: deterministic on every boot, no clock, no RNG
  const stateDigestHandler = createStateDigestHandler(() => state);
  const serveStatic = makeStaticHandler(pageRoot);

  function sessionFromRequest(req) {
    const sid = parseCookies(req.headers.cookie).sid;
    if (!sid) return null;
    const personaId = sessions.get(sid);
    return personaId ? PERSONAS[personaId] : null;
  }

  return async function handle(req, res) {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      return sendJson(res, 400, { error: "E_BAD_REQUEST" });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readJsonBody(req);
      const personaId = body?.persona;
      if (!Object.hasOwn(PERSONAS, personaId)) {
        return sendJson(res, 400, {
          error: "E_BAD_PERSONA",
          message: "persona must be one of: chen, ruiz",
        });
      }
      const sid = randomBytes(24).toString("hex");
      sessions.set(sid, personaId);
      res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`);
      return sendJson(res, 200, PERSONAS[personaId]);
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const persona = sessionFromRequest(req);
      if (!persona) return sendJson(res, 401, { error: "E_NO_SESSION" });
      return sendJson(res, 200, persona);
    }

    if (policyHandler(req, res, url)) return;

    if (stateDigestHandler(req, res, url)) return;

    if (await serveStatic(req, res, url)) return;

    sendJson(res, 404, { error: "E_NOT_FOUND" });
  };
}

export function createHttpServer(opts) {
  return createServer(createApp(opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  createHttpServer().listen(port, () => {
    console.log(`outpocket server listening on :${port}`);
  });
}
