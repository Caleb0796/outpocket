import dns from "node:dns";
import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const denialMechanism =
  "prototype patch on net.Socket.prototype.connect and dns.lookup, in-process, via --import ./webmcp-eval-kit/test/no-net.mjs";
export const denialMechanisms = ["dns.lookup", "net.Socket.prototype.connect"];

function denyNetwork() {
  const error = new Error("E_NETWORK_DISABLED: eval kit network access is forbidden");
  error.code = "E_NETWORK_DISABLED";
  throw error;
}

Object.defineProperty(denyNetwork, "denialMechanism", { value: denialMechanism });

dns.lookup = denyNetwork;
net.Socket.prototype.connect = denyNetwork;

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const assert = (await import("node:assert/strict")).default;
  const { execFile } = await import("node:child_process");
  const { readFile } = await import("node:fs/promises");
  const { promisify } = await import("node:util");
  const { test } = await import("node:test");
  const { canon, digest } = await import("../src/canon.mjs");

  const execFileAsync = promisify(execFile);
  const vectorsUrl = new URL("../../erp/contracts/canonical-vectors.json", import.meta.url);
  const sourceUrl = new URL("../../src/canonical.js", import.meta.url);
  const portUrl = new URL("../src/canon.mjs", import.meta.url);
  const cliPath = new URL("../bin/eval.mjs", import.meta.url);

  test("canon.mjs is a source-identical port of src/canonical.js", async () => {
    const [source, port] = await Promise.all([
      readFile(sourceUrl),
      readFile(portUrl),
    ]);
    assert.deepEqual(port, source);
  });

  test("all seven OCF-1 vectors reproduce byte-for-byte", async (t) => {
    const fixture = JSON.parse(await readFile(vectorsUrl, "utf8"));
    assert.equal(fixture.vectors.length, 7);

    for (const vector of fixture.vectors) {
      await t.test(vector.id, () => {
        assert.equal(canon(vector.value), vector.canonical);
        assert.equal(digest(fixture.digest_prefix, vector.value), vector.digest);
      });
    }
  });

  test("network denial preload blocks DNS and sockets", () => {
    assert.throws(() => dns.lookup("localhost", () => {}), /E_NETWORK_DISABLED/);
    assert.throws(() => new net.Socket().connect(9, "127.0.0.1"), /E_NETWORK_DISABLED/);
  });

  test("CLI version is semver", async () => {
    const { stdout } = await execFileAsync(process.execPath, [fileURLToPath(cliPath), "--version"]);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
  });

  test("CLI self-test runs the pipeline twice on a non-empty fixture", async () => {
    const { stdout } = await execFileAsync(process.execPath, [fileURLToPath(cliPath), "--selftest"]);
    assert.match(stdout, /tool_count=[1-9]\d*/);
    assert.match(stdout, /byte_identical=true/);
  });
}
