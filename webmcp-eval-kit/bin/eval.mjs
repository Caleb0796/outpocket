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

async function runCapabilityAction(context, action) {
  const { cdp, frameId, sessionId, variables } = context;
  if (action.type === "click") {
    await clickSelector(cdp, sessionId, action.selector);
    return;
  }
  if (action.type === "install_signature_provider") {
    const installed = await evaluateInPage(cdp, sessionId, `(() => {
      const registry = globalThis.outpocketTools;
      if (typeof registry?.setSignatureProvider !== "function") return false;
      globalThis.__capabilitySignatureUndo = registry.setSignatureProvider(
        async () => ({ signed: true, reason: null })
      );
      return true;
    })()`);
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
