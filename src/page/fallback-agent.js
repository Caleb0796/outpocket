// src/page/fallback-agent.js — node H3, seat I1.
//
// THE DEMO'S SURVIVAL PATH. If the judge's browser has no WebMCP — wrong
// Chromium, missing flag, feature disabled — `document.modelContext` is simply
// `undefined` and every tool on this page is invisible. This module makes the
// same tool surface drivable anyway, through the same dispatch path, so the
// mechanism the project exists to show is still visible.
//
// ── WHAT IT INSTALLS ─────────────────────────────────────────────────────────
//
// A `document.modelContext` shim, shaped like the real thing, backed by T2's
// registry (`globalThis.outpocketTools`). Two consequences worth stating:
//
//   * It is installed EAGERLY and resolves the registry LAZILY. This module,
//     ./register.js and ./ui/shell.js are three separate <script type="module">
//     tags and their evaluation order is index.html's business, not ours. An
//     eager install means register.js's next sync() finds an `api` and
//     registers into us; a lazy lookup means we work even if we evaluated
//     first and `outpocketTools` does not exist yet. Neither order can produce
//     a half-working surface.
//
//   * It NEVER shadows a real API. If `document.modelContext` already exists,
//     this module installs nothing and reports `installed: false`. Shadowing a
//     working WebMCP with a simulation would turn a real green run into a
//     simulated one silently, and those two must never be confusable.
//
// ── THE HONESTY CONDITION, WHICH IS AN ACCEPTANCE CONDITION ──────────────────
//
// An unlabelled self-driving demo is dishonest. When this module drives, it
// says so in two places: #agent-banner in plain words, and the environment
// banner via `outpocketShell.refreshEnvBanner({ simulated: true })`, which
// appends " · simulated agent" (H5's banner test checks that suffix).
//
// This is also why no claim may be made ANYWHERE that we can attest WHICH agent
// acted. At the tool boundary this fallback agent is indistinguishable from a
// third-party one — that is precisely what makes it work, and precisely what
// makes such a claim false. The label is a promise we keep in the page, not a
// property the boundary can enforce.
//
// ── FIDELITY: THE SHIM REPRODUCES THE REAL API'S REFUSALS ────────────────────
//
// MEASURED 2026-08-29 (erp/FACTS.md IR-18), the real page-JS API:
//   * `getTools()` returns a PROMISE, not an array.
//   * `executeTool(name, args)` REJECTS — `TypeError: ... not of type
//     'RegisteredTool'`. There is no by-name call from page JS.
//   * `executeTool(descriptor, argsObject)` also rejects; the working form is
//     `executeTool(descriptor, JSON.stringify(args))`, resolving to a JSON
//     STRING.
//   * One argument → `TypeError: 2 arguments required, but only 1 present.`
//
// The shim reproduces all four. That is not pedantry: a lenient shim that
// accepted a name would let this page pass a fallback run it could never pass
// under the real API, which is the same class of defect as a gate that cannot
// fail. Code written against this shim runs unchanged against real WebMCP.

const REAL_API_PRESENT = () =>
  typeof document !== "undefined" &&
  typeof document.modelContext === "object" &&
  document.modelContext !== null;

const inBrowser = typeof window !== "undefined" && typeof document !== "undefined";

// Registration is top-level only. A shim installed in a frame would be as
// invisible as a real registration there, so this module declines the same way
// register.js does, and for the same reason.
const topLevel = inBrowser && window === window.top;

/** Tools handed to us by registerTool, keyed by name. Revocation is by signal. */
const registered = new Map();

/** T2's registry, looked up lazily — see the eager/lazy note in the header. */
function registry() {
  const r = globalThis.outpocketTools;
  return r && typeof r.getTools === "function" ? r : null;
}

/**
 * The live tool surface, preferring T2's compiled table.
 *
 * When the registry is present it is the ONE authoritative table — the same one
 * register.js hands the browser and the same one `executeTool` dispatches
 * against — so reading it here keeps the page and the shim from being two
 * tables that agree by luck. `registered` is the standalone path, for a page
 * that called registerTool without T2 being present.
 */
function surface() {
  const r = registry();
  if (r) return r.getTools();
  return [...registered.values()].map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations ?? {},
  }));
}

function isDescriptor(v) {
  return typeof v === "object" && v !== null && typeof v.name === "string";
}

/**
 * The shim. Method shapes are copied from the measured real API, including the
 * three ways it refuses.
 */
const shim = {
  registerTool(def, opts) {
    if (!isDescriptor(def)) throw new TypeError("registerTool: a tool definition is required");
    registered.set(def.name, def);
    // De-registration is via AbortController and nothing else — the only
    // revocation path the real API has.
    const signal = opts && opts.signal;
    if (signal) {
      if (signal.aborted) registered.delete(def.name);
      else signal.addEventListener("abort", () => registered.delete(def.name), { once: true });
    }
    // The real registerTool returns a Promise resolving to undefined when no
    // agent is connected (MEASURED 2026-08-29; the earlier "returns undefined
    // synchronously" reading was wrong on the installed binary). No tool handle
    // ever comes back, which is why AbortController is the only revocation path.
    return Promise.resolve(undefined);
  },

  // A Promise, not an array. `getTools().length` is `undefined` on the real API
  // and is undefined here too, so the trap that made `!== 0` pass against an
  // empty surface behaves identically against the shim.
  getTools() {
    return Promise.resolve(surface());
  },

  async executeTool(descriptor, argsJson) {
    if (arguments.length < 2) {
      throw new TypeError("Failed to execute 'executeTool' on 'ModelContext': 2 arguments required, but only " +
        arguments.length + " present.");
    }
    if (typeof descriptor === "string" || !isDescriptor(descriptor)) {
      throw new TypeError("Failed to execute 'executeTool' on 'ModelContext': The provided value is not of " +
        "type 'RegisteredTool'.");
    }
    if (typeof argsJson !== "string") {
      throw new Error("UnknownError: Failed to parse input arguments");
    }
    let args;
    try { args = argsJson.trim() === "" ? {} : JSON.parse(argsJson); }
    catch { throw new Error("UnknownError: Failed to parse input arguments"); }

    const r = registry();
    let result;
    if (r) {
      // ONE DISPATCH PATH. registry.executeTool goes through toolset.call, which
      // is the same route register.js's toRegistration wrapper takes for a real
      // browser-delivered call — so it carries the double lock that re-checks
      // membership at execution time, the output budget and the error envelope.
      // `source: "agent"` is the honest value: this IS an agent's act. The fact
      // that the agent is simulated is disclosed by the banner, which is where
      // that belongs — not by falsifying provenance.
      result = await r.executeTool(descriptor.name, args, { source: "agent" });
    } else {
      const def = registered.get(descriptor.name);
      if (!def) throw new Error(`Tool not found: ${descriptor.name}`);
      result = await def.execute(args, {});
    }
    // A JSON STRING, as the real API returns.
    return typeof result === "string" ? result : JSON.stringify(result);
  },
};

/**
 * Say so, in plain words, in both places a reader might look.
 *
 * Never throws: a page whose banner elements are missing must still get a
 * working tool surface. A demo that dies because it could not announce itself
 * is worse than one that runs quietly, and the caller is told what happened.
 */
export function labelAsSimulated(doc = typeof document !== "undefined" ? document : null) {
  const done = { agentBanner: false, envBanner: false };
  try {
    const b = doc && doc.getElementById("agent-banner");
    if (b) {
      b.textContent =
        "Simulated agent — this page is driving its own tools. WebMCP is not available in this " +
        "browser, so the in-page fallback agent is calling the same tool surface a real agent would.";
      done.agentBanner = true;
    }
  } catch { /* a banner is not worth failing a demo over */ }
  try {
    const shell = globalThis.outpocketShell;
    if (shell && typeof shell.refreshEnvBanner === "function") {
      // Appends " · simulated agent" to the environment banner — the suffix
      // H5's banner test matches.
      shell.refreshEnvBanner({ simulated: true });
      done.envBanner = true;
    }
  } catch { /* same */ }
  return done;
}

/**
 * Install the shim if — and only if — there is no real API to use.
 *
 * Returns a record of what happened rather than a boolean, because "did not
 * install because the real API is present" and "did not install because we are
 * in a frame" are different facts and a caller that cannot tell them apart
 * cannot report honestly.
 */
export function install({ force = false } = {}) {
  if (!inBrowser) return { installed: false, why: "not running in a browser" };
  if (!topLevel) return { installed: false, why: "not the top-level document — registration there is invisible" };
  if (REAL_API_PRESENT() && !force) {
    return { installed: false, why: "document.modelContext already exists — a real API is never shadowed", real: true };
  }
  try {
    Object.defineProperty(document, "modelContext", {
      value: shim, writable: true, configurable: true, enumerable: false,
    });
  } catch (e) {
    return { installed: false, why: `could not define document.modelContext: ${e && e.message}` };
  }
  // Now that an `api` exists, ask T2 to register into it. register.js reads
  // document.modelContext at flip time, so a surface compiled before we
  // installed was never handed to anyone; refresh() replays it.
  try { registry()?.refresh?.("fallback-agent installed"); } catch { /* not fatal */ }

  const labelled = labelAsSimulated();
  return { installed: true, simulated: true, labelled };
}

/**
 * Drive a list of steps through the page's OWN getTools/executeTool.
 *
 * This is the "self-drive" half of the node's title, and it deliberately uses
 * the public shim rather than reaching into `registry` directly: the point is
 * to exercise the same surface an external agent would, by the same calling
 * convention, so a step that would fail for a real agent fails here too.
 *
 * `steps` is `[{ tool, args }]` — the shape harness/scenarios/happy.json holds.
 * Returns a transcript; it does not throw on a failed step, so the caller can
 * show the whole run rather than stopping at the first red one.
 */
export async function selfDrive(steps, { mc = typeof document !== "undefined" ? document.modelContext : null } = {}) {
  const transcript = [];
  for (const step of steps ?? []) {
    const tools = await mc.getTools();
    const d = tools.find((t) => t.name === step.tool);
    if (!d) {
      transcript.push({ tool: step.tool, ok: false,
        why: `not on the surface; present: ${tools.map((t) => t.name).join(", ") || "(none)"}` });
      continue;
    }
    try {
      const raw = await mc.executeTool(d, JSON.stringify(step.args ?? {}));
      let text = raw;
      try {
        const parsed = JSON.parse(raw);
        const blocks = parsed && parsed.content;
        if (Array.isArray(blocks)) text = blocks.map((b) => (b && b.text) ?? "").join("\n");
      } catch { /* a non-JSON result is returned as-is */ }
      transcript.push({ tool: step.tool, ok: true, text });
    } catch (e) {
      transcript.push({ tool: step.tool, ok: false, why: String((e && e.message) || e) });
    }
  }
  return transcript;
}

export const fallbackAgent = { install, selfDrive, labelAsSimulated, shim };

// ── mount ────────────────────────────────────────────────────────────────────
// Auto-installs on evaluation, so index.html needs one <script type="module">
// tag and no wiring. Published on globalThis for the same reason register.js
// publishes its registry: the harness and the demo need a handle that does not
// depend on module resolution from the page.
if (inBrowser) {
  globalThis.outpocketFallbackAgent = fallbackAgent;
  fallbackAgent.installResult = install();
}
