// server/routes/version.mjs — GET /version.
//
// Node D1. Returns the deployed commit so `curl $URL/version` can be diffed
// against `git rev-parse HEAD` without trusting the deploy dashboard. Render
// bakes the built commit into RENDER_GIT_COMMIT; that beats shelling out to
// git at request time, since a deploy artifact may ship without a .git dir.
import { execFileSync } from "node:child_process";

function resolveCommit() {
  const fromEnv = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT;
  if (fromEnv) return fromEnv.trim();
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

/**
 * createVersionHandler() -> handler(req, res, url) -> boolean
 * Commit is resolved once at server boot, not per request.
 */
export function createVersionHandler() {
  const commit = resolveCommit();
  return function handleVersion(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/version") return false;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(commit ? `${commit}\n` : "");
    return true;
  };
}
