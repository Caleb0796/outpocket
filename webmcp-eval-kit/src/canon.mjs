// OCF-1 — the one canonical form this system digests against (ruling R-11).
// Normative spec: erp/CONTRACTS.md §3. Frozen vectors: erp/contracts/canonical-vectors.json.
//
// A canonical value is one of: object, array, string, integer, boolean, null.
// Nothing else. Object keys sort ascending by Unicode code point, recursively,
// at every depth — never localeCompare, which is ICU-dependent and can sort
// differently in a stranger's clean clone.
const K = new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256Hex(bytes) {
  const l = bytes.length;
  const withPad = (((l + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(withPad);
  m.set(bytes); m[l] = 0x80;
  const bits = l * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(withPad - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(withPad - 4, bits >>> 0);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
      h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < withPad; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = w[t-15], b = w[t-2];
      const s0 = ((a>>>7)|(a<<25)) ^ ((a>>>18)|(a<<14)) ^ (a>>>3);
      const s1 = ((b>>>17)|(b<<15)) ^ ((b>>>19)|(b<<13)) ^ (b>>>10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
    h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
  }
  let out = "";
  for (const v of [h0,h1,h2,h3,h4,h5,h6,h7]) out += v.toString(16).padStart(8, "0");
  return out;
}


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
  const bytes = new TextEncoder().encode(`${kind}\n${canon(value)}`);
  return "sha256:" + sha256Hex(bytes);
}
