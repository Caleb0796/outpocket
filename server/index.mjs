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
import { createSignGate, evaluateServerVerdict, SignError } from "./sign.mjs";
import {
  authorizeWrite,
  authorizeReportRead,
  authorizeReportWrite,
  AuthzError,
} from "./authz.mjs";
import { LockError } from "./locks.mjs";
import { createReportStore, LINE_FIELDS, StoreError } from "./store.mjs";
import { verifyChain } from "./chain.mjs";
import { CATEGORIES, FX, parseDate, toUsdCents } from "../src/policy.js";
import { PERSONAS as ERP_PERSONAS } from "../src/erp.js";

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

const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

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
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      continue;
    }
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
export function createApp({
  pageRoot = DEFAULT_PAGE_ROOT,
  signGate: providedSignGate,
  secureCookies = process.env.RENDER === "true" || process.env.NODE_ENV === "production",
} = {}) {
  const sessions = new Map(); // sid -> persona id
  const sessionCookieName = secureCookies ? "__Host-outpocket_sid" : "sid";
  const sessionCookieAttributes = secureCookies
    ? "Secure; HttpOnly; SameSite=Lax; Path=/"
    : "HttpOnly; SameSite=Lax; Path=/";
  const reportStore = createReportStore();
  reportStore.seed(seedState());
  const stateDigestHandler = createStateDigestHandler(() => reportStore.stateProjection());
  const versionHandler = createVersionHandler(); // D1 (I4): GET /version
  const serveStatic = makeStaticHandler(pageRoot);

  function reportProjection(reportId) {
    const report = reportStore.getReport(reportId);
    if (!report) return null;
    const lines = report.lines.map((line) => {
      const value = (field) => line.fields[field].value;
      const receiptId = value("receipt_id");
      const receipt = receiptId ? reportStore.getReceipt(receiptId) : null;
      const amountCents = value("amount");
      const currency = value("currency");
      return {
        amount_cents: amountCents,
        attendees: value("attendees"),
        category: value("category"),
        currency,
        date: value("date"),
        description: value("description"),
        id: line.id,
        itemization: value("itemization"),
        merchant: value("merchant"),
        nights: value("nights"),
        provenance: Object.fromEntries(LINE_FIELDS.map((field) => [field, line.fields[field].source])),
        receipt_id: receiptId,
        receipt_sha256: receipt?.sha256 ?? null,
        usd_cents: amountCents === null ? null : toUsdCents(amountCents, currency),
      };
    });
    return {
      created_at: report.createdAt,
      id: report.id,
      lines,
      owner: report.owner,
      project: report.fields.project.value,
      revision: report.revision,
      signature: report.signature,
      status: report.status,
      submitted_at: report.submittedAt,
      title: report.fields.title.value,
      total_usd_cents: lines.reduce((total, line) => total + (line.usd_cents ?? 0), 0),
      artifact: report.artifact,
    };
  }

  function provenanceProjection(reportId) {
    const report = reportStore.getReport(reportId);
    if (!report) return null;
    return {
      report: report.fields,
      lines: report.lines,
      ledger: reportStore.dayBookForReport(reportId),
    };
  }

  const reportAuthority = {
    getLiveReport: reportProjection,
    prepareReportCommit: ({ reportId, expectedRevision, artifact, signedBy, submittedAt }) =>
      reportStore.prepareSubmission(reportId, { expectedRevision, artifact, signedBy, submittedAt }),
  };
  const signGate = providedSignGate ?? createSignGate({
    ...reportAuthority,
    getServedPolicy: () => SERVED_POLICY,
  });
  if (providedSignGate) {
    providedSignGate.setReportAuthority(reportAuthority);
  }

  function sessionFromRequest(req) {
    const sid = parseCookies(req.headers.cookie)[sessionCookieName];
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

  function sendStoreError(res, err) {
    if (err instanceof StoreError) return sendJson(res, err.http, { error: err.code, message: err.message });
    throw err;
  }

  function unexpectedFields(body, allowed) {
    return Object.keys(body).filter((key) => !allowed.includes(key));
  }

  function requireReportAccess(session, reportId, { write = false } = {}) {
    const report = reportProjection(reportId);
    if (!report) throw new StoreError("E_REPORT_NOT_FOUND", 404, "no such report");
    if (write) authorizeReportWrite(session, report);
    else authorizeReportRead(session, report);
    return report;
  }

  function personaScope(personaId) {
    return ERP_PERSONAS.find((persona) => persona.id === personaId) ?? null;
  }

  function parseLineFields(body, { partial = false } = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new StoreError("E_BAD_REQUEST", 400, "line body must be a JSON object");
    }
    const allowed = [
      "date", "merchant", "category", "amount_cents", "currency",
      "attendees", "nights", "itemization", "description",
    ];
    const extra = unexpectedFields(body, allowed);
    if (extra.length) throw new StoreError("E_BAD_REQUEST", 400, `unknown line field(s): ${extra.join(", ")}`);
    if (partial && Object.keys(body).length === 0) {
      throw new StoreError("E_BAD_REQUEST", 400, "line patch must change at least one field");
    }
    if (!partial) {
      const missing = ["date", "merchant", "category", "amount_cents"].filter((key) => !Object.hasOwn(body, key));
      if (missing.length) throw new StoreError("E_BAD_REQUEST", 400, `missing line field(s): ${missing.join(", ")}`);
    }

    const fields = {};
    if (Object.hasOwn(body, "date")) {
      if (!parseDate(body.date)) {
        throw new StoreError("E_BAD_REQUEST", 400, "date must be a valid calendar date in YYYY-MM-DD form");
      }
      fields.date = body.date;
    }
    if (Object.hasOwn(body, "merchant")) {
      if (typeof body.merchant !== "string" || !body.merchant.trim()) {
        throw new StoreError("E_BAD_REQUEST", 400, "merchant must be a non-empty string");
      }
      fields.merchant = body.merchant.trim();
    }
    if (Object.hasOwn(body, "category")) {
      const category = typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
      if (!CATEGORIES.includes(category)) {
        throw new StoreError("E_BAD_REQUEST", 400, `category must be one of: ${CATEGORIES.join(", ")}`);
      }
      fields.category = category;
    }
    if (Object.hasOwn(body, "amount_cents")) {
      if (!Number.isSafeInteger(body.amount_cents) || body.amount_cents <= 0) {
        throw new StoreError("E_BAD_REQUEST", 400, "amount_cents must be a positive safe integer");
      }
      fields.amount = body.amount_cents;
    }
    if (Object.hasOwn(body, "currency")) {
      const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
      if (!Object.hasOwn(FX, currency)) {
        throw new StoreError("E_BAD_REQUEST", 400, `currency must be one of: ${Object.keys(FX).join(", ")}`);
      }
      fields.currency = currency;
    } else if (!partial) {
      fields.currency = "USD";
    }
    for (const field of ["attendees", "nights"]) {
      if (!Object.hasOwn(body, field)) continue;
      if (body[field] !== null && (!Number.isSafeInteger(body[field]) || body[field] < 1)) {
        throw new StoreError("E_BAD_REQUEST", 400, `${field} must be null or a safe integer at least 1`);
      }
      fields[field] = body[field];
    }
    if (Object.hasOwn(body, "description")) {
      if (body.description !== null && typeof body.description !== "string") {
        throw new StoreError("E_BAD_REQUEST", 400, "description must be a string or null");
      }
      fields.description = typeof body.description === "string" ? body.description.trim() : null;
    }
    if (Object.hasOwn(body, "itemization")) {
      if (body.itemization !== null && !Array.isArray(body.itemization)) {
        throw new StoreError("E_BAD_REQUEST", 400, "itemization must be an array or null");
      }
      fields.itemization = body.itemization === null ? null : body.itemization.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new StoreError("E_BAD_REQUEST", 400, `itemization[${index}] must be an object`);
        }
        const itemExtra = unexpectedFields(item, ["label", "amount_cents"]);
        if (itemExtra.length || typeof item.label !== "string" || !item.label.trim()
            || !Number.isSafeInteger(item.amount_cents) || item.amount_cents <= 0) {
          throw new StoreError("E_BAD_REQUEST", 400, `itemization[${index}] needs exactly label and positive safe integer amount_cents`);
        }
        return { label: item.label.trim(), amount_cents: item.amount_cents };
      });
    }
    return fields;
  }

  function assertSafeMoneyMutation(report, fields, lineId = null) {
    const current = lineId ? report.lines.find((line) => line.id === lineId) : null;
    const amountCents = Object.hasOwn(fields, "amount") ? fields.amount : current?.amount_cents;
    const currency = Object.hasOwn(fields, "currency") ? fields.currency : current?.currency;
    const usdCents = toUsdCents(amountCents, currency);
    if (!Number.isSafeInteger(usdCents)) {
      throw new StoreError("E_BAD_REQUEST", 400,
        "line amount and report total must stay within the safe integer range after currency conversion");
    }
    let total = usdCents;
    for (const line of report.lines) {
      if (line.id === lineId) continue;
      if (!Number.isSafeInteger(line.usd_cents)
          || !Number.isSafeInteger(total + line.usd_cents)) {
        throw new StoreError("E_BAD_REQUEST", 400,
          "line amount and report total must stay within the safe integer range after currency conversion");
      }
      total += line.usd_cents;
    }
  }

  // S12's lock: while a sign request is open for report_id, every one of
  // these report routes must refuse rather than mutate. Returns true (and has
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

  function agentWrite(tool) {
    return { source: "agent", actor: "agent", tool };
  }

  function humanWrite(session) {
    return { source: "human", actor: PERSONA_NAMES[session.personaId] ?? session.personaId, tool: null };
  }

  function reportPayload(reportId) {
    const report = reportProjection(reportId);
    return {
      report,
      provenance: provenanceProjection(reportId),
      receipts: reportStore.listReceipts().filter((receipt) => receipt.owner === report.owner),
    };
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
      res.setHeader("Set-Cookie", `${sessionCookieName}=${sid}; ${sessionCookieAttributes}`);
      return sendJson(res, 200, PERSONAS[personaId]);
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      return sendJson(res, 200, { persona: session.persona, role: session.role });
    }

    if (req.method === "GET" && url.pathname === "/api/reports") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      const reports = reportStore.listReports()
        .filter((report) => session.role === "auditor" || report.owner === session.personaId)
        .map((report) => reportProjection(report.id));
      return sendJson(res, 200, { reports });
    }

    if (req.method === "GET" && url.pathname === "/api/receipts") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      const receipts = reportStore.listReceipts()
        .filter((receipt) => session.role === "auditor" || receipt.owner === session.personaId);
      return sendJson(res, 200, { receipts });
    }

    {
      const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
      if (reportMatch && req.method === "GET") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          const report = requireReportAccess(session, reportMatch[1]);
          return sendJson(res, 200, reportPayload(report.id));
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
      }
    }

    {
      const validationMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/validation$/);
      if (validationMatch && req.method === "GET") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        try {
          const report = requireReportAccess(session, validationMatch[1]);
          const verdict = evaluateServerVerdict(report, {
            personaId: report.owner,
            personaName: PERSONA_NAMES[report.owner] ?? report.owner,
            servedPolicy: SERVED_POLICY,
            now: () => new Date(),
          });
          return sendJson(res, 200, { verdict, ...reportPayload(report.id) });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          if (err instanceof SignError) return sendSignError(res, err);
          return sendStoreError(res, err);
        }
      }
    }

    if (req.method === "POST" && url.pathname === "/api/ui/receipts") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      try {
        authorizeWrite(session);
      } catch (err) {
        return sendAuthzError(res, err);
      }
      const body = await readJsonBody(req);
      const extra = body && typeof body === "object" && !Array.isArray(body)
        ? unexpectedFields(body, ["filename", "size", "sha256"])
        : [];
      if (!body || typeof body !== "object" || Array.isArray(body)
          || extra.length
          || typeof body.filename !== "string" || !body.filename.trim()
          || !Number.isSafeInteger(body.size) || body.size < 1
          || typeof body.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(body.sha256)) {
        return sendJson(res, 400, {
          error: "E_BAD_REQUEST",
          message: "receipt metadata must contain exactly a non-empty filename, positive safe integer size, and lowercase SHA-256",
        });
      }
      const receipt = reportStore.addReceipt({
        owner: session.personaId,
        filename: body.filename.trim(),
        size: body.size,
        sha256: body.sha256,
      });
      const receipts = reportStore.listReceipts().filter((entry) => entry.owner === session.personaId);
      return sendJson(res, 201, { receipt, receipts });
    }

    {
      const uiReportMatch = url.pathname.match(/^\/api\/ui\/reports\/([^/]+)$/);
      if (uiReportMatch && req.method === "PATCH") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        let report;
        try {
          report = requireReportAccess(session, uiReportMatch[1], { write: true });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)
            || Object.keys(body).length === 0
            || unexpectedFields(body, ["title", "project"]).length) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "report patch must contain only title or project" });
        }
        const patch = {};
        if (Object.hasOwn(body, "title")) {
          if (typeof body.title !== "string" || !body.title.trim()) {
            return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "title must be a non-empty string" });
          }
          patch.title = body.title.trim();
        }
        if (Object.hasOwn(body, "project")) {
          const project = typeof body.project === "string" ? body.project.trim().toUpperCase() : "";
          const scopedProject = personaScope(session.personaId)?.projects.find((entry) => entry.code === project);
          if (!scopedProject || !scopedProject.active) {
            return sendJson(res, 403, { error: "E_PROJECT_FORBIDDEN", message: `project ${project || "(none)"} is not active in this session's scope` });
          }
          patch.project = project;
        }
        try {
          reportStore.updateReport(report.id, patch, humanWrite(session));
          return sendJson(res, 200, { report_id: report.id, ...reportPayload(report.id) });
        } catch (err) {
          return sendStoreError(res, err);
        }
      }
    }

    {
      const uiLineMatch = url.pathname.match(/^\/api\/ui\/reports\/([^/]+)\/lines\/([^/]+)$/);
      if (uiLineMatch && req.method === "PATCH") {
        const session = sessionFromRequest(req);
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
        let report;
        try {
          report = requireReportAccess(session, uiLineMatch[1], { write: true });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
        const line = reportStore.getLine(report.id, uiLineMatch[2]);
        if (!line) return sendJson(res, 404, { error: "E_LINE_NOT_FOUND", message: "no such line" });
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        try {
          const patch = parseLineFields(body, { partial: true });
          assertSafeMoneyMutation(report, patch, line.id);
          reportStore.updateLine(report.id, line.id, patch, humanWrite(session));
          const payload = reportPayload(report.id);
          return sendJson(res, 200, {
            report_id: report.id,
            line: payload.report.lines.find((entry) => entry.id === line.id),
            ...payload,
          });
        } catch (err) {
          return sendStoreError(res, err);
        }
      }
    }

    // ── S5: the human sign gate ──────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/sign") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      // S2: opening a sign request is submit_expense_report's write — only
      // an employee session may start one. The later response and commit
      // routes repeat this role check before their request bodies are read.
      try {
        authorizeWrite(session);
      } catch (err) {
        return sendAuthzError(res, err);
      }
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(res, 400, { error: "E_BAD_SIGN_REQUEST", message: "request body must be a JSON object" });
      }
      if (typeof body.report_id !== "string" || !body.report_id) {
        return sendJson(res, 400, { error: "E_BAD_SIGN_REQUEST", message: "report_id is required" });
      }
      try {
        requireReportAccess(session, body.report_id, { write: true });
      } catch (err) {
        if (err instanceof AuthzError) return sendAuthzError(res, err);
        return sendStoreError(res, err);
      }
      const extra = unexpectedFields(body, ["report_id", "worst_case", "violation_history_count"]);
      if (extra.length) {
        return sendJson(res, 400, {
          error: "E_BAD_SIGN_REQUEST",
          message: `sign request contains client authority field(s): ${extra.join(", ")}`,
        });
      }
      if (body.worst_case !== undefined && (typeof body.worst_case !== "string" || !body.worst_case)) {
        return sendJson(res, 400, { error: "E_BAD_SIGN_REQUEST", message: "worst_case must be a non-empty string" });
      }
      if (body.violation_history_count !== undefined
          && (!Number.isSafeInteger(body.violation_history_count) || body.violation_history_count < 0)) {
        return sendJson(res, 400, { error: "E_BAD_SIGN_REQUEST", message: "violation_history_count must be a non-negative safe integer" });
      }
      try {
        const { signRequest, ticket } = signGate.open({
          sessionId: session.sid,
          personaId: session.personaId,
          personaName: PERSONA_NAMES[session.personaId] ?? session.persona,
          reportId: body.report_id,
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
        try {
          authorizeWrite(session);
        } catch (err) {
          return sendAuthzError(res, err);
        }
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
        if (!session) return sendJson(res, 401, { error: "E_NO_SESSION", message: "authentication is required" });
        try {
          authorizeWrite(session);
        } catch (err) {
          return sendAuthzError(res, err);
        }
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "request body must be a JSON object" });
        }
        if (body.schema !== "outpocket.commit_request/1" || typeof body.request_id !== "string" || !body.request_id) {
          return sendJson(res, 400, {
            error: "E_BAD_REQUEST",
            message: "commit request needs schema outpocket.commit_request/1 and a non-empty request_id",
          });
        }
        if (body.report_id !== commitMatch[1]) return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "report_id in body must match the URL" });
        const extra = unexpectedFields(body, ["schema", "request_id", "report_id"]);
        if (extra.length) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: `commit request has unknown field(s): ${extra.join(", ")}` });
        }
        try {
          requireReportAccess(session, commitMatch[1], { write: true });
          const result = signGate.commit({ requestId: body.request_id, reportId: commitMatch[1], sessionId: session.sid });
          return sendJson(res, result.http_status, result);
        } catch (err) {
          if (err instanceof SignError) return sendJson(res, err.http, { error: err.code, message: err.message });
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
      }
    }

    // ── S2: agent report-content write routes (see WRITE_ROUTES comment
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
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "request body must be a JSON object" });
      }
      const extra = unexpectedFields(body, ["title", "project"]);
      if (extra.length || typeof body.title !== "string" || !body.title.trim()
          || typeof body.project !== "string" || !body.project.trim()) {
        return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "title and project are required, non-empty strings" });
      }
      const project = body.project.trim().toUpperCase();
      const scopedProject = personaScope(session.personaId)?.projects.find((entry) => entry.code === project);
      if (!scopedProject || !scopedProject.active) {
        return sendJson(res, 403, { error: "E_PROJECT_FORBIDDEN", message: `project ${project} is not active in this session's scope` });
      }
      try {
        const stored = reportStore.createReport({
          title: body.title.trim(),
          project,
          owner: session.personaId,
        }, agentWrite("create_expense_report"));
        return sendJson(res, 201, { report_id: stored.id, ...reportPayload(stored.id) });
      } catch (err) {
        return sendStoreError(res, err);
      }
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
        let report;
        try {
          report = requireReportAccess(session, openMatch[1], { write: true });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "open request body must be an empty object" });
        }
        return sendJson(res, 200, { report_id: report.id, ...reportPayload(report.id) });
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
        let report;
        try {
          report = requireReportAccess(session, linesMatch[1], { write: true });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        try {
          const fields = parseLineFields(body);
          assertSafeMoneyMutation(report, fields);
          const storedLine = reportStore.addLine(report.id, fields, agentWrite("add_expense_line"));
          const payload = reportPayload(report.id);
          return sendJson(res, 201, {
            report_id: report.id,
            line_id: storedLine.id,
            line: payload.report.lines.find((entry) => entry.id === storedLine.id),
            ...payload,
          });
        } catch (err) {
          return sendStoreError(res, err);
        }
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
        let report;
        try {
          report = requireReportAccess(session, lineMatch[1], { write: true });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
        const line = reportStore.getLine(report.id, lineMatch[2]);
        if (!line) return sendJson(res, 404, { error: "E_LINE_NOT_FOUND", message: "no such line" });
        if (blockedByLock(res, report.id)) return;

        if (req.method === "DELETE") {
          const body = await readJsonBody(req);
          if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) {
            return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "remove request body must be an empty object" });
          }
          try {
            reportStore.removeLine(report.id, line.id);
            return sendJson(res, 200, { report_id: report.id, line_id: line.id, ...reportPayload(report.id) });
          } catch (err) {
            return sendStoreError(res, err);
          }
        }

        const body = await readJsonBody(req);
        try {
          const patch = parseLineFields(body, { partial: true });
          assertSafeMoneyMutation(report, patch, line.id);
          reportStore.updateLine(report.id, line.id, patch, agentWrite("update_expense_line"));
          const payload = reportPayload(report.id);
          return sendJson(res, 200, {
            report_id: report.id,
            line: payload.report.lines.find((entry) => entry.id === line.id),
            ...payload,
          });
        } catch (err) {
          return sendStoreError(res, err);
        }
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
        let report;
        try {
          report = requireReportAccess(session, receiptMatch[1], { write: true });
        } catch (err) {
          if (err instanceof AuthzError) return sendAuthzError(res, err);
          return sendStoreError(res, err);
        }
        const line = reportStore.getLine(report.id, receiptMatch[2]);
        if (!line) return sendJson(res, 404, { error: "E_LINE_NOT_FOUND", message: "no such line" });
        if (blockedByLock(res, report.id)) return;
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)
            || unexpectedFields(body, ["receipt_id"]).length
            || typeof body.receipt_id !== "string" || !body.receipt_id.trim()) {
          return sendJson(res, 400, { error: "E_BAD_REQUEST", message: "receipt_id is required" });
        }
        try {
          reportStore.linkReceipt(report.id, line.id, body.receipt_id.trim(), agentWrite("link_receipt"));
          const payload = reportPayload(report.id);
          return sendJson(res, 200, {
            report_id: report.id,
            line: payload.report.lines.find((entry) => entry.id === line.id),
            ...payload,
          });
        } catch (err) {
          return sendStoreError(res, err);
        }
      }
    }

    // S7: the day book, on the auditor surface — D-116 ruled it the DURABLE
    // witness for a signature, not the ephemeral sign-request record — so
    // any signed-in session may read it, employee or auditor alike.
    if (req.method === "GET" && url.pathname === "/api/daybook") {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: "E_NO_SESSION" });
      const entries = signGate.chain.list();
      return sendJson(res, 200, {
        entries,
        head: signGate.chain.currentHead(),
        verification: verifyChain(entries),
      });
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
    for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
      res.setHeader(name, value);
    }
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
