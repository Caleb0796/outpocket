// tools/survive.mjs — node D3, owner I4.
//
//   URL=<deployed origin> node tools/survive.mjs --idle <seconds> --expect-digest <sha256:...>
//
// D3's accept: after N idle seconds (no request to $URL from this process,
// or anything else, in between), ONE cold request returns 200 in under 10
// seconds, and GET /api/state-digest equals the boot digest S9 recorded.
//
// Deliberately makes NO request to $URL until the idle period has fully
// elapsed — a reachability ping during the wait would end the idle window
// it exists to measure (setup that touches the input under test is an
// assertion about that input, not an observation of it). The comparison
// digest is passed in explicitly rather than fetched by this tool before or
// after sleeping, for the same reason: the only two requests this tool ever
// makes are the two it reports on.

const argv = process.argv.slice(2);

function argVal(flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

const idleSeconds = Number(argVal("--idle"));
const expectDigest = argVal("--expect-digest");
const url = process.env.URL;

if (!Number.isFinite(idleSeconds) || idleSeconds <= 0) {
  console.error("usage: URL=<origin> node tools/survive.mjs --idle <seconds> --expect-digest <sha256:...>");
  console.error("  --idle must be a positive number of seconds");
  process.exit(2);
}
if (!expectDigest) {
  console.error("--expect-digest is required: the boot digest S9 recorded, read BEFORE this process starts sleeping");
  process.exit(2);
}
if (!url) {
  console.error("URL env var is required (the deployed origin)");
  process.exit(2);
}

function nowIso() {
  return new Date().toISOString();
}

async function timedGet(path) {
  const started = performance.now();
  const res = await fetch(new URL(path, url), { method: "GET" });
  const elapsedMs = performance.now() - started;
  const body = await res.json().catch(() => null);
  return { status: res.status, elapsedMs, body };
}

async function main() {
  console.log(`idle wait start (UTC): ${nowIso()}`);
  console.log(`waiting ${idleSeconds}s with zero requests to ${url}`);
  await new Promise((resolve) => setTimeout(resolve, idleSeconds * 1000));
  console.log(`idle wait end (UTC):   ${nowIso()}`);

  // Request 1: the cold request, root path — must be 200 in under 10s.
  const cold = await timedGet("/");
  const coldOk = cold.status === 200 && cold.elapsedMs < 10000;
  console.log(
    `cold request: status=${cold.status} elapsed_ms=${cold.elapsedMs.toFixed(1)} ` +
      `(need 200 in <10000ms) -> ${coldOk ? "PASS" : "FAIL"}`
  );

  // Request 2: the digest check, immediately after — must equal S9's boot digest.
  const digestRes = await timedGet("/api/state-digest");
  const gotDigest = digestRes.body?.digest;
  const digestOk = gotDigest === expectDigest;
  console.log(`state-digest: got=${gotDigest} expect=${expectDigest} -> ${digestOk ? "PASS" : "FAIL"}`);

  const ok = coldOk && digestOk;
  console.log(ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`survive.mjs: unhandled error: ${err.stack || err}`);
  process.exit(1);
});
