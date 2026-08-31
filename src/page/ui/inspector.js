// src/page/ui/inspector.js — the live surface inspector and policy-version chip.
//
// ── WHY THIS PANEL IS WORTH ITS 2 HOURS ─────────────────────────────────────
//
// Three of this project's four differentiators are server-side invariants that
// are invisible on screen. This panel is the cheapest way to make kernel (1)
// visible: it prints, on our own page, one row per tool the agent can currently
// see, and a chip carrying the policy version those tools were compiled under.
// When a policy edit bumps the version, the chip changes and rows appear or
// disappear IN THE SAME FRAME — which is a still-photographable fact about a
// mechanism that otherwise only exists in a server's refusal path.
//
// It is unconditional in a way the rest of the demo is not: it renders on OUR
// page, so it does not depend on whether the agent's client re-reads the tool
// list. V2 measured that it does, on its next turn, 2026-08-29 — but that is a
// fact about one client and this panel is a fact about us.
//
// ── WHERE THE ROWS COME FROM, AND WHY IT IS NOT THE REGISTRY ────────────────
//
// From `document.modelContext.getTools()` — THE BROWSER'S OWN VIEW — and not
// from the page's registry, whenever the browser exposes one. The panel's whole
// claim is "this is what the agent can see", and reading our own registry would
// make that claim true by construction rather than by observation: the registry
// is what we TRIED to register, and modelContext is what the browser actually
// holds. Those differ exactly when something is wrong, which is the case worth
// showing.
//
// When there is no modelContext at all — no WebMCP, no H3 shim — the panel says
// so and falls back to the registry, LABELLED. A panel that silently showed the
// registry while claiming to show the browser would be the more comfortable
// failure and the dishonest one.
//
// getTools() RETURNS A PROMISE (erp/FACTS.md IR-18). An un-awaited `.length` is
// `undefined`, which compares false against every count and reads as "the
// surface is empty" rather than as a bug. Every read here is awaited.

// THREE SOURCES, NOT TWO, AND THE THIRD IS WHY. A page driving itself through
// H3's fallback has a document.modelContext — the shim installs one — so a
// panel that reported "read from document.modelContext" would be literally true
// and would read to a judge as "the browser's real API". The shim marks itself
// `__simulated` and env-banner.js already reads that marker; this panel now
// reads the same one. Found by sweeping for presence-of-modelContext checks
// that conclude something about the ENVIRONMENT rather than about the surface,
// after the same class was confirmed in register.js's live()/why(). This file
// was one of the instances.
export const SOURCE = Object.freeze({
  BROWSER: "document.modelContext",
  SIMULATED: "document.modelContext (simulated — the in-page fallback agent, not a real WebMCP)",
  REGISTRY: "page registry (no document.modelContext in this browser)",
});

/**
 * Read the tool surface the AGENT can see.
 * Returns {tools, source} — the source is rendered, never hidden.
 */
export async function readSurface({ doc = globalThis.document, registry = globalThis.outpocketTools } = {}) {
  const mc = doc?.modelContext;
  if (mc && typeof mc.getTools === "function") {
    const tools = await mc.getTools(); // AWAITED — see the header
    // The presence of modelContext says the SURFACE is readable; it does not
    // say the environment has WebMCP. Those are different facts and conflating
    // them is what this branch exists to stop.
    return {
      tools: Array.isArray(tools) ? tools : [],
      source: mc.__simulated ? SOURCE.SIMULATED : SOURCE.BROWSER,
      simulated: Boolean(mc.__simulated),
    };
  }
  if (registry?.getTools) return { tools: registry.getTools() ?? [], source: SOURCE.REGISTRY };
  return { tools: [], source: SOURCE.REGISTRY };
}

/**
 * Read the policy version the server is serving.
 * Returns null on any failure — the caller must NOT render a chip it could not
 * fetch, because an empty chip compared against an empty fetch passes while
 * proving that the endpoint and the chip are both silent.
 */
export async function readPolicyVersion({ fetchImpl = globalThis.fetch, baseUrl = "" } = {}) {
  try {
    const res = await fetchImpl(`${baseUrl}/api/policy`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const body = await res.json();
    const v = body?.version;
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function el(doc, tag, attrs = {}, text = null) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== null) node.textContent = text;
  return node;
}

/**
 * Render the panel.
 *
 * One [data-tool-row] per tool, in the order the surface reports them. The row
 * count IS the tool count — that is the assertion this node exists to make
 * true, and it is why nothing here filters, paginates or caps the list. A panel
 * that showed "the first ten tools" would be a panel whose count means nothing.
 */
export function renderInspector(doc, { tools = [], source = SOURCE.REGISTRY, policyVersion = null, state = null } = {}) {
  const root = el(doc, "div", { "data-surface-inspector": "" });

  const head = el(doc, "div", { class: "inspector-head" });
  head.appendChild(el(doc, "span", { class: "inspector-title" }, "Tools on the surface right now"));

  // The chip. Rendered ONLY when a version was actually fetched: an empty chip
  // is indistinguishable from a correct one when the endpoint is also empty.
  if (policyVersion) {
    head.appendChild(el(doc, "span", { "data-policy-version": policyVersion }, `policy ${policyVersion}`));
  } else {
    head.appendChild(el(doc, "span", { "data-policy-version-missing": "" }, "policy version unavailable"));
  }
  if (state) head.appendChild(el(doc, "span", { "data-surface-state": state }, state));
  root.appendChild(head);

  const list = el(doc, "ul", { class: "inspector-rows" });
  for (const t of tools) {
    const row = el(doc, "li", { "data-tool-row": t?.name ?? "" });
    row.appendChild(el(doc, "code", { class: "tool-name" }, t?.name ?? "(unnamed)"));
    // readOnlyHint is what makes the write set COMPUTABLE rather than
    // hard-coded (R-20). Never print a fixed number of write tools anywhere.
    row.appendChild(el(doc, "span", { class: "tool-kind" },
      t?.annotations?.readOnlyHint === true ? "read-only" : "write"));
    list.appendChild(row);
  }
  root.appendChild(list);

  root.appendChild(el(doc, "p", { class: "inspector-source", "data-surface-source": source }, `read from ${source}`));
  return root;
}

/** Mount into F1's surface region and keep it in step with the surface. */
export function mountInspector({
  doc = globalThis.document, registry = globalThis.outpocketTools,
  shell = globalThis.outpocketShell, fetchImpl = globalThis.fetch, baseUrl = "",
} = {}) {
  const region = doc?.querySelector?.('[data-region="surface"]');
  if (!region) return null;

  let policyVersion = null;

  async function paint() {
    const { tools, source } = await readSurface({ doc, registry });
    region.textContent = "";
    region.appendChild(renderInspector(doc, {
      tools, source, policyVersion, state: registry?.state?.() ?? null,
    }));
  }

  // The version is fetched once and re-read on a flip: a policy edit is exactly
  // the event that changes both the chip and the rows, and the demo's first
  // beat is that they change together.
  async function refreshVersion() {
    policyVersion = await readPolicyVersion({ fetchImpl, baseUrl });
  }

  registry?.onFlip?.(() => { refreshVersion().then(paint); });
  shell?.onSession?.(() => { paint(); });

  refreshVersion().then(paint);
  return { paint, refreshVersion };
}

export const inspector = { readSurface, readPolicyVersion, renderInspector, mountInspector, SOURCE };

if (typeof document !== "undefined" && document.querySelector) {
  globalThis.outpocketInspector = inspector;
  mountInspector({ doc: document });
}
