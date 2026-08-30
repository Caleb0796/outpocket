// server/provenance.mjs — the append-only per-field provenance ledger.
//
// Node S8. Contract: erp/contracts/provenance.schema.json (FROZEN —
// sha256sum -c erp/contracts/FREEZE.md). ONE RECORD PER ACCEPTED WRITE,
// never updated, never deleted; a correction is a new record with a higher
// `seq` whose `supersedes` names the one it replaces. This is the claim the
// whole product rests on, written down per field: that afterwards, from the
// record alone, you can tell which values a human chose and which an agent
// chose.
//
// WHAT THIS MODULE REFUSES, ON PURPOSE (D-100 — a writer that only proves
// the flip happens cannot tell a working recorder from one stuck at
// 'human'): `source:'agent'` requires a non-null `tool` name and
// `actor==='agent'` (an agent write always arrives through a named WebMCP
// tool, and R-21 means the tool surface exposes no agent identity beyond
// that literal string); every other source (`human`, `seed`, `unset`)
// requires `tool===null`, and `human` may not use the literal actor string
// `'agent'`. A caller cannot record an agent write as human by simply
// saying so — the source and the shape of what accompanies it must agree,
// or record() throws instead of writing anything.
//
// THE `ts` WARNING (`at` below), read before wiring this into anything that
// gets digested: `at` is a wall-clock value, stored once at write time and
// never recomputed on read — so re-fetching the same record twice returns
// the same `at` and does not, by itself, break a byte-stable comparison
// the way a value recomputed fresh on every read would (H6 nearly shipped
// exactly that: per-step ms inside a dump graded for byte-stability). But
// per erp/contracts/provenance.schema.json's own x-derivation, the SIGNED
// snapshot's per-line provenance is a compact `field -> source` map only —
// never `at`, never `actor`, never the value itself. Anything that projects
// this ledger into a digested structure must reproduce that map, not this
// module's richer per-record shape, or two runs that differ only in wall-
// clock time will falsely digest as different reports.
import { digest } from "../src/canonical.js";

export const VALUE_DIGEST_PREFIX = "outpocket/value/1";
// digest(VALUE_DIGEST_PREFIX, null) — the frozen schema's own worked value,
// for source:'unset', which always writes JSON null.
export const UNSET_VALUE_DIGEST = "sha256:d3e05b98e8982e5a89ab448f95b938e5d12f52030e938247f4b81cad46aa9a42";

export const SOURCES = Object.freeze(["human", "agent", "seed", "unset"]);

export class ProvenanceError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProvenanceError";
    this.code = "E_PROVENANCE_MISLABEL";
  }
}

/** valueDigest(value) -> "sha256:...", per the frozen schema's value_digest formula. */
export function valueDigest(value) {
  return digest(VALUE_DIGEST_PREFIX, value === undefined ? null : value);
}

function assertConsistent(source, actor, tool) {
  if (!SOURCES.includes(source)) {
    throw new ProvenanceError(`source must be one of ${SOURCES.join(", ")}, got '${source}'`);
  }
  const hasTool = tool !== null && tool !== undefined;
  if (source === "agent") {
    if (!hasTool) throw new ProvenanceError("source 'agent' requires a tool name — an agent write always arrives through a named WebMCP tool");
    if (actor !== "agent") throw new ProvenanceError(`source 'agent' requires actor==='agent' (R-21: no agent identity beyond that), got '${actor}'`);
  } else {
    if (hasTool) throw new ProvenanceError(`source '${source}' must not carry a tool name ('${tool}') — only 'agent' writes come through a tool`);
    if (source === "human" && actor === "agent") {
      throw new ProvenanceError("source 'human' must not use the literal actor string 'agent' — that is what an agent write claims");
    }
  }
}

/**
 * createProvenanceLedger({now}) -> { record, currentRecord, ledger }
 *
 * opts.now: () -> Date, injectable clock (default real time).
 */
export function createProvenanceLedger({ now = () => new Date() } = {}) {
  const records = []; // append-only, in seq order — this IS the day book
  const current = new Map(); // "entity:entity_id:field" -> latest record
  let seq = 0;
  let idCounter = 0;

  function key(entity, entityId, field) {
    return `${entity}:${entityId}:${field}`;
  }

  /**
   * record({entity, entityId, field, source, actor, tool, value, revision})
   *   -> the new ledger record (frozen schema shape).
   *
   * Throws ProvenanceError (see assertConsistent above) rather than writing
   * anything if source/actor/tool disagree — refusing to mislabel is not
   * best-effort, it is the whole point of this function existing.
   */
  function record({ entity, entityId, field, source, actor, tool = null, value, revision }) {
    assertConsistent(source, actor, tool ?? null);

    const k = key(entity, entityId, field);
    const prev = current.get(k) ?? null;
    idCounter += 1;
    const rec = {
      schema: "outpocket.provenance/1",
      seq: seq++,
      id: `pv_${idCounter}`,
      at: now().toISOString(),
      entity,
      entity_id: entityId,
      field,
      source,
      actor,
      tool: tool ?? null,
      value_digest: valueDigest(value),
      supersedes: prev ? prev.id : null,
    };
    if (revision !== undefined) rec.revision = revision;

    records.push(rec);
    current.set(k, rec);
    return rec;
  }

  /** currentRecord(entity, entityId, field) -> the latest record, or null. */
  function currentRecord(entity, entityId, field) {
    return current.get(key(entity, entityId, field)) ?? null;
  }

  /** ledger() -> the full append-only record list, in seq order. A copy — callers cannot mutate history. */
  function ledger() {
    return records.slice();
  }

  return { record, currentRecord, ledger };
}
