// tests/acceptance/inspector.test.mjs — node F5 (lane F, owner UX).
//
// THE PREDICATE IS AN EQUALITY BETWEEN TWO INDEPENDENTLY COMPUTED THINGS, which
// is what makes it hard to satisfy dishonestly: a panel that rendered NOTHING
// fails it, and so does one that rendered EVERYTHING. The one way it still goes
// hollow is if both sides come from the same place — so the row count is read
// by walking the RENDERED DOM and the tool count is read from
// `document.modelContext.getTools()`, and neither is derived from the other.
//
// THAT IS WHY THIS TEST DRIVES A REAL BROWSER. `document.modelContext` does not
// exist in Node. A fake one would mean I supply both sides of the equality and
// the assertion becomes a statement about my own fixture. Chrome is launched
// headless through tools/chrome.mjs, so the launch carries its scenario label,
// and the page under test is the SERVED page.
//
// AND getTools() RETURNS A PROMISE (erp/FACTS.md IR-18). Un-awaited, `.length`
// is `undefined`, which equals no count and reads as "the surface is empty"
// rather than as a bug. Both sides are awaited and the raw values are printed
// on failure so a zero-vs-undefined mixup is visible rather than inferred.
//
// A NOTE ON THE STATE LABELS IN THE PREDICATE. F5.accept names the four
// employee states "S1-emp-home, S2-emp-draft-clean, S3-emp-draft-dirty,
// S4-emp-submitted". src/page/register.js and the frozen tool-surface contract
// have S2 as the DIRTY draft and S3 as the CLEAN one — the two middle labels
// are transposed relative to the canonical ids. The ids are what
// surfaceState() returns and what the contract freezes, so this file drives and
// asserts on S1/S2/S3/S4 as compile.js defines them, and reports the state id
// it observed. Reported to L1 rather than silently reconciled.

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── the served page ─────────────────────────────────────────────────────────

async function serveApp() {
  const { createHttpServer } = await import(resolve(REPO, "server", "index.mjs"));
  const server = createHttpServer();
  await new Promise((res, rej) => { server.once("error", rej); server.listen(0, "127.0.0.1", res); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

function chromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(`no Chrome found; set CHROME_BIN. Tried: ${candidates.join(", ")}`);
}

async function launchChrome() {
  const { flagsFor } = await import(resolve(REPO, "tools", "chrome.mjs"));
  const profile = join(tmpdir(), `outpocket-inspector-${process.pid}-${Date.now()}`);
  const flags = flagsFor("cdp", { headless: true, port: 0, userDataDir: profile });
  const proc = spawn(chromeBinary(), flags, { stdio: ["ignore", "ignore", "pipe"] });

  const wsUrl = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("Chrome did not announce a DevTools endpoint")), 20000);
    let buf = "";
    proc.stderr.on("data", (d) => {
      buf += d.toString();
      const m = /ws:\/\/[^\s]+/.exec(buf);
      if (m) { clearTimeout(t); res(m[0]); }
    });
    proc.once("exit", (c) => { clearTimeout(t); rej(new Error(`Chrome exited early (${c})`)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("CDP socket failed")); });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    const ex = r.result?.exceptionDetails;
    if (ex) throw new Error(ex.exception?.description ?? ex.text ?? "evaluate failed");
    return r.result?.result?.value;
  };
  const goto = async (url) => {
    await send("Page.navigate", { url }, sessionId);
    for (let i = 0; i < 200; i++) {
      if (await evaluate("document.readyState === 'complete'").catch(() => false)) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await evaluate("new Promise(r => setTimeout(r, 300))");
  };
  return {
    evaluate, goto,
    close: async () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); try { rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
}

// ── driving the four employee states ────────────────────────────────────────
//
// Each step goes through the page's own affordances or the page's own ERP, and
// then waits for the inspector to repaint. The state id is READ BACK from
// surfaceState() rather than assumed, so a step that failed to move the machine
// is caught here instead of producing a confident comparison of the wrong state.

const DRIVE = {
  S1: `(async () => {
    document.querySelector('[data-login="chen"]').click();
    await new Promise(r => setTimeout(r, 500));
  })()`,
  S2: `(async () => {
    const t = globalThis.outpocketTools;
    await t.executeTool('create_expense_report',
      { title: 'Boston client workshop', project: 'FALCON' }, { source: 'agent' });
    await new Promise(r => setTimeout(r, 350));
  })()`,
  S3: `(async () => {
    const t = globalThis.outpocketTools;
    await t.executeTool('add_expense_line', {
      date: '2026-08-20', merchant: 'Blue Bottle', category: 'meals',
      amount: 12.00, currency: 'USD', attendees: 1, description: 'Coffee with the client',
    }, { source: 'agent' });
    await new Promise(r => setTimeout(r, 350));
  })()`,
  S4: `(async () => {
    // Reaching "submitted" needs a signature, and the signature path is S5's
    // gate plus F7's provider — neither is what THIS node asserts. So the state
    // is set through the page's own ERP rather than driven through the sign
    // flow: this is fixture setup for a surface comparison, and dressing it up
    // as a signing test would prove neither thing well.
    const erp = globalThis.outpocketTools.erp;
    erp.submitOpenReport({ signedBy: 'Chen Xiao', method: 'signature-click' }, 'human');
    globalThis.outpocketTools.refresh('test: forced to submitted');
    await new Promise(r => setTimeout(r, 350));
  })()`,
};

/** Read both sides, INDEPENDENTLY. Rows from the DOM, tools from the browser API. */
const READ_BOTH = `(async () => {
  const rows = document.querySelectorAll('#surface-inspector [data-tool-row]');
  const region = document.querySelector('[data-region="surface"]');
  const mc = document.modelContext;
  const tools = mc && typeof mc.getTools === 'function' ? await mc.getTools() : null;
  return {
    rowCount: rows.length,
    rowNames: [...rows].map(r => r.getAttribute('data-tool-row')),
    toolCount: tools === null ? null : tools.length,
    toolNames: tools === null ? null : tools.map(t => t.name),
    modelContextPresent: typeof mc,
    state: globalThis.outpocketTools?.state?.() ?? null,
    chip: document.querySelector('[data-policy-version]')?.getAttribute('data-policy-version') ?? null,
    chipText: document.querySelector('[data-policy-version]')?.textContent ?? null,
    source: document.querySelector('[data-surface-source]')?.getAttribute('data-surface-source') ?? null,
    regionHidden: region?.hidden ?? null,
    regionDisplay: region ? getComputedStyle(region).display : null,
  };
})()`;

let app, page;
test.before(async () => { app = await serveApp(); page = await launchChrome(); });
test.after(async () => { await page?.close(); await app?.close(); });

test("the signed-out surface is visible with two rows, then tracks all four employee states", async () => {
  await page.goto(app.origin + "/");

  // S0 is the explanation for why signing in changes the available work. It
  // must be visible before the persona choice, and its two rendered rows must
  // still be an independent match for the browser's two exposed tools.
  const signedOut = await page.evaluate(READ_BOTH);
  assert.equal(signedOut.state, "S0");
  assert.equal(signedOut.rowCount, 2, `signed out rendered ${signedOut.rowCount} tool rows instead of 2`);
  assert.equal(signedOut.toolCount, 2, `signed out exposed ${signedOut.toolCount} tools instead of 2`);
  assert.deepEqual([...signedOut.rowNames].sort(), [...signedOut.toolNames].sort());
  assert.equal(signedOut.regionHidden, false, "the signed-out surface region still has its hidden attribute active");
  assert.notEqual(signedOut.regionDisplay, "none", "the signed-out surface region computes to display:none");

  const seen = [];
  for (const id of ["S1", "S2", "S3", "S4"]) {
    await page.evaluate(DRIVE[id]);
    const r = await page.evaluate(READ_BOTH);
    seen.push({ want: id, ...r });

    // The surface must actually be visible to the browser at all. Without this
    // a null toolCount would compare against a zero rowCount somewhere below and
    // "both empty" would read as agreement.
    assert.equal(r.modelContextPresent, "object",
      `document.modelContext is ${r.modelContextPresent} — the browser exposes no surface, so there is nothing to compare against`);
    assert.notEqual(r.toolCount, null, "getTools() returned null");
    assert.ok(Number.isInteger(r.toolCount),
      `getTools().length is ${r.toolCount} — an un-awaited Promise yields undefined here (IR-18)`);

    // The state actually moved. A step that silently failed would otherwise
    // produce a perfectly true comparison of the wrong state, four times.
    assert.equal(r.state, id, `expected surface state ${id}, got ${r.state}`);

    // THE EQUALITY. Two independent reads: DOM walk vs browser API.
    assert.equal(r.rowCount, r.toolCount,
      `${id}: ${r.rowCount} rendered row(s) vs ${r.toolCount} tool(s) on the surface\n` +
      `  rows:  ${JSON.stringify(r.rowNames)}\n  tools: ${JSON.stringify(r.toolNames)}`);

    // and it is not vacuously true of an empty surface
    assert.ok(r.toolCount > 0, `${id}: the surface is empty, so the equality proves nothing`);

    // the rows are the SAME tools, not merely the same number of them
    assert.deepEqual([...r.rowNames].sort(), [...r.toolNames].sort(),
      `${id}: the row count matches but the names do not`);
  }

  // The four states must not all be the same surface, or one comparison has
  // been made four times and reported as four.
  const counts = seen.map((s) => s.toolCount);
  assert.ok(new Set(counts).size > 1,
    `all four states reported the same tool count (${counts.join(", ")}) — the machine did not move`);
  process.stdout.write(`# surface sizes S1..S4: ${counts.join(", ")}\n`);
});

test("the version chip text equals the value from GET /api/policy, and neither is empty", async () => {
  await page.goto(app.origin + "/");
  await page.evaluate(DRIVE.S1);

  // The server's own answer, fetched independently of the page.
  const res = await fetch(`${app.origin}/api/policy`);
  assert.equal(res.status, 200);
  const served = (await res.json()).version;

  // THE NON-EMPTY GUARD, AND IT IS NOT CEREMONY. Without it, a silent endpoint
  // and a blank chip compare equal and the test passes having proved that both
  // are silent — D-90 applied to this node, and the failure would look exactly
  // like a pass.
  assert.ok(typeof served === "string" && served.length > 0,
    `GET /api/policy returned no version (${JSON.stringify(served)})`);

  const r = await page.evaluate(READ_BOTH);
  assert.ok(r.chip && r.chip.length > 0,
    "the page rendered no policy version chip — [data-policy-version] is absent or empty");
  assert.equal(r.chip, served, `chip "${r.chip}" != served "${served}"`);
  assert.ok(r.chipText.includes(served), `the chip's visible text does not contain ${served}`);
});

test("the inspector reads the BROWSER's surface, not our own registry", async () => {
  // The panel's claim is "this is what the agent can see". Reading our registry
  // would make that true by construction; reading document.modelContext makes
  // it an observation. The rendered source is asserted so a silent fallback
  // cannot pass as the real thing.
  await page.goto(app.origin + "/");
  await page.evaluate(DRIVE.S1);
  const r = await page.evaluate(READ_BOTH);
  assert.equal(r.source, "document.modelContext",
    `the inspector fell back to ${JSON.stringify(r.source)} — it is not showing what the browser holds`);
});

test("the served S5 view explains auditor limits and changes the human receipt card", async () => {
  await page.goto(app.origin + "/");
  await page.evaluate(`(async () => {
    document.querySelector('[data-login="ruiz"]').click();
    await new Promise(r => setTimeout(r, 500));
  })()`);
  const view = await page.evaluate(`(() => {
    const state = document.querySelector('[data-surface-state]');
    const human = document.querySelector('[data-channel="human"]');
    const agent = document.querySelector('[data-channel="agent"]');
    const purposes = [...document.querySelectorAll('#surface-inspector .tool-purpose')];
    return {
      state: state?.getAttribute('data-surface-state'),
      stateTitle: state?.getAttribute('title'),
      stateText: state?.textContent,
      summary: document.querySelector('#surface-inspector .auditor-summary')?.textContent,
      receiptHeading: document.querySelector('[data-receipt-channel] .channel-heading')?.textContent,
      humanCan: human?.querySelector('.channel-can')?.textContent,
      humanDetail: human?.querySelector('.channel-detail')?.textContent,
      agentCan: agent?.querySelector('.channel-can')?.textContent,
      agentDetail: agent?.querySelector('.channel-detail')?.textContent,
      enforcement: document.querySelector('[data-receipt-enforcement]')?.textContent,
      source: document.querySelector('[data-surface-source]')?.textContent,
      purposes: purposes.map((node) => ({
        text: node.textContent,
        whiteSpace: getComputedStyle(node).whiteSpace,
        overflow: getComputedStyle(node).overflow,
        textOverflow: getComputedStyle(node).textOverflow,
      })),
    };
  })()`);

  assert.deepEqual([view.state, view.stateTitle, view.stateText], ["S5", "S5", "Auditor · read-only"]);
  assert.equal(view.summary,
    "Auditor view — read only. You can review reports and receipt metadata, and ask your agent to check the tamper-evident day book and its verification result. No filing, editing, signing, or submission tools are available.");
  assert.equal(view.receiptHeading, "Receipts — you attach; agents only link");
  assert.equal(view.humanCan, "Review receipt metadata");
  assert.equal(view.humanDetail, "This auditor view cannot attach files.");
  assert.equal(view.agentCan, "An agent can only link an existing receipt ID from list_receipts.");
  assert.equal(view.agentDetail, "No registered tool accepts file content.");
  assert.equal(view.enforcement,
    "Enforced by this page: every workflow state is checked to ensure no registered tool accepts file content.");
  assert.equal(view.source, "Published by this page through WebMCP");
  assert.ok(view.purposes.length > 0);
  assert.ok(view.purposes.every((purpose) => purpose.text && purpose.whiteSpace === "nowrap" &&
    purpose.overflow === "hidden" && purpose.textOverflow === "ellipsis"));

  const employee = await page.evaluate(`(async () => {
    document.querySelector('[data-login="chen"]').click();
    await new Promise(r => setTimeout(r, 500));
    const human = document.querySelector('[data-channel="human"]');
    return {
      can: human?.querySelector('.channel-can')?.textContent,
      detail: human?.querySelector('.channel-detail')?.textContent,
    };
  })()`);
  assert.equal(employee.can, "Choose a file here.");
  assert.equal(employee.detail,
    "The page sends its name, size, and SHA-256 digest—not the file bytes—to the server so duplicates can be detected.");
});

// ── the simulated branch ────────────────────────────────────────────────────
//
// THE BROWSER TESTS ABOVE CANNOT REACH THIS BRANCH, AND THAT IS WHY IT NEEDS
// ITS OWN TEST. They launch with --enable-features=WebMCP, so the real API is
// present, H3's shim correctly declines to shadow it, and __simulated is
// undefined — the source is genuinely "document.modelContext". But the DEMO
// runs on a browser without the flag, where the shim installs and every row in
// this panel comes from a simulation. That is the configuration a judge sees,
// and until now it was the configuration nothing tested.
//
// Same shape as F7's browserDialogPort: the environment that makes the test
// convenient is not the environment that ships.

import { readSurface, renderInspector, SOURCE } from "../../src/page/ui/inspector.js";

function fakeInspectorDocument() {
  return {
    createElement: (tag) => ({
      tagName: tag, attributes: new Map(), children: [], _text: "",
      setAttribute(k, v) { this.attributes.set(k, String(v)); },
      getAttribute(k) { return this.attributes.get(k) ?? null; },
      appendChild(c) { this.children.push(c); return c; },
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text; },
    }),
  };
}

function findNode(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function withAttr(name, value = undefined) {
  return (node) => node.attributes?.has(name) &&
    (value === undefined || node.attributes.get(name) === value);
}

test("readSurface reports a SIMULATED surface as simulated, not as the browser's own", async () => {
  const tools = [{ name: "get_session_scope", annotations: { readOnlyHint: true } }];

  const real = await readSurface({ doc: { modelContext: { getTools: async () => tools } } });
  assert.equal(real.source, SOURCE.BROWSER);
  assert.equal(real.simulated, false);

  const shim = await readSurface({
    doc: { modelContext: { __simulated: true, getTools: async () => tools } },
  });
  assert.equal(shim.simulated, true);
  assert.equal(shim.source, SOURCE.SIMULATED);
  assert.match(shim.source, /simulated/i,
    "a page driving its own tools must not report them as the browser's");
  assert.notEqual(shim.source, SOURCE.BROWSER);

  // and the rows are the same either way — the marker changes the PROVENANCE
  // claim, not the surface. Reporting fewer tools under the shim would be a
  // different bug wearing this fix as a disguise.
  assert.deepEqual(real.tools, shim.tools);
});

test("the rendered panel carries the simulated provenance where a judge can read it", () => {
  const doc = fakeInspectorDocument();
  const root = renderInspector(doc, { tools: [], source: SOURCE.SIMULATED, policyVersion: "2026-08.1" });
  assert.match(root.textContent, /simulated/i,
    "the provenance line must be visible text, not only an attribute — a judge reads the page, not the DOM");
});

test("the inspector uses first-glance copy while retaining S0–S5 in attributes and tool names", () => {
  const labels = {
    S0: "Signed out",
    S1: "Employee · no report open",
    S2: "Employee · draft needs attention",
    S3: "Employee · draft ready to submit",
    S4: "Employee · submitted · read-only",
    S5: "Auditor · read-only",
  };
  for (const [state, label] of Object.entries(labels)) {
    const root = renderInspector(fakeInspectorDocument(), {
      state,
      source: SOURCE.BROWSER,
      policyVersion: "2026-08.1",
    });
    const chip = findNode(root, withAttr("data-surface-state", state));
    assert.equal(chip?.textContent, label);
    assert.equal(chip?.getAttribute("title"), state);
    assert.match(root.textContent, /Available to your agent now/);
    assert.equal(findNode(root, withAttr("data-surface-source", SOURCE.BROWSER))?.textContent,
      "Published by this page through WebMCP");
  }
});

test("each tool row keeps its real name and access label and shows only the description's first sentence", () => {
  const description = "Create a draft report in the signed-in session. A second sentence must not occupy the row.";
  const root = renderInspector(fakeInspectorDocument(), {
    tools: [{
      name: "create_expense_report",
      description,
      annotations: { readOnlyHint: false },
    }],
    source: SOURCE.BROWSER,
    policyVersion: "2026-08.1",
    state: "S1",
  });
  const row = findNode(root, withAttr("data-tool-row", "create_expense_report"));
  const purpose = findNode(row, (node) => node.getAttribute?.("class") === "tool-purpose");
  const kind = findNode(row, (node) => node.getAttribute?.("class") === "tool-kind");
  assert.equal(row?.children[0]?.textContent, "create_expense_report");
  assert.equal(kind?.textContent, "write");
  assert.equal(purpose?.textContent, "Create a draft report in the signed-in session.");
  assert.equal(purpose?.getAttribute("title"), description);
});

test("S5 places the complete auditor limitation directly below the inspector heading", () => {
  const root = renderInspector(fakeInspectorDocument(), {
    state: "S5",
    source: SOURCE.BROWSER,
    policyVersion: "2026-08.1",
  });
  assert.equal(root.children[1].getAttribute("class"), "auditor-summary");
  assert.equal(root.children[1].textContent,
    "Auditor view — read only. You can review reports and receipt metadata, and ask your agent to check the tamper-evident day book and its verification result. No filing, editing, signing, or submission tools are available.");
});
