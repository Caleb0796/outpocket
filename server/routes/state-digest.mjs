// server/routes/state-digest.mjs — GET /api/state-digest.
//
// Node S9. Digests the live in-memory day-book state through the one OCF-1
// canonicaliser (src/canonical.js), never a second definition. `getState()`
// is called fresh on every request, so this reflects live state rather than
// a cached boot snapshot; because server/seed.mjs reads no wall clock and no
// RNG, the digest at boot is byte-identical across restarts (S9's accept).
import { digest as ocfDigest } from "../../src/canonical.js";

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

/**
 * createStateDigestHandler(getState) -> handler(req, res, url) -> boolean
 * getState: () -> current mutable state object (OCF-1 canonicalisable: only
 * objects, arrays, strings, integers, booleans, null).
 */
export function createStateDigestHandler(getState) {
  return function handleStateDigest(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/api/state-digest") return false;
    sendJson(res, 200, { digest: ocfDigest("outpocket.state", getState()) });
    return true;
  };
}
