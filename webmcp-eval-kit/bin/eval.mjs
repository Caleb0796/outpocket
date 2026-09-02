#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import dns from "node:dns";
import { existsSync, realpathSync } from "node:fs";
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
const NETWORK_DENIAL_CHILD = "WEBMCP_EVAL_NETWORK_DENIAL_CHILD";
const NETWORK_DENIAL_ERROR = "E_NETWORK_DISABLED";
const NETWORK_DENIAL_MECHANISM =
  "prototype patch on net.Socket.prototype.connect and dns.lookup, in-process, via --import ./webmcp-eval-kit/test/no-net.mjs";
const CANONICAL_STATE_IDS = Object.freeze([
  "S0-anon",
  "S1-emp-home",
  "S2-emp-draft-clean",
  "S3-emp-draft-dirty",
  "S4-emp-submitted",
  "S5-aud",
]);
const CAPABILITY_CONTROL_FLAG = "--selftest-capability-control";

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

const codepointSort = (values) =>
  [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);

function assertUniqueStrings(values, label) {
  assert.ok(Array.isArray(values), `${label} must be an array`);
  const seen = new Set();
  for (const value of values) {
    assert.equal(typeof value, "string", `${label} must contain only strings`);
    assert.ok(value.length > 0, `${label} must not contain an empty string`);
    assert.ok(!seen.has(value), `${label} contains duplicate value ${value}`);
    seen.add(value);
  }
}

function assertCanonicalStateIds(states, label) {
  assert.ok(Array.isArray(states), `${label} must be an array`);
  assert.equal(
    states.length,
    CANONICAL_STATE_IDS.length,
    `${label} must declare exactly ${CANONICAL_STATE_IDS.length} canonical states`,
  );
  const ids = states.map((state) => state.state_id);
  assertUniqueStrings(ids, `${label} state ids`);
  assert.deepEqual(
    codepointSort(ids),
    codepointSort(CANONICAL_STATE_IDS),
    `${label} state ids must equal the six canonical state ids`,
  );
}

function expectedSurfacesFromExport(exported) {
  assertCanonicalStateIds(exported.states, "tools export");
  assert.equal(
    exported.totals?.state_count,
    CANONICAL_STATE_IDS.length,
    "tools export totals must report six canonical states",
  );
  const distinctTools = new Set();
  const states = exported.states.map((state) => {
    const names = state.tools.map((tool) => tool.name);
    assertUniqueStrings(names, `${state.state_id} exported tool names`);
    names.forEach((name) => distinctTools.add(name));
    return {
      state_id: state.state_id,
      surface_digest: state.surface_digest,
      tool_names: codepointSort(names),
    };
  });
  assert.equal(
    distinctTools.size,
    exported.totals?.distinct_tool_count,
    "tools export distinct-tool total drifted from its states",
  );

  return {
    schema: "outpocket.expected_surfaces/1",
    source: {
      app_commit: exported.app_commit,
      distinct_tool_count: exported.totals.distinct_tool_count,
      path: "artifacts/tools.export.json",
      policy_digest: exported.policy_digest,
      policy_version: exported.policy_version,
      schema: exported.schema,
    },
    states,
  };
}

export function gradeCapabilityStates(expectedStates, observedStates) {
  assertCanonicalStateIds(expectedStates, "runtime export expectation");
  assert.ok(Array.isArray(observedStates), "live capability result must be an array");
  assert.equal(
    observedStates.length,
    CANONICAL_STATE_IDS.length,
    `capability graded ${observedStates.length} of ${CANONICAL_STATE_IDS.length} canonical states; run graded fewer than six`,
  );
  assertCanonicalStateIds(observedStates, "live capability result");

  const observedById = new Map(observedStates.map((state) => [state.state_id, state]));
  const failures = [];
  const results = [];

  for (const expected of expectedStates) {
    assertUniqueStrings(expected.tool_names, `${expected.state_id} expected tool names`);
    const observed = observedById.get(expected.state_id);
    assertUniqueStrings(observed.tool_names, `${expected.state_id} live tool names`);
    const expectedSet = new Set(expected.tool_names);
    const observedSet = new Set(observed.tool_names);
    const missing = codepointSort([...expectedSet].filter((name) => !observedSet.has(name)));
    const extra = codepointSort([...observedSet].filter((name) => !expectedSet.has(name)));
    missing.forEach((name) => failures.push(`${expected.state_id}: missing tool ${name}`));
    extra.forEach((name) => failures.push(`${expected.state_id}: extra tool ${name}`));
    results.push({ extra, missing, state_id: expected.state_id });
  }

  assert.deepEqual(failures, [], failures.join("; "));
  return results;
}

function capabilityControlFixture(mode) {
  const expected = CANONICAL_STATE_IDS.map((stateId) => ({
    state_id: stateId,
    tool_names: stateId === "S4-emp-submitted"
      ? ["employee_surface", "shared_tool"]
      : stateId === "S5-aud"
        ? ["get_day_book", "shared_tool"]
        : [`${stateId}_tool`],
  }));
  const observed = structuredClone(expected);
  if (mode === "extra") {
    observed.find((state) => state.state_id === "S4-emp-submitted")
      .tool_names.push("selftest_extra_tool");
  } else if (mode === "missing") {
    const auditor = observed.find((state) => state.state_id === "S5-aud");
    auditor.tool_names = auditor.tool_names.filter((name) => name !== "get_day_book");
  } else if (mode === "short") {
    observed.pop();
  } else if (mode !== "correct") {
    throw new TypeError(`unknown capability control: ${mode}`);
  }
  gradeCapabilityStates(expected, observed);
  process.stdout.write(`capability control ${mode}: accepted six-state run\n`);
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
    assert.deepEqual(
      parseArgs(["run", "--suite", "negative", "--verify-controls"], {
        URL: "https://example.test",
      }),
      {
        suites: ["negative"],
        url: "https://example.test",
        verifyControls: true,
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

    const cliPath = fileURLToPath(import.meta.url);
    const control = (mode) => spawnSync(
      process.execPath,
      [cliPath, CAPABILITY_CONTROL_FLAG, mode],
      { encoding: "utf8" },
    );
    const correct = control("correct");
    const extra = control("extra");
    const missing = control("missing");
    const short = control("short");
    assert.equal(correct.status, 0, correct.stderr);
    assert.match(correct.stdout, /accepted six-state run/);
    assert.equal(extra.status, 1, "extra-tool control must exit 1");
    assert.match(extra.stderr, /S4-emp-submitted: extra tool selftest_extra_tool/);
    assert.equal(missing.status, 1, "missing-tool control must exit 1");
    assert.match(missing.stderr, /S5-aud: missing tool get_day_book/);
    assert.equal(short.status, 1, "short-run control must exit 1");
    assert.match(short.stderr, /capability graded 5 of 6 canonical states; run graded fewer than six/);

    process.stdout.write(
      `selftest ok: tool_count=${firstResult.tool_count} byte_identical=true empty_suite_refused=true `
      + "capability_correct_exit=0 capability_extra_exit=1 capability_missing_exit=1 "
      + "capability_short_exit=1\n",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function parseArgs(argv, environment = process.env) {
  const options = { suites: [] };
  let index = 0;

  if (argv[0] === "run") index += 1;

  for (; index < argv.length; index += 1) {
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
    if (argument === "--verify-controls") {
      if (options.verifyControls) {
        throw new TypeError("duplicate --verify-controls");
      }
      options.verifyControls = true;
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
  if (options.verifyControls) {
    if (options.suites.length !== 1 || options.suites[0] !== "negative") {
      throw new TypeError("--verify-controls requires --suite negative alone");
    }
    options.url ??= environment.URL;
  }
  if (options.suites.some((suite) => suite !== "accounting")) {
    if (!options.url) {
      throw new TypeError("capability and negative suites require --url (or URL with --verify-controls)");
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

function networkDenialIsArmed() {
  return dns.lookup === net.Socket.prototype.connect
    && dns.lookup.denialMechanism === NETWORK_DENIAL_MECHANISM;
}

// The accounting claim covers the whole evaluator process, so loading the
// denial module from runAccountingSuite() would be too late: any new top-level
// import could already have opened a socket. The public CLI therefore re-enters
// itself with Node's preload flag and the child proves both patched operations
// before reading the export. The child marker only detects a failed preload;
// the installed functions remain the pass condition, so setting the marker by
// itself produces a versioned diagnostic instead of bypassing the control.
function runAccountingWithNetworkDenial(argv) {
  const preloadPath = fileURLToPath(new URL("../test/no-net.mjs", import.meta.url));
  const cliPath = fileURLToPath(import.meta.url);
  const child = spawnSync(
    process.execPath,
    ["--import", preloadPath, cliPath, ...argv],
    {
      env: { ...process.env, [NETWORK_DENIAL_CHILD]: "1" },
      stdio: "inherit",
    },
  );
  if (child.error) throw child.error;
  if (child.status === null) {
    throw new Error(`accounting network-denial child ended via ${child.signal ?? "an unknown signal"}`);
  }
  return child.status;
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

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
          pending.reject(Object.assign(new Error(message.error.message), { cdp: message.error }));
        } else {
          pending.resolve(message.result);
        }
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  static async connect(url) {
    assert.equal(typeof WebSocket, "function", "this eval kit requires Node with global WebSocket support");
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new CDP(socket);
  }

  send(method, params = {}, sessionId, timeoutMs = 30000) {
    const id = ++this.nextId;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { reject, resolve, timer });
      this.socket.send(JSON.stringify(message));
    });
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    try {
      this.socket.close();
    } catch {}
  }
}

function chromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const binary = candidates.find((candidate) => existsSync(candidate));
  assert.ok(binary, `no Chrome binary found; set CHROME_PATH or CHROME_BIN; tried ${candidates.join(", ")}`);
  return binary;
}

async function launchCapabilityChrome() {
  const { flagsFor, launchLabel } = await import(new URL("../../tools/chrome.mjs", import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), "webmcp-capability-"));
  const flags = flagsFor("cdp", {
    headless: true,
    port: 0,
    url: "about:blank",
    userDataDir: directory,
  });
  process.stderr.write(`${launchLabel("cdp", flags)} suite=capability\n`);
  const child = spawn(chromeBinary(), flags, { stdio: ["ignore", "ignore", "ignore"] });
  const portFile = join(directory, "DevToolsActivePort");
  let webSocketUrl;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (existsSync(portFile)) {
      const [port, path] = (await readFile(portFile, "utf8")).split("\n");
      if (port && path) {
        webSocketUrl = `ws://127.0.0.1:${port.trim()}${path.trim()}`;
        break;
      }
    }
    await sleep(50);
  }
  if (!webSocketUrl) {
    child.kill("SIGKILL");
    await rm(directory, { force: true, recursive: true });
    throw new Error("Chrome never wrote DevToolsActivePort");
  }
  let cdp;
  try {
    cdp = await CDP.connect(webSocketUrl);
  } catch (error) {
    child.kill("SIGKILL");
    await rm(directory, { force: true, recursive: true });
    throw error;
  }
  return {
    cdp,
    async close() {
      cdp.close();
      child.kill("SIGKILL");
      await sleep(150);
      await rm(directory, { force: true, recursive: true });
    },
  };
}

async function evaluateInPage(cdp, sessionId, expression, awaitPromise = false) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { awaitPromise, expression, returnByValue: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "page evaluation failed",
    );
  }
  return result.result.value;
}

async function openCapabilityPage(browser, url) {
  const { targetId } = await browser.cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.cdp.send(
    "Target.attachToTarget",
    { flatten: true, targetId },
  );
  await browser.cdp.send("Page.enable", {}, sessionId);
  await browser.cdp.send("Runtime.enable", {}, sessionId);
  await browser.cdp.send("WebMCP.enable", {}, sessionId);
  let loadTimer;
  let stopLoading;
  const loaded = new Promise((resolve) => {
    stopLoading = browser.cdp.on((message) => {
      if (message.sessionId === sessionId && message.method === "Page.loadEventFired") {
        clearTimeout(loadTimer);
        stopLoading();
        resolve();
      }
    });
    loadTimer = setTimeout(() => {
      stopLoading();
      resolve();
    }, 90000);
  });
  try {
    await browser.cdp.send("Page.navigate", { url }, sessionId, 90000);
    await loaded;
  } finally {
    clearTimeout(loadTimer);
    stopLoading();
  }
  const { frameTree } = await browser.cdp.send("Page.getFrameTree", {}, sessionId);
  return { frameId: frameTree.frame.id, sessionId };
}

async function clickSelector(cdp, sessionId, selector) {
  const box = await evaluateInPage(cdp, sessionId, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: "center" });
    const bounds = element.getBoundingClientRect();
    return {
      height: bounds.height,
      width: bounds.width,
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
  })()`);
  assert.ok(box, `setup selector not found: ${selector}`);
  if (box.width < 1 || box.height < 1) {
    await evaluateInPage(
      cdp,
      sessionId,
      `document.querySelector(${JSON.stringify(selector)}).click()`,
    );
    return;
  }
  const point = {
    button: "left",
    clickCount: 1,
    x: Math.round(box.x),
    y: Math.round(box.y),
  };
  await cdp.send("Input.dispatchMouseEvent", { ...point, type: "mousePressed" }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { ...point, type: "mouseReleased" }, sessionId);
}

async function invokeCapabilityTool(cdp, sessionId, frameId, toolName, input) {
  let invocationId;
  const queued = [];
  let resolveResponse;
  const response = new Promise((resolve) => {
    resolveResponse = resolve;
  });
  const stop = cdp.on((message) => {
    if (message.sessionId !== sessionId || message.method !== "WebMCP.toolResponded") return;
    queued.push(message.params);
    if (invocationId && message.params.invocationId === invocationId) resolveResponse(message.params);
  });
  const timer = setTimeout(() => resolveResponse(null), 30000);

  try {
    ({ invocationId } = await cdp.send(
      "WebMCP.invokeTool",
      { frameId, input, toolName },
      sessionId,
      30000,
    ));
    const early = queued.find((event) => event.invocationId === invocationId);
    if (early) resolveResponse(early);
    const event = await response;
    assert.ok(event, `${toolName}: no WebMCP.toolResponded within 30 seconds`);
    assert.equal(event.invocationId, invocationId, `${toolName}: response invocation id mismatch`);
    assert.equal(
      event.status,
      "Completed",
      `${toolName}: WebMCP status ${event.status}${event.exception?.description ? `: ${event.exception.description}` : ""}`,
    );
    const content = event.output?.content;
    assert.ok(Array.isArray(content), `${toolName}: completed response has no content array`);
    return content.map((block) => block?.text ?? "").join("\n");
  } finally {
    clearTimeout(timer);
    stop();
  }
}

function resolveCapabilityValue(value, variables) {
  if (Array.isArray(value)) return value.map((item) => resolveCapabilityValue(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, resolveCapabilityValue(child, variables)]),
    );
  }
  if (typeof value === "string" && value.startsWith("$") && !value.slice(1).includes("$")) {
    const name = value.slice(1);
    assert.ok(Object.hasOwn(variables, name), `setup variable ${value} is not defined`);
    return variables[name];
  }
  return value;
}

// State construction needs a real committed report, but this suite does not
// grade the human dialog. Its scoped provider uses the page's current open-body
// builder, records an authentic signed response on the server, and deliberately
// returns the awaiting result across one tool-call boundary. A later invocation
// can then exercise the provider's current {request_id,response,settle} contract
// and let submit_expense_report perform the real commit.
function installCapabilitySignatureProviderInPage() {
  const registry = globalThis.outpocketTools;
  const buildOpenBody = globalThis.outpocketSignInstall?.buildOpenBody;
  if (typeof registry?.setSignatureProvider !== "function" || typeof buildOpenBody !== "function") {
    return false;
  }
  const pending = new Map();

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `${options.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`,
      );
    }
    return body;
  }

  globalThis.__capabilitySignatureUndo = registry.setSignatureProvider(async (summary) => {
    const existing = pending.get(summary.reportId);
    if (existing) {
      return {
        reason: null,
        request_id: existing.signRequest.request_id,
        response: existing.response,
        signed: true,
        ticket: existing.ticket,
        settle({ status } = {}) {
          if (status === "committed" && pending.get(summary.reportId) === existing) {
            pending.delete(summary.reportId);
          }
        },
      };
    }

    const opened = await request("/api/sign", {
      body: JSON.stringify(buildOpenBody(summary)),
      method: "POST",
    });
    const signRequest = opened.sign_request;
    if (!signRequest?.request_id || typeof opened.ticket !== "string" || !opened.ticket) {
      throw new Error("capability sign setup received an incomplete open response");
    }
    const token = await request(
      `/api/sign/${encodeURIComponent(signRequest.request_id)}/confirm-token`,
    );
    const response = await request(
      `/api/sign/${encodeURIComponent(signRequest.request_id)}/respond`,
      {
        body: JSON.stringify({
          acknowledged_digest: signRequest.snapshot_digest,
          acknowledged_revision: signRequest.revision,
          confirm_token: token.confirm_token,
          decision: "signed",
          method: "click",
          reason: null,
          request_id: signRequest.request_id,
          schema: "outpocket.sign_respond_request/1",
        }),
        method: "POST",
      },
    );
    pending.set(summary.reportId, {
      response,
      signRequest,
      ticket: opened.ticket,
    });
    return { status: "awaiting_signature", ticket: opened.ticket };
  });
  return true;
}

async function runCapabilityAction(context, action) {
  const { cdp, frameId, sessionId, variables } = context;
  if (action.type === "click") {
    await clickSelector(cdp, sessionId, action.selector);
    return;
  }
  if (action.type === "install_signature_provider") {
    const installed = await evaluateInPage(
      cdp,
      sessionId,
      `(${installCapabilitySignatureProviderInPage.toString()})()`,
    );
    assert.equal(installed, true, "capability setup could not install the scoped signature provider");
    process.stderr.write(`capability setup: signature provider injected for ${action.scope}\n`);
    return;
  }
  if (action.type === "discover_active_project") {
    const text = await invokeCapabilityTool(cdp, sessionId, frameId, "get_session_scope", {});
    const projects = /Chargeable projects:\s*([^.]*)/i.exec(text)?.[1] ?? "";
    const active = projects.split(";").find((entry) => !/CLOSED/i.test(entry));
    const project = /([A-Z][A-Z0-9_-]{2,})/.exec(active ?? "")?.[1];
    assert.ok(project, `get_session_scope exposed no active project: ${JSON.stringify(text.slice(0, 240))}`);
    variables.project = project;
    return;
  }
  if (action.type === "discover_policy") {
    const text = await invokeCapabilityTool(cdp, sessionId, frameId, "get_expense_policy", {});
    const policy = JSON.parse(text);
    const transportCap = policy.limits_cents?.transport_per_line;
    const receiptThreshold = policy.limits_cents?.receipt_required_at;
    assert.ok(Number.isInteger(transportCap), "policy has no integer transport_per_line limit");
    assert.ok(Number.isInteger(receiptThreshold), "policy has no integer receipt_required_at limit");
    variables.over_transport_cap = transportCap / 100 + 100;
    variables.clean_transport_amount = Math.max(
      0.01,
      Math.min(transportCap, receiptThreshold) / 100 - 1,
    );
    variables.yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return;
  }
  assert.equal(action.type, "tool", `unknown capability setup action: ${action.type}`);
  const args = resolveCapabilityValue(action.args ?? {}, variables);
  const text = await invokeCapabilityTool(cdp, sessionId, frameId, action.name, args);
  if (action.require_text) {
    assert.match(text, new RegExp(action.require_text), `${action.name}: required result text was absent`);
  }
  if (action.capture) {
    const matched = new RegExp(action.capture.pattern).exec(text);
    assert.ok(matched?.[1], `${action.name}: capture ${action.capture.name} did not match its result`);
    variables[action.capture.name] = matched[1];
  }
}

async function captureStableCapabilityState(cdp, sessionId, expectedInternalState) {
  const deadline = Date.now() + 20000;
  let prior;
  for (;;) {
    const observed = await evaluateInPage(cdp, sessionId, `(async () => ({
      internalState: globalThis.outpocketTools?.state?.() ?? null,
      names: typeof document.modelContext === "object" && document.modelContext
        ? (await document.modelContext.getTools()).map((tool) => tool.name)
        : null
    }))()`, true);
    if (observed?.internalState === expectedInternalState && Array.isArray(observed.names)) {
      const serialized = JSON.stringify(observed.names);
      if (serialized === prior) return observed;
      prior = serialized;
    } else {
      prior = undefined;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `did not settle in internal ${expectedInternalState}; last reading ${JSON.stringify(observed)}`,
      );
    }
    await sleep(200);
  }
}

async function collectCapabilityStates(url, suite) {
  const browser = await launchCapabilityChrome();
  const observed = [];
  let setupFailure;
  try {
    const page = await openCapabilityPage(browser, url);
    const context = { ...page, cdp: browser.cdp, variables: {} };
    for (const state of suite.states) {
      try {
        for (const action of state.setup) await runCapabilityAction(context, action);
        const live = await captureStableCapabilityState(
          browser.cdp,
          page.sessionId,
          state.expected_internal_state,
        );
        observed.push({
          actual_internal_state: live.internalState,
          expected_internal_state: state.expected_internal_state,
          state_id: state.state_id,
          tool_names: live.names,
        });
      } catch (error) {
        setupFailure = `${state.state_id}: ${error.message}`;
        break;
      }
    }
  } finally {
    await browser.close();
  }
  if (observed.length !== CANONICAL_STATE_IDS.length) {
    const graded = new Set(observed.map((state) => state.state_id));
    const skipped = suite.states
      .map((state) => state.state_id)
      .filter((stateId) => !graded.has(stateId));
    throw new Error(
      `capability graded ${observed.length} of ${CANONICAL_STATE_IDS.length} canonical states; `
      + `run graded fewer than six; skipped ${skipped.join(", ")}; ${setupFailure}`,
    );
  }
  return observed;
}

function applyCapabilityMutation(observed) {
  const specification = process.env.WEBMCP_EVAL_CAPABILITY_MUTATION;
  if (!specification) return observed;
  const [direction, stateId, toolName] = specification.split(":");
  assert.ok(direction === "extra" || direction === "missing", "capability mutation direction must be extra or missing");
  assert.ok(toolName, "capability mutation must name a tool");
  const mutated = structuredClone(observed);
  const state = mutated.find((entry) => entry.state_id === stateId);
  assert.ok(state, `capability mutation names unknown state ${stateId}`);
  if (direction === "extra") {
    assert.ok(!state.tool_names.includes(toolName), `${stateId}: mutation tool ${toolName} is already present`);
    state.tool_names.push(toolName);
  } else {
    assert.ok(state.tool_names.includes(toolName), `${stateId}: cannot remove absent mutation tool ${toolName}`);
    state.tool_names = state.tool_names.filter((name) => name !== toolName);
  }
  process.stderr.write(`capability negative control: injected ${direction} tool ${toolName} in ${stateId}\n`);
  return mutated;
}

function validateCapabilitySuite(suite) {
  assert.equal(suite.schema, "outpocket.capability_suite/1", "capability suite schema mismatch");
  assert.equal(suite.canonical_state_count, 6, "capability suite must declare six canonical states");
  assert.equal(suite.expected_source, "artifacts/tools.export.json");
  assert.equal(suite.expected_fixture, "evals/surfaces.expected.json");
  assertCanonicalStateIds(suite.states, "capability suite");
  const internalByCanonical = {
    "S0-anon": "S0",
    "S1-emp-home": "S1",
    "S2-emp-draft-clean": "S3",
    "S3-emp-draft-dirty": "S2",
    "S4-emp-submitted": "S4",
    "S5-aud": "S5",
  };
  for (const state of suite.states) {
    assert.ok(Array.isArray(state.setup), `${state.state_id}: setup must be an array`);
    assert.ok(!Object.hasOwn(state, "tool_names"), `${state.state_id}: suite must not transcribe expected tools`);
    assert.equal(
      state.expected_internal_state,
      internalByCanonical[state.state_id],
      `${state.state_id}: canonical/compiler state mapping is wrong`,
    );
  }
}

async function runCapabilitySuite(url) {
  const sourceUrl = new URL("artifacts/tools.export.json", repositoryUrl);
  const fixtureUrl = new URL("evals/surfaces.expected.json", repositoryUrl);
  const suiteUrl = new URL("evals/suites/capability.suite.json", repositoryUrl);
  const [exported, fixture, suite] = await Promise.all(
    [sourceUrl, fixtureUrl, suiteUrl].map(async (location) =>
      JSON.parse(await readFile(location, "utf8"))
    ),
  );
  validateCapabilitySuite(suite);
  const expected = expectedSurfacesFromExport(exported);
  assert.deepEqual(
    fixture,
    expected,
    "evals/surfaces.expected.json drifted from its runtime-generated artifacts/tools.export.json projection",
  );
  const observed = applyCapabilityMutation(await collectCapabilityStates(url, suite));
  const results = gradeCapabilityStates(expected.states, observed);
  for (const result of results) {
    process.stdout.write(`${result.state_id}: matched by set equality on tool names\n`);
  }
  process.stdout.write(
    `capability: ${results.length} of ${CANONICAL_STATE_IDS.length} canonical states matched; `
    + "zero states skipped; expected sets taken from artifacts/tools.export.json at runtime; "
    + "set equality on tool names, never by count equality\n",
  );
}

function assertIntegerNumbers(value, label, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertIntegerNumbers(item, label, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertIntegerNumbers(child, label, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "number") {
    assert.ok(Number.isInteger(value), `${label} contains a non-integer number at ${path}`);
  }
}

function negativeCaseById(suite, id) {
  const testCase = suite.cases.find((candidate) => candidate.id === id);
  assert.ok(testCase, `negative suite is missing ${id}`);
  return testCase;
}

export function validateNegativeSuite(suite, expectedStates, requiredCaseIds) {
  assert.equal(suite.schema, "outpocket.negative_suite/1", "negative suite schema mismatch");
  assert.ok(
    Number.isInteger(suite.declared_case_count) && suite.declared_case_count > 0,
    "negative suite declared_case_count must be a non-zero integer",
  );
  assert.ok(Array.isArray(suite.cases), "negative suite cases must be an array");
  assert.ok(suite.cases.length > 0, "negative suite refuses to pass with zero cases");
  assert.equal(
    suite.cases.length,
    suite.declared_case_count,
    `negative graded ${suite.cases.length} of ${suite.declared_case_count} declared cases; run graded fewer than declared`,
  );
  assertUniqueStrings(suite.cases.map((testCase) => testCase.id), "negative case ids");
  assert.deepEqual(
    codepointSort(suite.cases.map((testCase) => testCase.id)),
    codepointSort(requiredCaseIds),
    "negative suite case ids must equal eval-case.schema.json x-requiredCases.negative_control",
  );
  assertIntegerNumbers(suite, "negative suite");

  const caseIds = new Set(suite.cases.map((testCase) => testCase.id));
  const stateIds = expectedStates.map((state) => state.state_id);
  assertUniqueStrings(stateIds, "negative pairing state ids");
  const pairings = new Map(stateIds.map((stateId) => [stateId, []]));

  for (const testCase of suite.cases) {
    assert.equal(typeof testCase.provingNode, "string", `${testCase.id}: provingNode is required`);
    assert.ok(testCase.provingNode.length > 0, `${testCase.id}: provingNode must not be empty`);
    assert.equal(typeof testCase.brokenBy, "string", `${testCase.id}: brokenBy is required`);
    assert.ok(testCase.brokenBy.length > 0, `${testCase.id}: brokenBy must not be empty`);
    assert.ok(
      ["enforced", "known-open", "not-runnable"].includes(testCase.controlStatus),
      `${testCase.id}: invalid controlStatus ${testCase.controlStatus}`,
    );
    assertUniqueStrings(testCase.pairsWith, `${testCase.id} pairsWith`);
    assert.ok(testCase.expect && typeof testCase.expect === "object", `${testCase.id}: expect is required`);
    assert.ok(testCase.wellFormed && typeof testCase.wellFormed === "object", `${testCase.id}: wellFormed control is required`);
    if (testCase.expect.outcome === "required_failure") {
      assert.ok(testCase.expect.failure, `${testCase.id}: required_failure must name its failure`);
      assert.ok(testCase.pairsWith.length > 0, `${testCase.id}: enforced case must pair with something`);
      if (testCase.expect.failure.mode === "server_rejects") {
        assert.ok(Number.isInteger(testCase.expect.failure.http_status), `${testCase.id}: exact http_status is required`);
        assert.equal(typeof testCase.expect.failure.error_code, "string", `${testCase.id}: exact error_code is required`);
        assert.ok(Number.isInteger(testCase.wellFormed.http_status), `${testCase.id}: well-formed control must name its exact status`);
      }
    } else {
      assert.equal(testCase.expect.outcome, "pass", `${testCase.id}: invalid expected outcome`);
    }

    for (const pair of testCase.pairsWith) {
      assert.ok(pairings.has(pair) || caseIds.has(pair), `${testCase.id}: unknown pairsWith target ${pair}`);
      if (pairings.has(pair) && testCase.controlStatus !== "not-runnable") {
        pairings.get(pair).push(testCase.id);
      }
    }
  }

  const emptyStates = [...pairings]
    .filter(([, pairedCases]) => pairedCases.length === 0)
    .map(([stateId]) => stateId);
  assert.deepEqual(
    emptyStates,
    [],
    `negative pairing map has empty state(s): ${emptyStates.join(", ")}`,
  );

  const n15 = negativeCaseById(suite, "neg-commit-without-human");
  assert.equal(n15.controlId, "N-15");
  assert.deepEqual(
    n15.expect.failure,
    { error_code: "E_NOT_SIGNED", http_status: 409, mode: "server_rejects" },
    "N-15 must require exactly 409 E_NOT_SIGNED",
  );
  const n16 = negativeCaseById(suite, "neg-respond-without-click");
  assert.equal(n16.controlId, "N-16");
  assert.equal(n16.controlStatus, "enforced", "N-16 must consume the scheduled enforced edit");
  const n20 = negativeCaseById(suite, "neg-policy-content-swap");
  assert.equal(n20.controlId, "N-20");
  assert.equal(n20.controlStatus, "enforced");
  assert.equal(n20.expect.failure.http_status, 409);
  assert.equal(n20.expect.failure.error_code, "E_POLICY_DIGEST_MOVED");
  assert.match(n20.honestScope, /WRITE ACCESS TO THE SERVED POLICY DOCUMENT/);
  assert.match(n20.honestScope, /outside the declared N-04 curl-and-cookie model/);
  assert.match(n20.honestScope, /weaker vector than neg-respond-without-click/);
  const n21 = negativeCaseById(suite, "neg-decline-to-unlock");
  assert.equal(n21.controlId, "N-21");
  assert.equal(n21.controlStatus, "enforced");
  assert.equal(n21.expect.failure.http_status, 409);
  assert.equal(n21.expect.failure.error_code, "E_ALREADY_ANSWERED");
  assert.deepEqual(n21.expect.secondary, { error_code: "E_DECLINED", http_status: 200 });
  assert.match(n21.severity, /nuisance-grade denial, not a forgery/i);

  return pairings;
}

function responseErrorCode(body) {
  if (typeof body?.error === "string") return body.error;
  return body?.error?.code;
}

function assertHttp(response, expectedStatus, expectedCode, label) {
  assert.equal(
    response.status,
    expectedStatus,
    `${label}: expected HTTP ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.body)}`,
  );
  if (expectedCode !== undefined) {
    assert.equal(
      responseErrorCode(response.body),
      expectedCode,
      `${label}: expected ${expectedCode}, got ${responseErrorCode(response.body)}: ${JSON.stringify(response.body)}`,
    );
  }
}

async function requestJson(origin, path, { body, cookie, method = "GET" } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(new URL(path, origin), {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method,
  });
  return {
    body: await response.json().catch(() => null),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    status: response.status,
  };
}

async function loginNegative(origin, persona) {
  const response = await requestJson(origin, "/api/login", {
    body: { persona },
    method: "POST",
  });
  assertHttp(response, 200, undefined, `login ${persona}`);
  assert.ok(response.cookie, `login ${persona}: no session cookie returned`);
  return response.cookie;
}

let negativeReportCounter = 0;
function nextNegativeReportId(label) {
  negativeReportCounter += 1;
  return `RP-E3-${process.pid}-${negativeReportCounter}-${label}`;
}

function negativeOpenBody(reportId) {
  return {
    report_id: reportId,
    violation_history_count: 0,
    worst_case: "No blocking violations.",
  };
}

async function openNegativeSign(origin, cookie, reportId) {
  const opened = await requestJson(origin, "/api/sign", {
    body: negativeOpenBody(reportId),
    cookie,
    method: "POST",
  });
  assertHttp(opened, 200, undefined, "well-formed open sign request");
  const signRequest = opened.body?.sign_request;
  assert.equal(signRequest?.schema, "outpocket.sign_request/1", "open sign request returned the wrong schema");
  assert.match(signRequest?.request_id ?? "", /^sg_[0-9a-f]{16}$/, "open sign request returned no request_id");
  assert.match(signRequest?.snapshot_digest ?? "", /^sha256:[0-9a-f]{64}$/, "open sign request returned no snapshot digest");
  assert.ok(Number.isInteger(signRequest?.revision), "open sign request returned no integer revision");
  return signRequest;
}

async function confirmToken(origin, cookie, requestId) {
  const response = await requestJson(origin, `/api/sign/${requestId}/confirm-token`, { cookie });
  assertHttp(response, 200, undefined, "dialog confirm_token control");
  assert.equal(typeof response.body?.confirm_token, "string", "dialog channel returned no confirm_token");
  return response.body.confirm_token;
}

function signRespondBody(signRequest, token, decision = "signed") {
  return {
    acknowledged_digest: signRequest.snapshot_digest,
    acknowledged_revision: signRequest.revision,
    confirm_token: token,
    decision,
    method: "click",
    reason: decision === "declined" ? "not my report" : null,
    request_id: signRequest.request_id,
    schema: "outpocket.sign_respond_request/1",
  };
}

function commitBody(signRequest, reportId) {
  return {
    report_id: reportId,
    request_id: signRequest.request_id,
    schema: "outpocket.commit_request/1",
  };
}

async function answerNegativeSign(origin, cookie, signRequest, decision = "signed") {
  const token = await confirmToken(origin, cookie, signRequest.request_id);
  const body = signRespondBody(signRequest, token, decision);
  const response = await requestJson(origin, `/api/sign/${signRequest.request_id}/respond`, {
    body,
    cookie,
    method: "POST",
  });
  assertHttp(response, 200, undefined, "well-formed sign response");
  return { body, response };
}

async function commitNegativeSign(origin, cookie, signRequest, reportId) {
  return requestJson(origin, `/api/reports/${reportId}/commit`, {
    body: commitBody(signRequest, reportId),
    cookie,
    method: "POST",
  });
}

async function createNegativeReport(origin, cookie, label) {
  const requestBody = { project: "FALCON", title: `E3 ${label} ${nextNegativeReportId("title")}` };
  const response = await requestJson(origin, "/api/reports", {
    body: requestBody,
    cookie,
    method: "POST",
  });
  assertHttp(response, 201, undefined, "well-formed create report request");
  assert.ok(response.body?.report?.id, "create report returned no report");
  return { report: response.body.report, requestBody };
}

async function addNegativeLine(origin, cookie, reportId) {
  const body = {
    amount_cents: 1200,
    category: "transport",
    currency: "USD",
    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    merchant: "E3 control",
  };
  const response = await requestJson(origin, `/api/reports/${reportId}/lines`, {
    body,
    cookie,
    method: "POST",
  });
  assertHttp(response, 201, undefined, "well-formed add line request");
  return response.body.line;
}

async function validateNegativeReport(origin, cookie, reportId) {
  const response = await requestJson(origin, `/api/reports/${reportId}/validation`, { cookie });
  assertHttp(response, 200, undefined, "well-formed validate report request");
  assert.equal(
    response.body?.verdict?.blocking,
    0,
    `negative control report ${reportId} was not clean: ${JSON.stringify(response.body?.verdict)}`,
  );
  assert.equal(response.body?.report?.id, reportId, "validate report returned the wrong aggregate");
  return response.body.report;
}

async function createValidatedNegativeReport(origin, cookie, label) {
  const created = await createNegativeReport(origin, cookie, label);
  const line = await addNegativeLine(origin, cookie, created.report.id);
  const report = await validateNegativeReport(origin, cookie, created.report.id);
  return { ...created, line, report };
}

async function signedNegativeReport(origin, cookie, reportId) {
  const signRequest = await openNegativeSign(origin, cookie, reportId);
  await answerNegativeSign(origin, cookie, signRequest);
  return signRequest;
}

// Snapshot and served-policy movement are privileged authority failures, not
// fields a client may put in POST /api/sign. The public target still supplies
// every positive control. For the two attacks that require authority movement,
// the kit starts the same HTTP app with a gate whose injected report/policy
// readers can move only after a genuine sign response. This keeps the request
// shapes identical while preserving the exact server refusal each case grades.
async function withAuthorityMutationServer(context, run) {
  const [{ createHttpServer }, { createSignGate }] = await Promise.all([
    import(new URL("../../server/index.mjs", import.meta.url)),
    import(new URL("../../server/sign.mjs", import.meta.url)),
  ]);
  let projectReport = (report) => report;
  let servedPolicy = {
    digest: digest("outpocket/policy/1", context.policy),
    version: context.policy.version,
  };
  const signGate = createSignGate({ getServedPolicy: () => servedPolicy });
  const setReportAuthority = signGate.setReportAuthority.bind(signGate);
  signGate.setReportAuthority = (authority) => {
    setReportAuthority({
      ...authority,
      getLiveReport(reportId) {
        const report = authority.getLiveReport(reportId);
        return report ? projectReport(report) : report;
      },
    });
  };
  const server = createHttpServer({ secureCookies: false, signGate });
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object", "authority mutation server did not bind a TCP address");
  try {
    return await run({
      movePolicyDigest(nextDigest) {
        servedPolicy = { ...servedPolicy, digest: nextDigest };
      },
      origin: new URL(`http://127.0.0.1:${address.port}`),
      tamperReport() {
        projectReport = (report) => ({ ...report, title: `${report.title} changed after signature` });
      },
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function executeCommitWithoutAnswer(context) {
  const { origin } = context;
  const cookie = await loginNegative(origin, "chen");
  const controlReport = await createValidatedNegativeReport(origin, cookie, "commit control");
  const controlSign = await openNegativeSign(origin, cookie, controlReport.report.id);
  await answerNegativeSign(origin, cookie, controlSign);
  const controlBody = commitBody(controlSign, controlReport.report.id);
  const control = await commitNegativeSign(origin, cookie, controlSign, controlReport.report.id);
  assertHttp(control, 200, undefined, "N-15 well-formed commit control");

  const attackReport = await createValidatedNegativeReport(origin, cookie, "commit attack");
  const attackSign = await openNegativeSign(origin, cookie, attackReport.report.id);
  const attackBody = commitBody(attackSign, attackReport.report.id);
  assert.deepEqual(Object.keys(attackBody), Object.keys(controlBody), "N-15 control and attack commit body shapes differ");
  const failure = await commitNegativeSign(origin, cookie, attackSign, attackReport.report.id);
  return { failure, wellFormed: control };
}

async function executeRespondWithoutConfirmToken(context) {
  const { origin } = context;
  const cookie = await loginNegative(origin, "chen");
  const controlReport = await createValidatedNegativeReport(origin, cookie, "respond control");
  const controlSign = await openNegativeSign(origin, cookie, controlReport.report.id);
  const control = await answerNegativeSign(origin, cookie, controlSign);

  const attackReport = await createValidatedNegativeReport(origin, cookie, "respond attack");
  const attackSign = await openNegativeSign(origin, cookie, attackReport.report.id);
  const attackBody = signRespondBody(attackSign, "unused");
  delete attackBody.confirm_token;
  const controlWithoutToken = { ...control.body };
  delete controlWithoutToken.confirm_token;
  assert.deepEqual(
    Object.keys(attackBody),
    Object.keys(controlWithoutToken),
    "N-16 control and attack differ by more than confirm_token",
  );
  const failure = await requestJson(origin, `/api/sign/${attackSign.request_id}/respond`, {
    body: attackBody,
    cookie,
    method: "POST",
  });
  return { failure, wellFormed: control.response };
}

async function executeAuditorWrite(context) {
  const employee = await loginNegative(context.origin, "chen");
  const auditor = await loginNegative(context.origin, "ruiz");
  const body = { project: "FALCON", title: `E3 authz ${nextNegativeReportId("authz")}` };
  const control = await requestJson(context.origin, "/api/reports", { body, cookie: employee, method: "POST" });
  assertHttp(control, 201, undefined, "N-03 employee control");
  const failure = await requestJson(context.origin, "/api/reports", { body, cookie: auditor, method: "POST" });
  return { failure, wellFormed: control };
}

async function executeSnapshotMismatch(context) {
  const cookie = await loginNegative(context.origin, "chen");
  const controlReport = await createValidatedNegativeReport(context.origin, cookie, "snapshot control");
  const controlSign = await signedNegativeReport(
    context.origin,
    cookie,
    controlReport.report.id,
  );
  const control = await commitNegativeSign(
    context.origin,
    cookie,
    controlSign,
    controlReport.report.id,
  );
  assertHttp(control, 200, undefined, "N-05 matching snapshot control");

  const failure = await withAuthorityMutationServer(context, async ({ origin, tamperReport }) => {
    const attackCookie = await loginNegative(origin, "chen");
    const localControl = await createValidatedNegativeReport(origin, attackCookie, "snapshot local control");
    const localControlSign = await signedNegativeReport(origin, attackCookie, localControl.report.id);
    const localSuccess = await commitNegativeSign(origin, attackCookie, localControlSign, localControl.report.id);
    assertHttp(localSuccess, 200, undefined, "N-05 injected matching snapshot control");

    const attackReport = await createValidatedNegativeReport(origin, attackCookie, "snapshot attack");
    const attackSign = await signedNegativeReport(origin, attackCookie, attackReport.report.id);
    tamperReport();
    return commitNegativeSign(origin, attackCookie, attackSign, attackReport.report.id);
  });
  return { failure, wellFormed: control };
}

async function executeWriteDuringSign(context) {
  const cookie = await loginNegative(context.origin, "chen");
  const controlReport = await createValidatedNegativeReport(context.origin, cookie, "lock control");
  const patchBody = { amount_cents: 1300 };
  const control = await requestJson(context.origin, `/api/reports/${controlReport.report.id}/lines/${controlReport.line.id}`, {
    body: patchBody,
    cookie,
    method: "PATCH",
  });
  assertHttp(control, 200, undefined, "N-06 unlocked mutation control");

  const attackReport = await createValidatedNegativeReport(context.origin, cookie, "lock attack");
  await openNegativeSign(context.origin, cookie, attackReport.report.id);
  const failure = await requestJson(context.origin, `/api/reports/${attackReport.report.id}/lines/${attackReport.line.id}`, {
    body: patchBody,
    cookie,
    method: "PATCH",
  });
  return { failure, wellFormed: control };
}

function toolInState(expectedStates, stateId, toolName) {
  const state = expectedStates.find((candidate) => candidate.state_id === stateId);
  assert.ok(state, `unknown surface state ${stateId}`);
  return state.tool_names.includes(toolName);
}

function executeSurfaceAbsent(context, testCase) {
  const checks = testCase.surfaceChecks ?? [{
    attack: testCase.surfaceAttack,
    control: testCase.surfaceControl,
  }];
  for (const check of checks) {
    assert.equal(
      toolInState(context.expectedStates, check.control.state_id, check.control.tool),
      true,
      `${testCase.id}: well-formed ${check.control.state_id} control lacks ${check.control.tool}`,
    );
  }
  const presentAttacks = checks.filter((check) =>
    toolInState(context.expectedStates, check.attack.state_id, check.attack.tool)
  );
  return {
    failure: {
      error_code: null,
      mode: presentAttacks.length === 0 ? "tool_absent" : "tool_present",
      status: null,
      tool: testCase.expect.failure.tool,
    },
    wellFormed: { mode: "tool_present", status: null },
  };
}

function binaryChannelViolations(tools) {
  const violations = [];
  const bannedNames = new Set(["base64", "data", "file"]);
  function visit(value, path, toolName) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, toolName));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (bannedNames.has(key) || key === "contentEncoding" || (key === "format" && child === "byte")) {
        violations.push(`${toolName}:${path}.${key}`);
      }
      visit(child, `${path}.${key}`, toolName);
    }
  }
  for (const tool of tools) visit(tool.inputSchema, "$", tool.name);
  return violations;
}

function executeNoBinaryToolChannel(context) {
  const tools = context.exported.states.flatMap((state) => state.tools);
  const linkReceipt = tools.find((tool) => tool.name === "link_receipt");
  assert.ok(linkReceipt, "binary-channel control requires link_receipt on the real corpus");
  assert.equal(linkReceipt.inputSchema?.properties?.line_id?.type, "string");
  assert.equal(linkReceipt.inputSchema?.properties?.receipt_id?.type, "string");
  const violations = binaryChannelViolations(tools);
  return {
    failure: {
      error_code: null,
      mode: violations.length === 0 ? "tool_absent" : "tool_present",
      status: null,
      tool: "binary_upload_channel",
    },
    wellFormed: { mode: "receipt_id_channel", status: null },
  };
}

function executeViolationHistoryContract(context) {
  const artifactHistory = context.signatureContract.$defs?.artifact?.properties?.violation_history;
  assert.equal(artifactHistory?.type, "array", "artifact contract lost violation_history");
  assert.match(artifactHistory.description, /CAP_TRANSPORT/);
  const hasCapTransport = context.violationContract.examples?.some((example) => example.code === "CAP_TRANSPORT");
  assert.equal(hasCapTransport, true, "real violation corpus lost CAP_TRANSPORT");
  return { pass: true, wellFormed: { mode: "real_corpus", status: null } };
}

async function executePolicyContentSwap(context) {
  const cookie = await loginNegative(context.origin, "chen");
  const controlReport = await createValidatedNegativeReport(context.origin, cookie, "policy control");
  const controlSign = await signedNegativeReport(
    context.origin,
    cookie,
    controlReport.report.id,
  );
  const control = await commitNegativeSign(
    context.origin,
    cookie,
    controlSign,
    controlReport.report.id,
  );
  assertHttp(control, 200, undefined, "N-20 pinned-policy control");

  const trapDigest = "sha256:17bc4b2d1031b63e07a3983b067c8485316e8c16b53454e481680f65b7962e92";
  const failure = await withAuthorityMutationServer(context, async ({ movePolicyDigest, origin }) => {
    const attackCookie = await loginNegative(origin, "chen");
    const localControl = await createValidatedNegativeReport(origin, attackCookie, "policy local control");
    const localControlSign = await signedNegativeReport(origin, attackCookie, localControl.report.id);
    const localSuccess = await commitNegativeSign(origin, attackCookie, localControlSign, localControl.report.id);
    assertHttp(localSuccess, 200, undefined, "N-20 injected pinned-policy control");

    const attackReport = await createValidatedNegativeReport(origin, attackCookie, "policy attack");
    const attackSign = await signedNegativeReport(origin, attackCookie, attackReport.report.id);
    movePolicyDigest(trapDigest);
    return commitNegativeSign(origin, attackCookie, attackSign, attackReport.report.id);
  });
  return { failure, wellFormed: control };
}

async function executeDeclineToUnlock(context) {
  const cookie = await loginNegative(context.origin, "chen");
  const controlReport = await createValidatedNegativeReport(context.origin, cookie, "decline control");
  const controlSign = await openNegativeSign(context.origin, cookie, controlReport.report.id);
  const control = await answerNegativeSign(context.origin, cookie, controlSign);

  const attackReport = await createValidatedNegativeReport(context.origin, cookie, "decline attack");
  const attackSign = await openNegativeSign(context.origin, cookie, attackReport.report.id);
  const token = await confirmToken(context.origin, cookie, attackSign.request_id);
  const declinedBody = signRespondBody(attackSign, token, "declined");
  const declined = await requestJson(context.origin, `/api/sign/${attackSign.request_id}/respond`, {
    body: declinedBody,
    cookie,
    method: "POST",
  });
  assertHttp(declined, 200, undefined, "N-21 attacker decline prerequisite");
  const signedBody = signRespondBody(attackSign, token);
  assert.deepEqual(Object.keys(signedBody), Object.keys(declinedBody), "N-21 respond body shapes differ");
  const failure = await requestJson(context.origin, `/api/sign/${attackSign.request_id}/respond`, {
    body: signedBody,
    cookie,
    method: "POST",
  });
  const secondary = await commitNegativeSign(
    context.origin,
    cookie,
    attackSign,
    attackReport.report.id,
  );
  return { failure, secondary, wellFormed: control.response };
}

const NEGATIVE_SCENARIOS = new Map([
  ["auditor_write", executeAuditorWrite],
  ["commit_without_answer", executeCommitWithoutAnswer],
  ["decline_to_unlock", executeDeclineToUnlock],
  ["no_binary_tool_channel", executeNoBinaryToolChannel],
  ["policy_content_swap", executePolicyContentSwap],
  ["respond_without_confirm_token", executeRespondWithoutConfirmToken],
  ["snapshot_mismatch", executeSnapshotMismatch],
  ["surface_absent", executeSurfaceAbsent],
  ["violation_history_contract", executeViolationHistoryContract],
  ["write_during_sign", executeWriteDuringSign],
]);

function gradeNegativeCase(testCase, observed) {
  assert.ok(observed?.wellFormed, `${testCase.id}: well-formed control was not proved`);
  if (Number.isInteger(testCase.wellFormed.http_status)) {
    assert.equal(
      observed.wellFormed.status,
      testCase.wellFormed.http_status,
      `${testCase.id}: well-formed control did not return its exact status`,
    );
  } else if (testCase.wellFormed.mode) {
    assert.equal(observed.wellFormed.mode, testCase.wellFormed.mode, `${testCase.id}: positive control failed`);
  }

  if (testCase.expect.outcome === "pass") {
    assert.equal(observed.pass, true, `${testCase.id}: positive case did not pass`);
    return;
  }
  const expected = testCase.expect.failure;
  if (expected.mode === "server_rejects") {
    assertHttp(observed.failure, expected.http_status, expected.error_code, testCase.id);
  } else {
    assert.equal(observed.failure.mode, expected.mode, `${testCase.id}: wrong failure mode`);
    assert.equal(observed.failure.tool, expected.tool, `${testCase.id}: wrong absent tool`);
  }
  if (testCase.expect.secondary) {
    assertHttp(
      observed.secondary,
      testCase.expect.secondary.http_status,
      testCase.expect.secondary.error_code,
      `${testCase.id} secondary outcome`,
    );
  }
}

async function loadNegativeMutants(suite) {
  const targetCases = suite.cases.filter((testCase) =>
    testCase.expect.outcome === "required_failure" && testCase.controlStatus === "enforced"
  );
  const directoryUrl = new URL("evals/mutants/", repositoryUrl);
  const filenames = (await readdir(directoryUrl))
    .filter((filename) => filename.endsWith(".json"))
    .sort();
  const expectedFilenames = targetCases.map((testCase) => `${testCase.id}.json`).sort();
  assert.deepEqual(
    filenames,
    expectedFilenames,
    "evals/mutants must contain exactly one JSON mutant for every enforced must-fail case",
  );

  const mutants = new Map();
  for (const testCase of targetCases) {
    const filename = `${testCase.id}.json`;
    const mutant = JSON.parse(await readFile(new URL(filename, directoryUrl), "utf8"));
    assert.equal(mutant.schema, "outpocket.negative_mutant/1", `${testCase.id}: mutant schema mismatch`);
    assert.equal(mutant.case_id, testCase.id, `${testCase.id}: mutant names the wrong case`);
    assert.equal(
      mutant.brokenBy,
      testCase.brokenBy,
      `${testCase.id}: mutant does not apply the case's declared brokenBy`,
    );
    assert.ok(mutant.operation && typeof mutant.operation === "object", `${testCase.id}: mutant has no operation`);
    const kind = mutant.operation.kind;
    assert.ok(
      ["add_binary_input", "expose_tools", "permit_response"].includes(kind),
      `${testCase.id}: unknown mutant operation ${kind}`,
    );
    if (kind === "permit_response") {
      assert.equal(testCase.expect.failure.mode, "server_rejects", `${testCase.id}: response mutant targets a non-server case`);
      assert.ok(
        Number.isInteger(mutant.operation.status)
          && mutant.operation.status >= 200
          && mutant.operation.status < 300,
        `${testCase.id}: response mutant must declare a permitted HTTP status`,
      );
    } else {
      assert.equal(testCase.expect.failure.mode, "tool_absent", `${testCase.id}: corpus mutant targets a server case`);
    }
    mutants.set(testCase.id, { ...mutant, filename: `evals/mutants/${filename}` });
  }
  return mutants;
}

function applyNegativeMutant(context, testCase, mutant) {
  const mutatedContext = {
    ...context,
    expectedStates: structuredClone(context.expectedStates),
    exported: structuredClone(context.exported),
  };
  const operation = mutant.operation;

  if (operation.kind === "expose_tools") {
    assert.ok(Array.isArray(operation.tools) && operation.tools.length > 0, `${testCase.id}: expose_tools is empty`);
    for (const addition of operation.tools) {
      const state = mutatedContext.expectedStates.find((candidate) => candidate.state_id === addition.state_id);
      assert.ok(state, `${testCase.id}: mutant names unknown state ${addition.state_id}`);
      assert.equal(typeof addition.tool, "string", `${testCase.id}: mutant tool must be a string`);
      assert.ok(!state.tool_names.includes(addition.tool), `${testCase.id}: mutant tool ${addition.tool} is already exposed`);
      state.tool_names.push(addition.tool);
    }
  } else if (operation.kind === "add_binary_input") {
    const state = mutatedContext.exported.states.find((candidate) => candidate.state_id === operation.state_id);
    assert.ok(state, `${testCase.id}: mutant names unknown state ${operation.state_id}`);
    const tool = state.tools.find((candidate) => candidate.name === operation.tool);
    assert.ok(tool, `${testCase.id}: mutant names unknown tool ${operation.tool}`);
    assert.equal(typeof operation.property, "string", `${testCase.id}: mutant property must be a string`);
    tool.inputSchema.properties ??= {};
    assert.ok(
      !Object.hasOwn(tool.inputSchema.properties, operation.property),
      `${testCase.id}: mutant property ${operation.property} already exists`,
    );
    tool.inputSchema.properties[operation.property] = { contentEncoding: "base64", type: "string" };
  }

  return mutatedContext;
}

function applyNegativeResponseMutant(testCase, mutant, observed) {
  const operation = mutant.operation;
  if (operation.kind !== "permit_response") return observed;
  assertHttp(
    observed.failure,
    testCase.expect.failure.http_status,
    testCase.expect.failure.error_code,
    `${testCase.id} pre-mutation refusal`,
  );
  const mutated = {
    ...observed,
    failure: { body: { mutation: mutant.brokenBy }, status: operation.status },
  };
  if (operation.secondary_status !== undefined) {
    assert.ok(
      Number.isInteger(operation.secondary_status)
        && operation.secondary_status >= 200
        && operation.secondary_status < 300,
      `${testCase.id}: response mutant secondary status must be permitted`,
    );
    mutated.secondary = { body: { mutation: mutant.brokenBy }, status: operation.secondary_status };
  }
  return mutated;
}

function assertNegativeMutationPermitted(testCase, mutant, observed) {
  assert.throws(
    () => gradeNegativeCase(testCase, observed),
    undefined,
    `${testCase.id}: the original refusal detector survived its declared mutation`,
  );
  if (mutant.operation.kind === "permit_response") {
    assert.ok(
      observed.failure.status >= 200 && observed.failure.status < 300,
      `${testCase.id}: mutation did not permit the refused request`,
    );
    if (mutant.operation.secondary_status !== undefined) {
      assert.equal(
        observed.secondary.status,
        mutant.operation.secondary_status,
        `${testCase.id}: mutation did not apply its secondary outcome`,
      );
    }
  } else {
    assert.equal(observed.failure.mode, "tool_present", `${testCase.id}: mutation did not expose the forbidden tool`);
  }
}

async function executeNegativeCase(context, testCase, mutant) {
  const execute = NEGATIVE_SCENARIOS.get(testCase.scenario);
  assert.ok(execute, `${testCase.id}: unknown negative scenario ${testCase.scenario}`);
  const executionContext = mutant ? applyNegativeMutant(context, testCase, mutant) : context;
  const observed = await execute(executionContext, testCase);
  return mutant ? applyNegativeResponseMutant(testCase, mutant, observed) : observed;
}

async function verifyNegativeControls(suite, context) {
  const mutants = await loadNegativeMutants(suite);
  const rows = [];

  for (const testCase of suite.cases) {
    const row = {
      baseline: testCase.expect.outcome === "required_failure" ? "refused" : "passed",
      brokenBy: testCase.brokenBy,
      id: testCase.id,
      provingNode: testCase.provingNode,
    };
    const mutant = mutants.get(testCase.id);
    if (!mutant) {
      rows.push({ ...row, flipped: null, mutant: "not-applicable", mutant_file: null });
      continue;
    }

    try {
      const observed = await executeNegativeCase(context, testCase, mutant);
      assertNegativeMutationPermitted(testCase, mutant, observed);
      rows.push({ ...row, flipped: true, mutant: "permitted", mutant_file: mutant.filename });
      process.stdout.write(`${testCase.id}: refused -> permitted under ${testCase.brokenBy}\n`);
    } catch (error) {
      rows.push({
        ...row,
        error: error.message,
        flipped: false,
        mutant: "did-not-permit",
        mutant_file: mutant.filename,
      });
      process.stderr.write(`${testCase.id}: MUTATION FAIL: ${error.message}\n`);
    }
  }

  const targetRows = rows.filter((row) => row.flipped !== null);
  const report = {
    cases: rows,
    declared_case_count: suite.declared_case_count,
    flipped_count: targetRows.filter((row) => row.flipped).length,
    must_fail_count: targetRows.length,
    row_count: rows.length,
    schema: "outpocket.mutation_report/1",
    suite: "negative",
  };
  await writeFile(
    new URL("evals/mutation-report.json", repositoryUrl),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  assert.equal(rows.length, suite.declared_case_count, "mutation report must contain one row per case");
  const failures = targetRows.filter((row) => !row.flipped);
  assert.deepEqual(failures, [], `${failures.length} negative control mutation(s) did not flip`);
  process.stdout.write(
    `mutation: ${targetRows.length} of ${targetRows.length} must-fail controls flipped; `
    + `${rows.length} report rows written to evals/mutation-report.json\n`,
  );
}

function proveNegativeDetector(suite, expectedStates, requiredCaseIds, exported) {
  const pairings = validateNegativeSuite(suite, expectedStates, requiredCaseIds);

  const wrongStatus = structuredClone(negativeCaseById(suite, "neg-commit-without-human"));
  assert.throws(
    () => gradeNegativeCase(wrongStatus, {
      failure: { body: { error: "E_BAD_REQUEST" }, status: 400 },
      wellFormed: { status: 200 },
    }),
    /expected HTTP 409, got 400/,
    "exact-refusal detector must reject a masking validation error",
  );

  const shortSuite = structuredClone(suite);
  shortSuite.cases.pop();
  assert.throws(
    () => validateNegativeSuite(shortSuite, expectedStates, requiredCaseIds),
    /graded 10 of 11 declared cases; run graded fewer than declared/,
    "declared-count detector must reject a shortened run",
  );

  const emptyPairSuite = structuredClone(suite);
  for (const testCase of emptyPairSuite.cases) {
    testCase.pairsWith = testCase.pairsWith.filter((pair) => pair !== "S0-anon");
  }
  assert.throws(
    () => validateNegativeSuite(emptyPairSuite, expectedStates, requiredCaseIds),
    /empty state\(s\): S0-anon/,
    "pairing detector must reject an empty state pairing",
  );

  const realTools = exported.states.flatMap((state) => state.tools);
  assert.deepEqual(binaryChannelViolations(realTools), [], "binary detector rejected the real corpus");
  const brokenTools = structuredClone(realTools);
  brokenTools[0].inputSchema.properties.file = { contentEncoding: "base64", type: "string" };
  assert.ok(binaryChannelViolations(brokenTools).length > 0, "binary detector accepted a broken corpus");

  return pairings;
}

async function runNegativeSuite(url, verifyControls = false) {
  const locations = [
    new URL("evals/suites/negative.suite.json", repositoryUrl),
    new URL("evals/surfaces.expected.json", repositoryUrl),
    new URL("artifacts/tools.export.json", repositoryUrl),
    new URL("erp/contracts/eval-case.schema.json", repositoryUrl),
    new URL("erp/contracts/signature.schema.json", repositoryUrl),
    new URL("erp/contracts/violation.schema.json", repositoryUrl),
  ];
  const [suite, expected, exported, evalContract, signatureContract, violationContract] = await Promise.all(
    locations.map(async (location) => JSON.parse(await readFile(location, "utf8"))),
  );
  const runtimeExpected = expectedSurfacesFromExport(exported);
  assert.deepEqual(expected, runtimeExpected, "negative detector rejected the real surface corpus");
  const requiredCaseIds = evalContract["x-requiredCases"]?.negative_control;
  assert.ok(Array.isArray(requiredCaseIds), "eval case contract has no negative_control declaration");
  const pairings = proveNegativeDetector(suite, expected.states, requiredCaseIds, exported);
  process.stdout.write(`negative: declared case count=${suite.declared_case_count}; real corpus accepted by detector controls\n`);
  for (const [stateId, pairedCases] of pairings) {
    process.stdout.write(`${stateId}: paired by pairsWith -> ${pairedCases.join(", ")}\n`);
  }
  const policyResponse = await requestJson(url, "/api/policy");
  assertHttp(policyResponse, 200, undefined, "served policy positive control");
  assert.equal(
    digest("outpocket/policy/1", policyResponse.body),
    expected.source.policy_digest,
    "served policy digest drifted from the real expected-surface corpus",
  );
  const context = {
    expectedStates: expected.states,
    exported,
    origin: new URL(url),
    policy: policyResponse.body,
    signatureContract,
    violationContract,
  };
  const results = [];

  for (const testCase of suite.cases) {
    try {
      const observed = await executeNegativeCase(context, testCase);
      gradeNegativeCase(testCase, observed);
      results.push({ id: testCase.id, verdict: "pass" });
      const label = testCase.controlId ? `${testCase.controlId} ${testCase.id}` : testCase.id;
      process.stdout.write(`${label}: ${testCase.controlStatus}\n`);
    } catch (error) {
      results.push({ error: error.message, id: testCase.id, verdict: "fail" });
      const label = testCase.controlId ? `${testCase.controlId} ${testCase.id}` : testCase.id;
      process.stderr.write(`${label}: FAIL: ${error.message}\n`);
    }
  }

  assert.equal(
    results.length,
    suite.declared_case_count,
    `negative graded ${results.length} of ${suite.declared_case_count} declared cases; run graded fewer than declared`,
  );
  process.stdout.write(`negative: graded case count=${results.length} of declared ${suite.declared_case_count}\n`);
  const failures = results.filter((result) => result.verdict === "fail");
  assert.deepEqual(failures, [], `${failures.length} negative case(s) failed grading`);
  process.stdout.write(
    `negative: ${results.length} of ${suite.declared_case_count} declared cases graded; `
    + `${results.length} passed; zero cases skipped; detector controls accepted real corpus and rejected broken fixtures\n`,
  );
  if (verifyControls) await verifyNegativeControls(suite, context);
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
    } else if (suite === "capability") {
      await runCapabilitySuite(options.url);
    } else if (suite === "negative") {
      await runNegativeSuite(options.url, options.verifyControls);
    } else {
      await runDeferredSuite(suite);
    }
  }
}

function usage() {
  process.stderr.write(
    "usage: webmcp-eval (--version | --selftest | run --suite negative --verify-controls [--url <origin>] | --suite <capability|negative> [--suite <capability|negative>] --url <origin> | --suite accounting)\n",
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
  if (argv.length === 2 && argv[0] === CAPABILITY_CONTROL_FLAG) {
    try {
      capabilityControlFixture(argv[1]);
    } catch (error) {
      process.stderr.write(`webmcp-eval: ${error.message}\n`);
      process.exitCode = 1;
    }
    return;
  }

  try {
    const options = parseArgs(argv);
    if (options.suites[0] === "accounting" && !networkDenialIsArmed()) {
      if (process.env[NETWORK_DENIAL_CHILD] === "1") {
        throw new Error(
          `network denial preload did not arm on Node ${process.version}; `
          + "dns.lookup and net.Socket.prototype.connect must both throw E_NETWORK_DISABLED",
        );
      }
      process.exitCode = runAccountingWithNetworkDenial(argv);
      return;
    }
    await runSuites(options);
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
