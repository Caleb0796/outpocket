// 账房 COUNTINGHOUSE — the tool surface, now living in the page.
//
// NODE T1 PORTED THIS FILE'S BODY into src/page/tools/. What is left here is a
// re-export facade and nothing else:
//
//   src/page/tools/defs.js     the sixteen definitions  (contract §2)
//   src/page/tools/compile.js  the six-state compiler   (contract §1) + dispatch
//
// Why a facade rather than a copy: tests/helpers.mjs, tests/surface.test.mjs and
// tools/validate-contracts.mjs all import createToolset from this path. If the port
// were a second copy, every one of those would keep grading the pre-port code and
// `node --test tests/surface.test.mjs` would report green over work it never ran —
// a vacuous pass, which is the defect class T1's own notes exist to prevent. One
// implementation, imported from one place, is the only arrangement where the tests
// are evidence about the ported surface.
//
// Ownership: erp/graph.json conventions.ownership_rule clause (a) — a seat may write
// a path it owns a node's `outputs` for, and (a) beats the glob. src/tools.js is an
// output of T6, seat I2. Declared here rather than left to be discovered in a diff.
//
// The public shape of this module is unchanged. Nothing that imported it needs to
// move; new code should import from src/page/tools/ directly.

export {
  createToolset,
  compileSurface,
  compileAbsent,
  surfaceState,
  writeTools,
  MEMBERSHIP,
  STATES,
  clip,
  OUTPUT_BUDGET,
  DESC_BUDGET,
  ALL_TOOL_NAMES,
} from "./page/tools/compile.js";

export { buildDefs, assertCatalogue, ok, TEXT } from "./page/tools/defs.js";
