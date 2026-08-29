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
export function createApp() {
  const sessions = new Map(); // sid -> persona id

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

    sendJson(res, 404, { error: "E_NOT_FOUND" });
  };
}

export function createHttpServer() {
  return createServer(createApp());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  createHttpServer().listen(port, () => {
    console.log(`outpocket server listening on :${port}`);
  });
}
