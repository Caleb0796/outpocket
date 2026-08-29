// tests/signature.test.mjs — node S5.
//
// Reproduces every published digest in erp/contracts/signature.schema.json
// (FROZEN, x-knownDigests and x-knownChain) from its own fixtures, using
// src/canonical.js — the one canonicaliser (S11), never a second
// definition. Digests are read out of the schema itself, not pasted as
// string literals, so this test stays correct if the schema is ever
// re-published under a new ruling; it fails loudly if it drifts silently.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { digest } from "../src/canonical.js";

const schemaPath = fileURLToPath(new URL("../erp/contracts/signature.schema.json", import.meta.url));
const SCHEMA = JSON.parse(readFileSync(schemaPath, "utf8"));

const SNAPSHOT_PREFIX = "outpocket/snapshot/1";
const CHAIN_PREFIX = "outpocket/chain/1";

const signedSnapshot = SCHEMA.examples[0].snapshot;
const KNOWN = SCHEMA["x-knownDigests"];
const KNOWN_CHAIN = SCHEMA["x-knownChain"];

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

test("the signed fixture (examples[0]) digests to x-knownDigests.snapshot and to its own snapshot_digest", () => {
  assert.equal(digest(SNAPSHOT_PREFIX, signedSnapshot), KNOWN.snapshot);
  assert.equal(digest(SNAPSHOT_PREFIX, signedSnapshot), SCHEMA.examples[0].snapshot_digest);
});

test("tampered_amount_consistent_retotal: a consistent re-total across three fields digests to a different, published value", () => {
  const tampered = clone(signedSnapshot);
  tampered.report.lines[0].amount_cents = 8640;
  tampered.report.lines[0].usd_cents = 8640;
  tampered.report.total_usd_cents = tampered.report.lines[0].usd_cents + tampered.report.lines[1].usd_cents;
  assert.equal(tampered.report.total_usd_cents, 12850);

  assert.equal(digest(SNAPSHOT_PREFIX, tampered), KNOWN.tampered_amount_consistent_retotal_18640_to_8640);
  assert.notEqual(digest(SNAPSHOT_PREFIX, tampered), digest(SNAPSHOT_PREFIX, signedSnapshot));

  // x-knownDigests.tampered_amount_note: the tampered snapshot is left
  // DELIBERATELY internally inconsistent — its itemization still sums to
  // 18640 against an amount of 8640 — and that inconsistency is NOT what
  // the digest catches. The digest only proves "this snapshot is not the
  // one that was signed"; it says nothing about whether a snapshot's own
  // numbers reconcile with each other.
  const itemizationSum = tampered.report.lines[0].itemization.reduce((s, it) => s + it.amount_cents, 0);
  assert.equal(itemizationSum, 18640);
  assert.notEqual(itemizationSum, tampered.report.lines[0].amount_cents, "itemization (18640) vs amount_cents (8640) is left inconsistent on purpose");
});

test("tampered_provenance_amount_agent_to_human: v6/v7-shaped flip digests differently (the standing regression case)", () => {
  const tampered = clone(signedSnapshot);
  assert.equal(tampered.report.lines[0].provenance.amount, "agent");
  tampered.report.lines[0].provenance.amount = "human";
  assert.equal(digest(SNAPSHOT_PREFIX, tampered), KNOWN.tampered_provenance_amount_agent_to_human);
});

test("tampered_line_order_reversed: line order is IN the digest — reversing lines changes it", () => {
  const tampered = clone(signedSnapshot);
  tampered.report.lines.reverse();
  assert.equal(digest(SNAPSHOT_PREFIX, tampered), KNOWN.tampered_line_order_reversed);
});

test("replayed_under_a_different_sign_request: request_id is inside the digest — a replayed digest cannot cross sign requests", () => {
  const tampered = clone(signedSnapshot);
  tampered.request_id = "sg_ffffffffffffffff";
  assert.equal(digest(SNAPSHOT_PREFIX, tampered), KNOWN.replayed_under_a_different_sign_request);
});

test("swapped_policy_content_same_version: policy_digest is inside the digest — a same-version content swap moves it (R-33)", () => {
  const tampered = clone(signedSnapshot);
  tampered.policy_digest = "sha256:17bc4b2d1031b63e07a3983b067c8485316e8c16b53454e481680f65b7962e92";
  assert.equal(tampered.policy_version, signedSnapshot.policy_version, "version string is unchanged — that is the whole point of the attack");
  assert.equal(digest(SNAPSHOT_PREFIX, tampered), KNOWN.swapped_policy_content_same_version);
});

test("five tampers, five different digests, all different from the signed one (x-knownDigests.readsAs)", () => {
  const digests = new Set([
    KNOWN.snapshot,
    KNOWN.tampered_amount_consistent_retotal_18640_to_8640,
    KNOWN.tampered_provenance_amount_agent_to_human,
    KNOWN.tampered_line_order_reversed,
    KNOWN.replayed_under_a_different_sign_request,
    KNOWN.swapped_policy_content_same_version,
  ]);
  assert.equal(digests.size, 6, "all six digests (signed + five tampers) must be distinct");
});

test("x-knownChain: both published chain entries recompute from their own inputs", () => {
  for (const entry of KNOWN_CHAIN.entries) {
    const { entry_digest, ...withoutDigest } = entry;
    assert.equal(digest(CHAIN_PREFIX, withoutDigest), entry_digest, `seq ${entry.seq} entry_digest must recompute`);
  }
  assert.equal(KNOWN_CHAIN.entries[1].prev, KNOWN_CHAIN.entries[0].entry_digest, "seq 1's prev is seq 0's entry_digest");
  assert.equal(KNOWN_CHAIN.entries[1].payload_digest, SCHEMA.examples[0].snapshot_digest, "seq 1's payload_digest is the signed snapshot digest");
});
