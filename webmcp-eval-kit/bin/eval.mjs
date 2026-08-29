#!/usr/bin/env node
import assert from "node:assert/strict";
import dns from "node:dns";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { canon, digest } from "../src/canon.mjs";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const repositoryUrl = new URL("../../", import.meta.url);
const SUITES = new Set(["accounting", "capability", "negative"]);

const SELFTEST_TOOLS = [
  {
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    description: "Return a fixed self-test value.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      additionalProperties: false,
      properties: {
        amount: {
          multipleOf: 0.01,
          type: "number",
        },
      },
      type: "object",
    },
    name: "selftest_read",
  },
];

export async function runPipeline(tools, resultPath) {
  assert.ok(Array.isArray(tools), "tool surface must be an array");

  const result = {
    schema: "webmcp.eval_result/1",
    surface_digest: digest("outpocket/surface/1", tools),
    tool_count: tools.length,
    tools,
  };
  const bytes = Buffer.from(`${canon(result)}\n`, "utf8");
  await writeFile(resultPath, bytes);
  return result;
}

async function selftest() {
  const directory = await mkdtemp(join(tmpdir(), "webmcp-eval-kit-"));
  const firstPath = join(directory, "first.json");
  const secondPath = join(directory, "second.json");

  try {
    const firstResult = await runPipeline(SELFTEST_TOOLS, firstPath);
    const secondResult = await runPipeline(SELFTEST_TOOLS, secondPath);
    const [firstBytes, secondBytes] = await Promise.all([
      readFile(firstPath),
      readFile(secondPath),
    ]);

    assert.ok(firstResult.tool_count > 0, "self-test fixture must expose at least one tool");
    assert.ok(secondResult.tool_count > 0, "second pipeline run must expose at least one tool");
    assert.deepEqual(firstBytes, secondBytes, "pipeline result files must be byte-identical");
    assert.deepEqual(
      parseArgs(["--suite", "capability", "--suite", "negative", "--url", "https://example.test"]),
      {
        suites: ["capability", "negative"],
        url: "https://example.test",
      },
    );
    assert.throws(() => parseArgs(["--suite"]), /--suite requires a name/);
    const accounting = accountStates({
      states: [
        {
          state_id: "selftest",
          surface_digest: digest("outpocket/surface/1", SELFTEST_TOOLS),
          tools: SELFTEST_TOOLS,
        },
      ],
    });
    assert.equal(accounting.length, 1);
    assert.equal(accounting[0].tools, 1);
    assert.throws(() => accountStates({ states: [] }), /empty states array/);

    process.stdout.write(
      `selftest ok: tool_count=${firstResult.tool_count} byte_identical=true empty_suite_refused=true\n`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { suites: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--suite") {
      const suite = argv[index + 1];
      if (!suite || suite.startsWith("--")) {
        throw new TypeError("--suite requires a name");
      }
      if (!SUITES.has(suite)) {
        throw new TypeError(`unknown suite: ${suite}`);
      }
      if (options.suites.includes(suite)) {
        throw new TypeError(`duplicate suite: ${suite}`);
      }
      options.suites.push(suite);
      index += 1;
      continue;
    }
    if (argument === "--url") {
      const url = argv[index + 1];
      if (!url || url.startsWith("--")) {
        throw new TypeError("--url requires an origin");
      }
      options.url = url;
      index += 1;
      continue;
    }
    throw new TypeError(`unknown argument: ${argument}`);
  }

  if (options.suites.length === 0) {
    throw new TypeError("at least one --suite is required");
  }
  if (options.suites.includes("accounting") && options.suites.length !== 1) {
    throw new TypeError("accounting must run alone under the network-denial preload");
  }
  if (options.suites.some((suite) => suite !== "accounting")) {
    if (!options.url) {
      throw new TypeError("capability and negative suites require --url");
    }
    const url = new URL(options.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError("--url must use http or https");
    }
  }

  return options;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function denialMechanisms() {
  const mechanisms = [];
  if (dns.lookup.name === "denyNetwork") mechanisms.push("dns.lookup");
  if (net.Socket.prototype.connect.name === "denyNetwork") {
    mechanisms.push("net.Socket.prototype.connect");
  }
  assert.deepEqual(
    mechanisms,
    ["dns.lookup", "net.Socket.prototype.connect"],
    "accounting requires node --import ./webmcp-eval-kit/test/no-net.mjs",
  );
  return mechanisms;
}

function accountStates(exported) {
  assert.ok(Array.isArray(exported.states), "tools export must contain a states array");
  assert.ok(exported.states.length > 0, "accounting refuses an empty states array");

  return exported.states.map((state) => {
    assert.ok(Array.isArray(state.tools), `${state.state_id}: tools must be an array`);
    assert.ok(state.tools.length > 0, `${state.state_id}: accounting refuses an empty tool surface`);

    const descriptionLengths = state.tools.map((tool) =>
      Buffer.byteLength(tool.description, "utf8")
    );
    const bytes = Buffer.byteLength(canon(state.tools), "utf8");
    const computedDigest = digest("outpocket/surface/1", state.tools);
    assert.equal(computedDigest, state.surface_digest, `${state.state_id}: surface digest mismatch`);

    return {
      bytes,
      descBytes: descriptionLengths.reduce((total, length) => total + length, 0),
      descMax: Math.max(...descriptionLengths),
      descMedian: median(descriptionLengths),
      digest: computedDigest,
      readOnlyCount: state.tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
      state: state.state_id,
      tokensApprox: Math.ceil(bytes / 4),
      tools: state.tools.length,
    };
  });
}

async function runAccountingSuite() {
  const sourceUrl = new URL("artifacts/tools.export.json", repositoryUrl);
  const outputUrl = new URL("evals/accounting.json", repositoryUrl);
  const netDenial = denialMechanisms();
  const exported = JSON.parse(await readFile(sourceUrl, "utf8"));
  const states = accountStates(exported);

  const result = {
    header: {
      netDenial: `node --import ./webmcp-eval-kit/test/no-net.mjs (${netDenial.join(", ")})`,
    },
    schema: "outpocket.surface_accounting/1",
    states,
  };
  await writeFile(outputUrl, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`accounting: ${states.length} state(s) written to evals/accounting.json\n`);
}

async function runDeferredSuite(name) {
  const suiteUrl = new URL(`evals/suites/${name}.suite.json`, repositoryUrl);
  const suite = JSON.parse(await readFile(suiteUrl, "utf8"));
  const cases = Array.isArray(suite) ? suite : suite.cases;
  assert.ok(Array.isArray(cases), `${name}: suite must be an array or carry a cases array`);
  assert.ok(cases.length > 0, `${name}: suite refuses to pass with zero cases`);
  throw new Error(`${name}: executable case driver has not been produced by its consumer node`);
}

async function runSuites(options) {
  for (const suite of options.suites) {
    if (suite === "accounting") {
      await runAccountingSuite();
    } else {
      await runDeferredSuite(suite);
    }
  }
}

function usage() {
  process.stderr.write(
    "usage: webmcp-eval (--version | --selftest | --suite <capability|negative> [--suite <capability|negative>] --url <origin> | --suite accounting)\n",
  );
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }
  if (argv.length === 1 && argv[0] === "--selftest") {
    await selftest();
    return;
  }

  try {
    await runSuites(parseArgs(argv));
  } catch (error) {
    process.stderr.write(`webmcp-eval: ${error.message}\n`);
    if (error instanceof TypeError) {
      usage();
      process.exitCode = 2;
    } else {
      process.exitCode = 1;
    }
  }
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);

if (isMain) {
  await main(process.argv.slice(2));
}
