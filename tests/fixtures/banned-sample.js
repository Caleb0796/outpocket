// tests/fixtures/banned-sample.js
// Fixture for tools/lint-layer0.mjs (node G4, owner I4). Deliberately plants
// one violation of every class the scanner must catch, plus two lines that
// must NOT be flagged (the BW-14 word-boundary negative controls,
// erp/RISK.md §2). This file is FICTIONAL product code and must never be
// imported or executed by anything else in the repo.

// -- IDENT class: dead WebMCP identifiers (one of each) --
const aliasStillThere = typeof navigator.modelContext !== "undefined";

function wireLegacyAgent(ctx) {
  ctx.provideContext({ tools: [] });
  ctx.unregisterTool("get_signin_status");
  ctx.clearContext();
}

// -- IDENT class: outputSchema / consequentialHint --
const legacyToolDef = {
  name: "legacy_tool",
  outputSchema: { type: "object" },
  annotations: { readOnlyHint: true, consequentialHint: true },
  description:
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

// -- WORD class: one banned phrase (BW-11) --
const claim = "we spend cache efficiency to buy a structural guarantee about the workflow";

// -- RC class: one retracted claim (RC-3 / R-21) --
const attestation = "this signature proves a specific agent placed the call";

// -- BW-14 negative controls: MUST NOT fire (erp/RISK.md §2, the substring sweep) --
const innocentPlural = "three of our four differentiators are invisible server-side invariants";
const innocentPlural2 = "four differentiators, all of them";

module.exports = {
  aliasStillThere,
  wireLegacyAgent,
  legacyToolDef,
  claim,
  attestation,
  innocentPlural,
  innocentPlural2,
};
