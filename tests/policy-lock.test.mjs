import test from "node:test";
import assert from "node:assert/strict";
import { canon, digest } from "../src/canonical.js";
import { POLICY_DOCUMENT, POLICY_VERSION } from "../src/policy.js";
import { readVersionLock, verifyPolicyDocument, createPolicyHandler } from "../server/routes/policy.mjs";

function fakeRes() {
  const res = { statusCode: null, headers: {}, body: "" };
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    Object.assign(res.headers, headers);
  };
  res.end = (text) => {
    res.body = text;
  };
  return res;
}

test("the shipped policy document reproduces its pinned (version, digest, canonical_bytes) triple", () => {
  const lock = readVersionLock();
  const canonicalBytes = Buffer.byteLength(canon(POLICY_DOCUMENT), "utf8");
  const computedDigest = digest(lock.digest_prefix, POLICY_DOCUMENT);
  const entry = lock.versions.find((v) => v.version === POLICY_VERSION);
  assert.ok(entry, `policy-versions.json must carry an entry for ${POLICY_VERSION}`);
  assert.equal(computedDigest, entry.digest);
  assert.equal(canonicalBytes, entry.canonical_bytes);

  const verified = verifyPolicyDocument(POLICY_DOCUMENT, lock);
  assert.equal(verified.ok, true);
  assert.equal(verified.digest, entry.digest);
  assert.equal(verified.canonical_bytes, entry.canonical_bytes);
});

test("R-33 half two: the same lock refuses a doctored document at server policy LOAD, not only in the test suite", () => {
  const lock = readVersionLock();

  // Same version string, one limit silently changed underneath it — the
  // same-version content swap R-33 exists to close.
  const doctored = {
    ...POLICY_DOCUMENT,
    limits_cents: { ...POLICY_DOCUMENT.limits_cents, transport_per_line: 5000 },
  };

  const verified = verifyPolicyDocument(doctored, lock);
  assert.equal(verified.ok, false, "a doctored document under an unchanged version must not verify");

  // Exercise the real production code path — createPolicyHandler is exactly
  // what server/index.mjs wires in, just with the doctored document injected
  // — and prove the server declines to serve ANY policy, not the doctored one.
  const handler = createPolicyHandler(doctored, lock);
  const res = fakeRes();
  const handled = handler({ method: "GET" }, res, new URL("http://localhost/api/policy"));
  assert.equal(handled, true);
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.error, "E_POLICY_LOCK_FAILED");
  assert.equal(JSON.stringify(body).includes(String(doctored.limits_cents.transport_per_line)), false, "the refused response body never carries the doctored content");
});

test("the real (undoctored) handler serves the shipped document at 200", () => {
  const lock = readVersionLock();
  const handler = createPolicyHandler(POLICY_DOCUMENT, lock);
  const res = fakeRes();
  const handled = handler({ method: "GET" }, res, new URL("http://localhost/api/policy"));
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.version, POLICY_VERSION);
  assert.equal(body.rules.length, 19);
});

test("a non-matching route or method is not claimed by the policy handler", () => {
  const lock = readVersionLock();
  const handler = createPolicyHandler(POLICY_DOCUMENT, lock);
  const res = fakeRes();
  assert.equal(handler({ method: "POST" }, res, new URL("http://localhost/api/policy")), false);
  assert.equal(handler({ method: "GET" }, res, new URL("http://localhost/api/other")), false);
});
