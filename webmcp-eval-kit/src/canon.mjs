// OCF-1 — the one canonical form this system digests against (ruling R-11).
// Normative spec: erp/CONTRACTS.md §3. Frozen vectors: erp/contracts/canonical-vectors.json.
//
// A canonical value is one of: object, array, string, integer, boolean, null.
// Nothing else. Object keys sort ascending by Unicode code point, recursively,
// at every depth — never localeCompare, which is ICU-dependent and can sort
// differently in a stranger's clean clone.
import { createHash } from "node:crypto";

const PLAIN_KEY = /^[A-Za-z0-9_]{1,64}$/;
// Carve-out, inputSchema subtrees only (erp/contracts/tool-export.schema.json
// $defs.inputSchema): $schema, $ref, $defs and friends. Without it no real
// tool definition is canonicalisable at all.
const SCHEMA_KEY = /^\$[A-Za-z0-9_]{1,63}$/;

const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 2^53 - 1

export class CanonError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "CanonError";
    this.code = code;
  }
}

function isPlainObject(v) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// JS strings are UTF-16 code units; the default iterator silently tolerates
// unpaired surrogates instead of rejecting them, so this walks code units by
// hand rather than trusting for-of / spread.
function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) return true;
      i++; // consume the low half of a valid pair
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true; // unpaired low surrogate
    }
  }
  return false;
}

// Escape only '"', '\', and the C0 controls. Everything from U+0020 up,
// including U+007F and every non-ASCII codepoint, stays literal — this is
// serialisation, not field normalisation (no trim, no case-fold).
function escapeString(raw) {
  if (typeof raw !== "string") throw new CanonError("E_CANON_STRING", "not a string");
  const s = raw.normalize("NFC");
  if (hasLoneSurrogate(s)) throw new CanonError("E_CANON_STRING", "lone surrogate");
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (code === 0x08) out += "\\b";
    else if (code === 0x09) out += "\\t";
    else if (code === 0x0a) out += "\\n";
    else if (code === 0x0c) out += "\\f";
    else if (code === 0x0d) out += "\\r";
    else if (code <= 0x1f) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}

function serializeNumber(n, inSchema) {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new CanonError("E_CANON_NUMBER", "not a finite number");
  }
  if (Number.isInteger(n)) {
    if (Math.abs(n) > MAX_SAFE) throw new CanonError("E_CANON_NUMBER", "outside [-(2^53-1), 2^53-1]");
    return n === 0 ? "0" : String(n); // String(-0) === "0"
  }
  // Numeric carve-out: inside an inputSchema subtree only (e.g. "multipleOf": 0.01).
  if (inSchema) return String(n);
  throw new CanonError("E_CANON_NUMBER", "non-integer outside inputSchema carve-out");
}

function serializeKey(key, inSchema) {
  if (PLAIN_KEY.test(key)) return escapeString(key);
  if (inSchema && SCHEMA_KEY.test(key)) return escapeString(key);
  throw new CanonError("E_CANON_KEY", key);
}

function serialize(value, inSchema) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return escapeString(value);
  if (typeof value === "number") return serializeNumber(value, inSchema);
  if (Array.isArray(value)) {
    // Order is preserved and never sorted: line order is what the human read
    // down the page, so reordering must change the digest.
    return "[" + value.map((v) => serialize(v, inSchema)).join(",") + "]";
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts = keys.map((k) => {
      // The carve-out is scoped to the inputSchema subtree and everything
      // beneath it — once entered it never turns back off on the way down.
      const nextInSchema = inSchema || k === "inputSchema";
      return serializeKey(k, inSchema) + ":" + serialize(value[k], nextInSchema);
    });
    return "{" + parts.join(",") + "}";
  }
  throw new CanonError("E_CANON_TYPE", typeof value);
}

/** canon(value) -> the OCF-1 canonical JSON string for `value`. */
export function canon(value) {
  return serialize(value, false);
}

/** digest(kind, value) = "sha256:" + hex(SHA-256(utf8(kind + "\n" + canon(value)))) */
export function digest(kind, value) {
  const bytes = Buffer.from(`${kind}\n${canon(value)}`, "utf8");
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}
