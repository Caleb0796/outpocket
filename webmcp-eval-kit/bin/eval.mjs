#!/usr/bin/env node
import assert from "node:assert/strict";
import dns from "node:dns";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
const NETWORK_DENIAL_ERROR = "E_NETWORK_DISABLED";
const NETWORK_DENIAL_MECHANISM =
  "prototype patch on net.Socket.prototype.connect and dns.lookup, in-process, via --import ./webmcp-eval-kit/test/no-net.mjs";

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
          accounting: accountingForTools(SELFTEST_TOOLS),
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

function networkDenialControl(operation, attempt) {
  let observedError;
  let failure;

  try {
    assert.throws(
      attempt,
      (error) => {
        observedError = error;
        return error?.code === NETWORK_DENIAL_ERROR
          && /eval kit network access is forbidden/.test(error.message);
      },
      `${operation} positive control must throw ${NETWORK_DENIAL_ERROR}`,
    );
  } catch (error) {
    failure = error;
  }

  return {
    failure,
    result: observedError
      ? { errorCode: observedError.code, operation, verdict: "denied" }
      : undefined,
  };
}

function proveNetworkDenial() {
  const dnsControl = networkDenialControl(
    "dns.lookup",
    () => dns.lookup("localhost", () => {}),
  );
  const socket = new net.Socket();
  socket.on("error", () => {});
  const socketControl = networkDenialControl(
    "net.Socket.prototype.connect",
    () => socket.connect(9, "127.0.0.1"),
  );
  socket.destroy();

  const failures = [dnsControl, socketControl]
    .filter((control) => control.failure)
    .map((control) => control.failure.message);
  assert.deepEqual(
    failures,
    [],
    `network denial did not arm; positive controls failed: ${failures.join("; ")}`,
  );
  assert.equal(
    dns.lookup,
    net.Socket.prototype.connect,
    "network denial hooks were not installed from the same --import preload",
  );
  assert.equal(
    dns.lookup.denialMechanism,
    NETWORK_DENIAL_MECHANISM,
    "network denial hook does not identify the required in-process --import mechanism",
  );

  return [socketControl.result, dnsControl.result];
}

function accountingForTools(tools) {
  const descriptionBytes = tools.reduce((total, tool) => {
    assert.equal(typeof tool.description, "string", `${tool.name}: description must be a string`);
    return total + Buffer.byteLength(tool.description, "utf8");
  }, 0);
  const schemaBytes = tools.reduce((total, tool) => {
    assert.ok(tool.inputSchema, `${tool.name}: inputSchema is required`);
    const wrapped = canon({ inputSchema: tool.inputSchema });
    const inputSchema = wrapped.slice('{"inputSchema":'.length, -1);
    return total + Buffer.byteLength(inputSchema, "utf8");
  }, 0);
  const nameBytes = tools.reduce((total, tool) => {
    assert.equal(typeof tool.name, "string", "tool name must be a string");
    return total + Buffer.byteLength(tool.name, "utf8");
  }, 0);
  const totalBytes = descriptionBytes + schemaBytes + nameBytes;

  return {
    description_bytes: descriptionBytes,
    estimated_tokens: Math.ceil(totalBytes / 4),
    schema_bytes: schemaBytes,
    tool_count: tools.length,
    total_bytes: totalBytes,
  };
}

function accountStates(exported) {
  assert.ok(Array.isArray(exported.states), "tools export must contain a states array");
  assert.ok(exported.states.length > 0, "accounting refuses an empty states array");

  return exported.states.map((state) => {
    assert.ok(Array.isArray(state.tools), `${state.state_id}: tools must be an array`);
    assert.ok(state.tools.length > 0, `${state.state_id}: accounting refuses an empty tool surface`);

    const exportAccounting = accountingForTools(state.tools);
    assert.deepEqual(
      state.accounting,
      exportAccounting,
      `${state.state_id}: exported accounting drifted from its tool surface`,
    );
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

function assertNoForbiddenKeys(value, forbiddenKeys, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, forbiddenKeys, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbiddenKeys.has(key), `tools export contains forbidden key ${path}.${key}`);
    assertNoForbiddenKeys(child, forbiddenKeys, `${path}.${key}`);
  }
}

function validateExportContract(exported, contract) {
  const requiredStates = Object.entries(contract["x-requiredStates"] ?? {})
    .filter(([, toolCount]) => Number.isInteger(toolCount));
  assert.ok(requiredStates.length > 0, "tool export contract must declare at least one state");
  assert.equal(
    new Set(exported.states.map((state) => state.state_id)).size,
    exported.states.length,
    "tools export state ids must be unique",
  );
  assert.deepEqual(
    exported.states.map((state) => state.state_id).sort(),
    requiredStates.map(([stateId]) => stateId).sort(),
    "tools export states must equal the contract's declared states",
  );

  const stateById = new Map(exported.states.map((state) => [state.state_id, state]));
  for (const [stateId, toolCount] of requiredStates) {
    assert.equal(stateById.get(stateId).tools.length, toolCount, `${stateId}: declared tool count drift`);
  }

  const forbiddenKeys = new Set(contract["x-forbiddenKeys"]?.keys);
  assert.ok(forbiddenKeys.size > 0, "tool export contract must declare forbidden keys");
  assertNoForbiddenKeys(exported, forbiddenKeys);
}

function validateExportTotals(exported, states) {
  const tools = exported.states.flatMap((state) => state.tools);
  const expected = {
    distinct_tool_count: new Set(tools.map((tool) => tool.name)).size,
    max_description_bytes: Math.max(
      ...tools.map((tool) => Buffer.byteLength(tool.description, "utf8")),
    ),
    state_count: states.length,
  };
  assert.deepEqual(exported.totals, expected, "tools export totals drifted from its states");
}

function declaredAccountingCases(contract) {
  const cases = contract["x-requiredCases"]?.surface_accounting;
  assert.ok(Array.isArray(cases), "eval case contract must declare surface_accounting cases");
  assert.ok(cases.length > 0, "accounting refuses a declared suite with zero cases");
  assert.equal(new Set(cases).size, cases.length, "declared accounting case ids must be unique");
  return cases;
}

function runAccountingCases(declaredCases, exported, states) {
  const implementations = new Map([
    ["acct-bytes-per-state", () => {
      const byteBudget = 8000;
      const maximumBytes = Math.max(...states.map((state) => state.bytes));
      assert.ok(maximumBytes <= byteBudget, `canonical state surface exceeds ${byteBudget} bytes`);
      return { byteBudget, maximumBytes, stateCount: states.length };
    }],
    ["acct-description-budget", () => {
      const descriptions = exported.states.flatMap((state) =>
        state.tools.map((tool) => tool.description)
      );
      assert.ok(descriptions.length > 0, "description accounting refuses zero descriptions");
      const lengths = descriptions.map((description) => description.length);
      const guidanceChars = 500;
      const maximumChars = Math.max(...lengths);
      return {
        descriptionCount: descriptions.length,
        guidanceChars,
        maximumChars,
        medianChars: median(lengths),
        withinPublishedGuidance: maximumChars <= guidanceChars,
      };
    }],
  ]);
  assert.deepEqual(
    [...implementations.keys()],
    declaredCases,
    "accounting implementations must equal the suite's declared cases",
  );

  return declaredCases.map((id) => {
    try {
      return { id, measurements: implementations.get(id)(), verdict: "pass" };
    } catch (error) {
      return { error: error.message, id, verdict: "fail" };
    }
  });
}

async function listSourceFiles(directory) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSourceFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function scanSourceForModelHosts() {
  const directory = fileURLToPath(new URL("webmcp-eval-kit/src/", repositoryUrl));
  const directoryStat = await stat(directory);
  assert.ok(directoryStat.isDirectory(), "webmcp-eval-kit/src must be a directory");
  const files = await listSourceFiles(directory);
  assert.ok(files.length > 0, "webmcp-eval-kit/src must contain files before its negative scan counts");

  for (const file of files) {
    assert.doesNotMatch(
      await readFile(file, "utf8"),
      /api\.openai|api\.anthropic/,
      `${file}: forbidden model API host`,
    );
  }
  return { directory: "webmcp-eval-kit/src/", filesScanned: files.length, verdict: "absent" };
}

async function runAccountingSuite() {
  const sourceUrl = new URL("artifacts/tools.export.json", repositoryUrl);
  const outputUrl = new URL("evals/accounting.json", repositoryUrl);
  const evalContractUrl = new URL("erp/contracts/eval-case.schema.json", repositoryUrl);
  const exportContractUrl = new URL("erp/contracts/tool-export.schema.json", repositoryUrl);
  const networkDenialControls = proveNetworkDenial();
  const sourceScan = await scanSourceForModelHosts();
  const [exported, evalContract, exportContract] = await Promise.all(
    [sourceUrl, evalContractUrl, exportContractUrl].map(async (url) =>
      JSON.parse(await readFile(url, "utf8"))
    ),
  );
  validateExportContract(exported, exportContract);
  const states = accountStates(exported);
  validateExportTotals(exported, states);
  const declaredCases = declaredAccountingCases(evalContract);
  const cases = runAccountingCases(declaredCases, exported, states);
  assert.equal(cases.length, declaredCases.length, "result count must equal declared case count");
  assert.ok(cases.every((testCase) => testCase.verdict), "every case must carry a verdict");

  const result = {
    header: {
      caseCount: cases.length,
      declaredCaseCount: declaredCases.length,
      networkDenial: {
        mechanism: NETWORK_DENIAL_MECHANISM,
        positiveControls: networkDenialControls,
      },
      sourceScan,
    },
    cases,
    schema: "outpocket.surface_accounting/1",
    states,
  };
  await mkdir(new URL("evals/", repositoryUrl), { recursive: true });
  await writeFile(outputUrl, `${JSON.stringify(result, null, 2)}\n`);
  const failedCases = cases.filter((testCase) => testCase.verdict === "fail");
  assert.deepEqual(failedCases, [], "accounting case verdicts must all pass");
  process.stdout.write(
    `accounting: ${cases.length} case(s), ${states.length} state(s), ${sourceScan.filesScanned} source file(s) scanned; written to evals/accounting.json\n`,
  );
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
