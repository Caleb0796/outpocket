// server/routes/policy.mjs — GET /api/policy.
//
// Node S3. Contract: erp/contracts/policy.schema.json x-versionDiscipline,
// ruling R-33 half two. The version lock (erp/contracts/policy-versions.json)
// does not run only in the test suite: it runs here, at server policy LOAD,
// and REFUSES TO SERVE a document whose (version, digest, canonical_bytes)
// triple is not pinned — declining to serve any policy at all rather than
// serving a doctored one under an unchanged version string. That is the half
// of the same-version content swap the signed-snapshot projection change
// (S5/S6) cannot reach on its own.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canon, digest as ocfDigest } from "../../src/canonical.js";
import { POLICY_DOCUMENT } from "../../src/policy.js";

const versionsPath = fileURLToPath(new URL("../../erp/contracts/policy-versions.json", import.meta.url));

export function readVersionLock() {
  return JSON.parse(readFileSync(versionsPath, "utf8"));
}

/**
 * verifyPolicyDocument(document, lock) -> { ok, digest, canonical_bytes, entry }
 * Recomputes the OCF-1 digest and canonical byte count of `document` and
 * checks that the (version, digest, canonical_bytes) triple is present in
 * `lock` (the parsed erp/contracts/policy-versions.json). Pure — no I/O — so
 * the exact check that runs at server load can also be run against an
 * injected, deliberately doctored document in a test.
 */
export function verifyPolicyDocument(document, lock) {
  const canonicalBytes = Buffer.byteLength(canon(document), "utf8");
  const documentDigest = ocfDigest(lock.digest_prefix, document);
  const entry = lock.versions.find(
    (v) => v.version === document.version && v.digest === documentDigest && v.canonical_bytes === canonicalBytes,
  );
  return { ok: Boolean(entry), digest: documentDigest, canonical_bytes: canonicalBytes, entry };
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

/**
 * createPolicyHandler(document, lock) -> handler(req, res, url) -> boolean
 * The verification runs once, when the handler is created — at server policy
 * load, not per request and not only in a test. Returns a handler that
 * claims GET /api/policy; returns false for any other request so the caller
 * can fall through to its own routing.
 */
export function createPolicyHandler(document = POLICY_DOCUMENT, lock = readVersionLock()) {
  const verified = verifyPolicyDocument(document, lock);
  const servable = verified.ok ? document : null;

  return function handlePolicyRequest(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/api/policy") return false;
    if (!servable) {
      sendJson(res, 503, {
        error: "E_POLICY_LOCK_FAILED",
        message:
          "the shipped policy document's (version, digest, canonical_bytes) triple is not pinned in erp/contracts/policy-versions.json; refusing to serve any policy",
      });
      return true;
    }
    sendJson(res, 200, servable);
    return true;
  };
}

// Computed once, at server policy load (module import) — R-33 half two.
export const policyHandler = createPolicyHandler();
