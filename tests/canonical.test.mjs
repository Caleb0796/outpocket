import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canon, digest, CanonError } from "../src/canonical.js";

const vectorsPath = fileURLToPath(new URL("../erp/contracts/canonical-vectors.json", import.meta.url));
const fixture = JSON.parse(readFileSync(vectorsPath, "utf8"));

test("all seven OCF-1 vectors reproduce byte-for-byte", () => {
  assert.equal(fixture.vectors.length, 7, "the suite is seven vectors, not more or fewer");
  for (const v of fixture.vectors) {
    assert.equal(canon(v.value), v.canonical, `${v.id}: canonical string mismatch`);
    assert.equal(digest(fixture.digest_prefix, v.value), v.digest, `${v.id}: digest mismatch`);
  }
});

test("v6/v7: identical lines differing only in provenance.amount source digest differently", () => {
  const v6 = fixture.vectors.find((v) => v.id === "v6_line_source_agent");
  const v7 = fixture.vectors.find((v) => v.id === "v7_line_source_human");
  assert.notEqual(v6.digest, v7.digest, "the standing provenance-flip regression case");
  assert.notEqual(canon(v6.value), canon(v7.value));
});

test("object keys sort ascending by code point, recursively, at every depth", () => {
  assert.equal(canon({ b: 1, a: 2, a_b: 3, ab: 4 }), '{"a":2,"a_b":3,"ab":4,"b":1}');
  assert.equal(
    canon({ z: { b: 1, a: 2 }, a: { y: 1, x: 2 } }),
    '{"a":{"x":2,"y":1},"z":{"a":2,"b":1}}',
  );
});

test("arrays preserve order and are never sorted", () => {
  assert.equal(canon([3, 1, 2]), "[3,1,2]");
  assert.equal(canon({ lines: ["b", "a"] }), '{"lines":["b","a"]}');
});

test("integers only: non-integer numbers are E_CANON_NUMBER outside the inputSchema carve-out", () => {
  assert.throws(() => canon({ amount: 1.5 }), (e) => e instanceof CanonError && e.code === "E_CANON_NUMBER");
  assert.throws(() => canon(0.1 + 0.2), (e) => e.code === "E_CANON_NUMBER");
  assert.throws(() => canon(2 ** 53), (e) => e.code === "E_CANON_NUMBER", "2^53 is outside the safe range");
});

test("-0 normalises to 0", () => {
  assert.equal(canon(-0), "0");
  assert.equal(canon({ delta_cents: -0 }), '{"delta_cents":0}');
});

test("bare keys must match ^[A-Za-z0-9_]{1,64}$ or raise E_CANON_KEY", () => {
  assert.throws(() => canon({ "bad key": 1 }), (e) => e instanceof CanonError && e.code === "E_CANON_KEY");
  assert.throws(() => canon({ $schema: "x" }), (e) => e.code === "E_CANON_KEY", "dollar-keys are rejected outside inputSchema");
});

test("OCF-1 carve-out: dollar-prefixed keys and non-integer numbers are legal inside an inputSchema subtree", () => {
  const tool = {
    name: "submit_line",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { amount_cents: { type: "integer" } },
      multipleOf: 0.01,
      $defs: { money: { $ref: "#/$defs/money" } },
    },
  };
  const out = canon(tool);
  assert.match(out, /"\$schema":/);
  assert.match(out, /"multipleOf":0\.01/);
  assert.match(out, /"\$defs":\{"money":\{"\$ref":/);
});

test("the inputSchema carve-out is scoped to that subtree and nowhere else", () => {
  // A dollar-key next to inputSchema, not inside it, still raises E_CANON_KEY.
  assert.throws(
    () => canon({ $schema: "x", inputSchema: { type: "object" } }),
    (e) => e instanceof CanonError && e.code === "E_CANON_KEY",
  );
  // A float sibling to inputSchema, not inside it, still raises E_CANON_NUMBER.
  assert.throws(
    () => canon({ weight: 0.5, inputSchema: { type: "object" } }),
    (e) => e instanceof CanonError && e.code === "E_CANON_NUMBER",
  );
});

test("strings: NFC normalisation before serialising, non-ASCII and DEL stay literal", () => {
  const eAcute = String.fromCharCode(0x00e9); // precomposed e-acute
  const decomposed = "caf" + "e" + String.fromCharCode(0x0301); // 'e' + combining acute
  assert.equal(canon(decomposed), '"caf' + eAcute + '"', "NFC-normalises e + U+0301 to U+00E9");
  assert.equal(canon(String.fromCharCode(0x007f)), '"' + String.fromCharCode(0x007f) + '"', "U+007F (DEL) stays literal, it is not a C0 control");
});

test("strings: only quote, backslash and C0 controls are escaped", () => {
  const eAcute = String.fromCharCode(0x00e9);
  const value = "a" + String.fromCharCode(0x00) + "b\tc" + String.fromCharCode(0x1f) + "d\ne\"f\\gh" + eAcute;
  const expected = '"a\\u0000b\\tc\\u001fd\\ne\\"f\\\\gh' + eAcute + '"';
  assert.equal(canon(value), expected);
});

test("lone surrogates are E_CANON_STRING", () => {
  assert.throws(() => canon("\ud800"), (e) => e instanceof CanonError && e.code === "E_CANON_STRING");
  assert.throws(() => canon("\udc00"), (e) => e.code === "E_CANON_STRING");
});

test("null is legal and never omitted by the serialiser", () => {
  assert.equal(canon({ a: null }), '{"a":null}');
});

test("no whitespace: separators are exactly , and :", () => {
  assert.equal(canon({ a: 1, b: [1, 2] }), '{"a":1,"b":[1,2]}');
});

test("digest() is domain-separated by kind: same value, different kind, different digest", () => {
  const a = digest("outpocket/snapshot/1", { x: 1 });
  const b = digest("outpocket/policy/1", { x: 1 });
  assert.notEqual(a, b);
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

test("disallowed shapes (Date, undefined, functions) raise a canon error", () => {
  assert.throws(() => canon(new Date()), (e) => e instanceof CanonError);
  assert.throws(() => canon(undefined), (e) => e instanceof CanonError);
  assert.throws(() => canon({ a: () => {} }), (e) => e instanceof CanonError);
});
