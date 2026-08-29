#!/usr/bin/env node
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { canon, digest } from "../src/canon.mjs";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

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

    process.stdout.write(
      `selftest ok: tool_count=${firstResult.tool_count} byte_identical=true\n`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function usage() {
  process.stderr.write("usage: webmcp-eval (--version | --selftest)\n");
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

  usage();
  process.exitCode = 2;
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);

if (isMain) {
  await main(process.argv.slice(2));
}
