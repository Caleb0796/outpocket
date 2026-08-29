// V5 — throwaway HTTPS probe origin.
//
// Purpose: answer unknowns V0-V4 on a REAL https origin, without waiting for the
// product deploy (D1). Deliberately separate from the product and deliberately
// disposable.
//
// Two rules this file exists to respect:
//   * It must NOT send `Origin-Agent-Cluster: ?0`. That header silently kills
//     WebMCP (FACTS.md IR-13). We send nothing of the sort and the accept
//     predicate dumps the real headers to prove it.
//   * The page is served at the TOP LEVEL. No iframes anywhere — the ChatGPT
//     built-in browser discovers no tools registered inside one (IR-11).
//
// Render: free Web Service. Bind 0.0.0.0 and read process.env.PORT.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8791;
const PAGE = readFileSync(join(HERE, "index.html"), "utf8");

// A fixed, meaningless value. It exists only so /whoami has something to echo,
// which is how V3 ("does an agent-initiated execute carry the page's session
// cookie?") gets answered. It is not authentication and guards nothing.
const COOKIE_NAME = "probe_session";
const COOKIE_VALUE = "v5-probe-fixed-value";

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/whoami") {
    const got = readCookie(req.headers.cookie, COOKIE_NAME);
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(
      JSON.stringify({
        cookiePresent: got !== null,
        cookieMatches: got === COOKIE_VALUE,
        // Echoed so a human reading the transcript can tell a stale cookie from
        // a missing one. Harmless: the value is a constant, not a secret.
        cookieValue: got,
        sawCookieHeader: Boolean(req.headers.cookie),
        userAgent: req.headers["user-agent"] || null,
        secFetchSite: req.headers["sec-fetch-site"] || null,
        secFetchMode: req.headers["sec-fetch-mode"] || null,
        at: new Date().toISOString(),
      })
    );
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": `${COOKIE_NAME}=${COOKIE_VALUE}; Path=/; SameSite=Lax; Secure`,
    });
    res.end(PAGE);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found\n");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`v5 probe listening on ${PORT}`);
});
