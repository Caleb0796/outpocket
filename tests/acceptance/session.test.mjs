import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHttpServer } from "../../server/index.mjs";

async function withServer(fn) {
  const server = createHttpServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function login(base, persona) {
  return fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });
}

test("POST /api/login sets a Set-Cookie with HttpOnly and SameSite=Lax", async () => {
  await withServer(async (base) => {
    const res = await login(base, "chen");
    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Set-Cookie header must be present");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /^sid=[0-9a-f]+/);
  });
});

test("GET /api/me with the login cookie returns the persona", async () => {
  await withServer(async (base) => {
    const loginRes = await login(base, "chen");
    const cookiePair = loginRes.headers.get("set-cookie").split(";")[0];

    const meRes = await fetch(`${base}/api/me`, { headers: { Cookie: cookiePair } });
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.deepEqual(me, { persona: "chen", role: "employee" });
  });
});

test("GET /api/me without a cookie returns 401", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  });
});

test("GET /api/me with a garbage cookie returns 401 — it never crashes or trusts an unknown sid", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/me`, { headers: { Cookie: "sid=not-a-real-session" } });
    assert.equal(res.status, 401);
  });
});

test("exactly two personas exist — chen (employee) and ruiz (auditor) — matching the frozen enum", async () => {
  await withServer(async (base) => {
    for (const [personaId, role] of [
      ["chen", "employee"],
      ["ruiz", "auditor"],
    ]) {
      const loginRes = await login(base, personaId);
      assert.equal(loginRes.status, 200);
      const body = await loginRes.json();
      assert.deepEqual(body, { persona: personaId, role });

      const cookiePair = loginRes.headers.get("set-cookie").split(";")[0];
      const meRes = await fetch(`${base}/api/me`, { headers: { Cookie: cookiePair } });
      assert.equal(meRes.status, 200);
      assert.deepEqual(await meRes.json(), { persona: personaId, role });
    }
  });
});

test("a third persona id is refused with 400 E_BAD_PERSONA and creates no session", async () => {
  await withServer(async (base) => {
    const res = await login(base, "nguyen");
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "E_BAD_PERSONA");
    assert.equal(res.headers.get("set-cookie"), null, "no cookie is set on a refused login");
  });
});

test("prototype-pollution-shaped persona values (constructor, __proto__) are refused, not accepted", async () => {
  await withServer(async (base) => {
    for (const personaId of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const res = await login(base, personaId);
      assert.equal(res.status, 400, `persona=${personaId} must be refused`);
    }
  });
});

test("the persona ids match the frozen enum in erp/contracts/eval-case.schema.json, not a retyped copy", () => {
  const schemaPath = new URL("../../erp/contracts/eval-case.schema.json", import.meta.url);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const personaEnum = findPersonaEnum(schema);
  assert.ok(personaEnum, "eval-case.schema.json must define a persona enum");
  assert.deepEqual([...personaEnum].sort(), ["chen", "none", "ruiz"]);
});

// The schema nests `persona` several levels deep under $defs; walk the whole
// document rather than hard-coding the path, so a future reshuffle of the
// schema doesn't silently stop this test from checking anything.
function findPersonaEnum(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node.enum) && node.enum.includes("none")) return node.enum;
  for (const key of Object.keys(node)) {
    const found = findPersonaEnum(node[key]);
    if (found) return found;
  }
  return null;
}
