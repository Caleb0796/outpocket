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
import { readFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { policyHandler, SERVED_POLICY } from "./routes/policy.mjs";
import { seedState } from "./seed.mjs";
import { createStateDigestHandler } from "./routes/state-digest.mjs";
import { createVersionHandler } from "./routes/version.mjs";
import { createSignGate, SignError } from "./sign.mjs";
import { authorizeWrite, AuthzError } from "./authz.mjs";
import { LockError } from "./locks.mjs";

// S5's persona display names, read from F1's own file (server/personas.json)
// rather than retyped — signed_by must resolve the same name F1 shows.
const personasPath = fileURLToPath(new URL("./personas.json", import.meta.url));
const PERSONA_NAMES = Object.fromEntries(
  JSON.parse(readFileSync(personasPath, "utf8")).personas.map((p) => [p.id, p.name]),
);

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
    let isRootAlias = false;
    try {
      // D-66: GET / is routed to page/index.html explicitly — there is no
      // src/index.html now that the root is src/, not src/page/.
      if (url.pathname === "/") {
        reqPath = "/page/index.html";
        isRootAlias = true;
      } else {
        reqPath = decodeURIComponent(url.pathname);
      }
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
    let body = await readFile(resolved);
    if (isRootAlias && contentType.startsWith("text/html")) {
      // D-66 regression, found post-merge: this document is served AT "/",
      // one level above where the file actually lives (page/index.html).
      // Browsers resolve its relative references — `<script src="./ui/
      // shell.js">`, `<link href="./skin.css">` — against the DOCUMENT URL,
      // not the file's location on disk, so without a base they resolve to
      // /ui/shell.js and 404, shell.js never loads, and no click handler
      // ever attaches (F1's --smoke-login: element exists, not wired).
      // Inject <base href="/page/"> into the served BYTES so every relative
      // reference in the document lands where the files actually live,
      // without editing src/page/index.html — F1/UX's file, not ours.
      const html = body.toString("utf8");
      const withBase = html.replace(/<head[^>]*>/i, (tag) => `${tag}\n<base href="/page/">`);
      body = Buffer.from(withBase, "utf8");
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(req.method === "HEAD" ? undefined : body);
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
export function createApp({ pageRoot = DEFAULT_PAGE_ROOT, signGate: providedSignGate } = {}) {
  const sessions = new Map(); // sid -> persona id
  const state = seedState(); // S9: deterministic on every boot, no clock, no RNG
  const stateDigestHandler = createStateDigestHandler(() => state);
  const versionHandler = createVersionHandler(); // D1 (I4): GET /version
  const serveStatic = makeStaticHandler(pageRoot);

  function findReport(reportId) {
    return state.reports.find((r) => r.id === reportId) ?? null;
  }

  // S6: the default signGate is wired to THIS app's own live report store,
  // so re-canonicalisation-on-commit is real for any report a real write
  // route created. A caller that constructs its own signGate (every
  // existing sign-state/sign-lock test does, with synthetic report_ids and
  // no S2 store behind them) gets that instance's own getLiveReport instead
  // — createSignGate()'s own default (`() => null`) if it didn't set one,
  // which is exactly the pre-S6 behaviour those tests were written against.
  const signGate = providedSignGate ?? createSignGate({ getLiveReport: findReport, getServedPolicy: () => SERVED_POLICY });

  function sessionFromRequest(req) {
    const sid = parseCookies(req.headers.cookie).sid;
    if (!sid) return null;
    const personaId = sessions.get(sid);
    return personaId ? { sid, personaId, ...PERSONAS[personaId] } : null;
  }

  function sendSignError(res, err) {
    if (err instanceof SignError) return sendJson(res, err.http, { error: err.code, message: err.message, ...err.detail });
    throw err;
  }

  function sendAuthzError(res, err) {
    if (err instanceof AuthzError) return sendJson(res, err.http, { error: err.code, message: err.message });
    throw err;
  }

  // S12's lock: while a sign request is open for report_id, every one of
  // these six routes must refuse rather than mutate. Returns true (and has
  // already sent the 423 response) if the caller should stop.
  function blockedByLock(res, reportId) {
    try {
      signGate.locks.assertUnlocked(reportId);
      return false;
    } catch (err) {
      if (!(err instanceof LockError)) throw err;
      sendJson(res, err.http, { error: err.code, message: err.message });
      return true;
    }
  }

  // ── S2: minimal report-content mutation, gated by authorizeWrite() ──────
  // These six routes exist ONLY to give per-request role authorization
  // something real to gate: the server's write path for report content
  // (FX conversion, itemization, receipt hashing, policy-engine validation
  // via src/policy.js) is deliberately not reimplemented here — that is a
  // separate, deeper node's job. Every mutation below is honest but small:
  // a real in-memory state change, an id you can read back, nothing more.
  // (findReport is defined above, shared with S6's getLiveReport wiring.)
  function findLine(report, lineId) {
    return report?.lines.find((l) => l.id === lineId) ?? null;
  }

  async function routeRequest(req, res) {
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
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      return sendJson(res, 200, { persona: session.persona, role: session.role });
    }

    // ── S5: the human sign gate ──────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/sign") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      // S2: opening a sign request is submit_expense_report's write — only
      // an employee session may start one. /respond and /commit are not
      // separately gated (see server/authz.mjs's WRITE_ROUTES comment):
      // both already require the caller's session to be the one that
      // opened it, which after this check can only ever be an employee's.
      try {
        authorizeWrite(session);
      } catch (err) {
        return sendAuthzError(res, err);
      }
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object") return sendJson(res, 400, { error: "E_BAD_REQUEST" });
      try {
        const { signRequest, ticket } = signGate.open({
          sessionId: session.sid,
          personaId: session.personaId,
          personaName: PERSONA_NAMES[session.personaId] ?? session.persona,
          reportId: body.report_id,
          revision: body.revision,
          policyVersion: body.policy_version,
          policyDigest: body.policy_digest,
          report: body.report,
          verdict: body.verdict,
          worstCase: body.worst_case,
          violationHistoryCount: body.violation_history_count,
        });
        return sendJson(res, 200, { sign_request: signRequest, ticket });
      } catch (err) {
        return sendSignError(res, err);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/sign/continue") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object") return sendJson(res, 400, { error: "E_BAD_REQUEST" });
      try {
        const result = signGate.continueTicket({ ticket: body.ticket, sessionId: session.sid, reportId: body.report_id });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendSignError(res, err);
      }
    }

    {
      const signMatch = url.pathname.match(/^\/api\/sign\/([^/]+)$/);
      if (signMatch && req.method === "GET") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          return sendJson(res, 200, signGate.get(signMatch[1], { sessionId: session.sid }));
        } catch (err) {
          return sendSignError(res, err);
        }
      }

      // D-89: the confirm_token channel. Session-scoped, NOT a registered
      // WebMCP tool — nothing in src/page/tools/defs.js may ever wrap this
      // route. That is the entire property PM's ruling requires: the agent
      // cannot read this through the tool surface, because it is not on it.
      const confirmTokenMatch = url.pathname.match(/^\/api\/sign\/([^/]+)\/confirm-token$/);
      if (confirmTokenMatch && req.method === "GET") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          const confirm_token = signGate.peekConfirmTokenForDialog(confirmTokenMatch[1], { sessionId: session.sid });
          return sendJson(res, 200, { confirm_token });
        } catch (err) {
          return sendSignError(res, err);
        }
      }

      const respondMatch = url.pathname.match(/^\/api\/sign\/([^/]+)\/respond$/);
      if (respondMatch && req.method === "POST") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object") return sendJson(res, 400, { error: "E_BAD_REQUEST" });
        if (body.request_id !== respondMatch[1]) return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "request_id in body must match the URL" });
        try {
          const result = signGate.respond({
            requestId: respondMatch[1],
            sessionId: session.sid,
            decision: body.decision,
            reason: body.reason ?? null,
            method: body.method,
            acknowledgedDigest: body.acknowledged_digest,
            acknowledgedRevision: body.acknowledged_revision,
            confirmToken: body.confirm_token,
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendSignError(res, err);
        }
      }
    }

    {
      const commitMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/commit$/);
      if (commitMatch && req.method === "POST") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object") return sendJson(res, 400, { error: "E_BAD_REQUEST" });
        if (body.report_id !== commitMatch[1]) return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "report_id in body must match the URL" });
        try {
          const result = signGate.commit({ requestId: body.request_id, reportId: commitMatch[1], sessionId: session.sid });
          return sendJson(res, result.http_status, result);
        } catch (err) {
          if (!(err instanceof SignError)) throw err;
          return sendJson(res, err.http, {
            schema: "outpocket.commit_result/1",
            status: "rejected",
            http_status: err.http,
            confirmation: null,
            committed_revision: null,
            error: { code: err.code, message: err.message, ...err.detail },
          });
        }
      }
    }

    // ── S2: the six report-content write routes (see WRITE_ROUTES comment
    // above and server/authz.mjs) ────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/reports") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      try {
        authorizeWrite(session);
      } catch (err) {
        return sendAuthzError(res, err);
      }
      const body = await readJsonBody(req);
      if (!body || typeof body.title !== "string" || !body.title.trim() || typeof body.project !== "string" || !body.project.trim()) {
        return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "title and project are required, non-empty strings" });
      }
      const id = `RP-${state.counters.report++}`;
      const report = { id, title: body.title, project: body.project, status: "draft", owner: session.personaId, opened_by: null, lines: [] };
      state.reports.push(report);
      return sendJson(res, 201, { report_id: id, report });
    }

    {
      const openMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/open$/);
      if (openMatch && req.method === "POST") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          authorizeWrite(session);
        } catch (err) {
          return sendAuthzError(res, err);
        }
        const report = findReport(openMatch[1]);
        if (!report) return sendJson(res, 404, { error: "E_REPORT_NOT_FOUND" });
        if (blockedByLock(res, report.id)) return;
        report.opened_by = session.personaId;
        return sendJson(res, 200, { report_id: report.id, opened_by: report.opened_by });
      }
    }

    {
      const linesMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/lines$/);
      if (linesMatch && req.method === "POST") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          authorizeWrite(session);
        } catch (err) {
          return sendAuthzError(res, err);
        }
        const report = findReport(linesMatch[1]);
        if (!report) return sendJson(res, 404, { error: "E_REPORT_NOT_FOUND" });
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        if (!body || typeof body.merchant !== "string" || !body.merchant.trim() || !Number.isInteger(body.amount_cents) || body.amount_cents < 0) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "merchant (string) and amount_cents (non-negative integer) are required" });
        }
        const line = {
          id: `ln_${++state.counters.line}`,
          date: body.date ?? null,
          merchant: body.merchant,
          category: body.category ?? null,
          amount_cents: body.amount_cents,
          currency: body.currency ?? "USD",
          receipt_id: null,
        };
        report.lines.push(line);
        const revision = signGate.locks.bumpRevision(report.id);
        return sendJson(res, 201, { report_id: report.id, line, revision });
      }
    }

    {
      const lineMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/lines\/([^/]+)$/);
      if (lineMatch && (req.method === "PATCH" || req.method === "DELETE")) {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          authorizeWrite(session);
        } catch (err) {
          return sendAuthzError(res, err);
        }
        const report = findReport(lineMatch[1]);
        const line = findLine(report, lineMatch[2]);
        if (!report || !line) return sendJson(res, 404, { error: "E_LINE_NOT_FOUND" });
        if (blockedByLock(res, report.id)) return;

        if (req.method === "DELETE") {
          report.lines = report.lines.filter((l) => l.id !== line.id);
          const revision = signGate.locks.bumpRevision(report.id);
          return sendJson(res, 200, { report_id: report.id, line_id: line.id, revision });
        }

        const body = await readJsonBody(req);
        if (!body || typeof body !== "object") return sendJson(res, 400, { error: "E_BAD_REQUEST" });
        for (const key of ["date", "merchant", "category", "currency"]) {
          if (typeof body[key] === "string") line[key] = body[key];
        }
        if (Number.isInteger(body.amount_cents) && body.amount_cents >= 0) line.amount_cents = body.amount_cents;
        const revision = signGate.locks.bumpRevision(report.id);
        return sendJson(res, 200, { report_id: report.id, line, revision });
      }
    }

    {
      const receiptMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/lines\/([^/]+)\/receipt$/);
      if (receiptMatch && req.method === "POST") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          authorizeWrite(session);
        } catch (err) {
          return sendAuthzError(res, err);
        }
        const report = findReport(receiptMatch[1]);
        const line = findLine(report, receiptMatch[2]);
        if (!report || !line) return sendJson(res, 404, { error: "E_LINE_NOT_FOUND" });
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        if (!body || typeof body.receipt_id !== "string" || !body.receipt_id.trim()) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "receipt_id is required" });
        }
        line.receipt_id = body.receipt_id;
        const revision = signGate.locks.bumpRevision(report.id);
        return sendJson(res, 200, { report_id: report.id, line, revision });
      }
    }

    // S7: the day book, on the auditor surface — D-116 ruled it the DURABLE
    // witness for a signature, not the ephemeral sign-request record — so
    // any signed-in session may read it, employee or auditor alike.
    if (req.method === "GET" && url.pathname === "/api/daybook") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      return sendJson(res, 200, { entries: signGate.chain.list() });
    }

    if (policyHandler(req, res, url)) return;

    if (stateDigestHandler(req, res, url)) return;

    // D1 (I4): mounted BEFORE the static fallback on purpose — the fallback
    // would otherwise answer /version with its own JSON 404 first, and a
    // route shadowed that way is indistinguishable from one never wired.
    if (versionHandler(req, res, url)) return;

    if (await serveStatic(req, res, url)) return;

    sendJson(res, 404, { error: "E_NOT_FOUND" });
  }

  // Top-level guard. routeRequest() is an async function handed straight to
  // node:http as the request listener; if IT throws (or its returned
  // promise rejects) with nothing awaiting it, that is an unhandled
  // rejection, and Node 15+ terminates the WHOLE PROCESS by default — not a
  // 500 to one client, an outage for every client, every in-memory session
  // (S1: sessions live in a plain Map) and every open sign request. That is
  // exactly what one malformed POST /api/sign did before this existed (see
  // server/sign.mjs's own input validation in open() for the specific
  // fix). This is the general one: whatever the NEXT unvalidated route
  // turns out to be, it gets a 500 here instead of killing the server.
  return async function handle(req, res) {
    try {
      await routeRequest(req, res);
    } catch (err) {
      console.error("outpocket: unhandled error in request handler", err);
      if (res.headersSent) {
        res.end();
      } else {
        sendJson(res, 500, { error: "E_INTERNAL", message: "unexpected server error" });
      }
    }
  };
}

export function createHttpServer(opts) {
  return createServer(createApp(opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // PORT=0 must mean "OS-assigned ephemeral port" (node:http honors this),
  // not "unset" — `Number(process.env.PORT) || 3000` treated 0 as falsy and
  // silently fell back to 3000, which is the opposite of what
  // tests/acceptance/curl-403.sh and toctou.sh assumed when they set PORT=0
  // for parallel-safety on a machine running many seats' worktrees at once.
  const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
  const server = createHttpServer();
  server.listen(port, () => {
    // Report the ACTUAL bound port, not the requested one — with PORT=0
    // (OS-assigned ephemeral, now that it is honored instead of silently
    // becoming 3000) those differ, and tests/acceptance/curl-403.sh and
    // toctou.sh both parse this exact line to learn where to curl.
    console.log(`outpocket server listening on :${server.address().port}`);
  });
}
