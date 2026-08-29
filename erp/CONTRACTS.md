# outpocket — frozen contracts

The artifacts that cross the edges of the work graph. Nothing parallel is real until
these are frozen: before the contract artifact exists, "parallel" work is speculative
rework (graph principle 7).

Horizon: **Sprint A** — OpenAI WebMCP Challenge, deadline **2026-09-03 13:00 PT**.
Every contract here is Sprint A. Lane X consumes them in Track B and adds nothing.

Files owned by this document:

```
erp/CONTRACTS.md                       this file
erp/contracts/violation.schema.json    C1  deterministic validation envelope
erp/contracts/tool-export.schema.json  C2  blind surface export
erp/contracts/provenance.schema.json   C3  per-field origin record
erp/contracts/signature.schema.json    C4  sign gate, snapshot, hash chain
erp/contracts/policy.schema.json       C5  versioned policy document
erp/contracts/eval-case.schema.json    C6  eval case
erp/contracts/canonical-vectors.json   C0  OCF-1 conformance vectors (data, not a schema)
erp/contracts/policy-versions.json     C5b policy version lock (data, not a schema)
```

---

## 1. Rules of the contract layer

1. **An edge is a frozen artifact, not a feeling.** Every edge in `GRAPH.md` that
   crosses lanes names one of the files above. If an edge cannot name a file, the
   edge is fake and the two nodes are really one node.
2. **`erp/contracts/**` is owned by seat L1.** L1 is the sole pusher to main, so
   L1 is the sole writer here. Before a contract's freeze date, the producing seat
   proposes edits through L1. After it, see rule 4.
3. **Ownership is checkable.** `git diff --name-only <base>..HEAD | grep '^erp/contracts/'`
   in a branch owned by anyone other than L1 is an ownership violation and is
   caught by node G5.
4. **After freeze, a change costs a PM adjudication.** PM rules adopt / reject /
   debt (the three-way verdict from the team design). An adopted change is written
   into the changelog at the bottom of this file with the node ids that must rework.
   Silently editing a frozen contract is the failure this layer exists to prevent.
5. **Every contract carries its own mechanical check.** See §11. A contract with no
   command that fails when it is violated is decoration.
6. **This document is not an authority and does not behave like one.** There are
   exactly two: `erp/graph.json` owns node identity, ownership, hours, cut rank and
   accept predicates; `erp/PATHS.md` owns every literal path, filename and command
   name. Where this file needs a node id, a path, a command or an hour figure it
   quotes them or references them by id, and never re-derives them. The previous
   revision of §12 kept a private node table — that is how `S10` came to mean two
   different nodes and `E8` two more. It is deleted; see §12.

### Reconciliation note on the seat roster

The user agreed 15 seats with four Codex positions, but only three Codex seats were
ever named (C1 verifier, C2 builder, C3 red team). This document names the fourth as
**C4, Codex eval engineer**, owner of `webmcp-eval-kit` and of contract C6, which
matches the standing instruction that eval is mainly Codex-run. Roster is therefore 16
rows for 15 agreed seats plus that one named-out position.

### The four non-overlapping rulers

| Seat | Measures | Reads which contract |
| --- | --- | --- |
| QA | is it done | all eight files in `erp/contracts/`, via `npm run contracts:check` (node G6) |
| L2 | is it enough to win | none directly; reads the artifacts they produce |
| C3 | can it be broken | C4 (sign gate) and C1 (the fix oracle) |
| C1 | can a blind agent use it | **C2 only** — C1 gets no repository access |

---

## 2. Contract index

Node ids, owners and edges in this table are **quoted from `graph.json`**. If a cell
here disagrees with `graph.json`, `graph.json` wins and this table is regenerated.

> **A restated table is legal only while a checker proves it equal (ruling R-22).**
> `graph.json.falsification` forbids a sibling document from restating a node table
> instead of quoting it, and this table restates node ids and owners. What makes it legal
> is `node tools/ready.mjs --check-tables` (node **G0**), which diffs every restated node
> table in `erp/**.md` against `graph.json` field by field and prints the offending row.
> **If `--check-tables` is red, or has not run, this table has no standing** — quote
> `graph.json` instead. The agreement was hand-maintained until 2026-08-28, which is
> exactly the condition under which a restatement drifts.
Every path is quoted from `PATHS.md §2.4`; all eight filenames are **singular** —
`erp/contracts/violation.schema.json`, never the plural, which does not exist and never
will.

> **R-28: DO NOT COUNT THEM AT ALL. Scope every check by a GLOB, never by a numeral.**
> *"The eight frozen schemas"* is dead vocabulary as of 2026-08-28, and *"the eight frozen
> contract files"* — the phrasing that replaced it — **is stale from Day 0 too**: node
> **V5** adds `erp/contracts/probe-verdict.schema.json` on Day 0, making it nine files and
> seven schemas before the first seat is dispatched. The counts were wrong in two
> different ways at once: only six of the eight are schemas, *and* eight is not the number
> for longer than a day. **Predicates say `every *.schema.json in erp/contracts/`**; prose
> says *"the frozen contract files"*. Anything that needs a count derives it —
> `ls erp/contracts/*.schema.json | wc -l` — and never writes a numeral that a later node
> silently invalidates.
>
> The composition, for reading rather than for counting. `*.schema.json` files validate
> instances and `ajv` compiles them:
> `violation`, `tool-export`, `provenance`, `signature`, `policy`, `eval-case`. **Two are
> frozen data, not schemas** — `canonical-vectors.json` (C0, the seven OCF-1 conformance
> vectors) and `policy-versions.json` (C5b, the version lock). It matters wherever a
> check is scoped by the word: `ajv` compiles **six**, not eight, and a check that says
> "validate the eight schemas" either fails on two files that are not schemas or quietly
> skips them — **and a check hard-coded to eight breaks again the moment V5 lands its
> ninth file on Day 0.** Scope by the glob and the arithmetic never has to be maintained.
>
> **The directory is `erp/contracts/`, and there is no other spelling (ruling R-17).**
> The bare `contracts/**` glob is dead: it and `erp/contracts/**` were both live for
> the same eight files, so half the freeze commands and ownership checks in this project
> addressed a path that does not exist. The eight contract files are **pre-existing
> planning artifacts** — they were written before the work graph and they are on disk
> today. **No node produces, moves or copies them.** `S10` *freezes them where they are*,
> which is why none of them appears in any node's `outputs` and why
> `G0 --check-accept-paths` exempts exactly these eight plus `erp/charters/C3.md` and
> prints the exempted list rather than swallowing it.

| id | file | producing node (owner) | consuming nodes | repo |
| --- | --- | --- | --- | --- |
| C0 | `erp/contracts/canonical-vectors.json` | **S11** (I3) | S3 S5 S6 S7 S8 T5 E1 E3 E5 X3 X4 | outpocket |
| C1 | `erp/contracts/violation.schema.json` | **S4** (I3), also T3 (I2) | T1 T2 T3 F2 F5 E2 E3 X2 | outpocket |
| C2 | `erp/contracts/tool-export.schema.json` | **T5** (I2) | E1 E2 E3 E5 E6 E4 E8 G4 X6 | outpocket |
| C3 | `erp/contracts/provenance.schema.json` | **S8** (I3) | S5 S6 S7 T1 F2 E3 X4 | outpocket |
| C4 | `erp/contracts/signature.schema.json` | **S5** and **S6** (I3), with **S12** | T1 T2 S7 S12 F4 F5 E3 D3 X3 | outpocket |
| C5 | `erp/contracts/policy.schema.json` | **S3** (I3) | T1 S4 F5 E2 E5 | outpocket |
| C5b | `erp/contracts/policy-versions.json` | **S3** (I3) | F5 E2 G6 | outpocket |
| C6 | `erp/contracts/eval-case.schema.json` | **E1** (C4) | E2 E3 E5 E6 E8 E10 E4 X6 | outpocket |

The **producing node** column means *the node whose work the contract describes and
which must rework if it changes* — not "the node that writes the file into the tree".
All eight files predate the graph. C6's **schema** lives at
`erp/contracts/eval-case.schema.json` in the `outpocket` repo with its seven siblings;
the **cases** it validates live in `webmcp-eval-kit/evals/suites/`. Those are two
different things and the previous revision of this table conflated them.

### There is one freeze mechanism, and it is not a clock

`sha256sum -c erp/contracts/FREEZE.md`, asserted in **S10**'s accept predicate in
`graph.json`. `erp/contracts/FREEZE.md` is produced by S10 (owner L1); the file has an
`.md` extension — `erp/contracts/FREEZE` without one does not exist.

The previous revision of this table published a per-contract **wall-clock** freeze
column (`C1 … 2026-08-29 09:00 PT`, and so on). That was a third, competing ordering
mechanism alongside S10's freeze commit and `graph.json`'s edge list, and it was
internally impossible: C1's declared producer is S4, which the graph schedules two days
after the deadline the column gave it. The column is deleted. Ordering comes from the
edges in `graph.json` and from `graph.json.interface_freezes`, which for C1 reads
*"frozen_by S10, owner L1, unblocks T1 S1 S4, deadline end of Day 1"* — and that
`unblocks` list is now a checked assertion (`node tools/ready.mjs --check-freezes`),
not a claim.

C1 is the first thing frozen because I2 and I3 are the only strongly coupled pair on
the graph and the violation envelope is the whole of that coupling. C0, C3 and C4
freeze as one cluster: the digest, the thing digested, and the thing that binds to it.

---

## 3. OCF-1 — the canonical form (normative)

Everything digested in this system is digested the same way. Two independent
implementations must agree byte for byte, so the rules are written out rather than
gestured at.

> **This section is the single definition (ruling R-11).** `src/canonical.js`, produced
> by node **S11**, is the one implementation. `webmcp-eval-kit/src/canon.mjs` (node
> **E1**) is a **port** of it, verified against all seven vectors in
> `erp/contracts/canonical-vectors.json` as the eval-kit's own `npm test`. There is no
> second definition anywhere. The one that used to exist — `JSON.stringify` over an
> array sorted by `localeCompare`, no `kind` prefix, nested key order untouched —
> produced different bytes for the same value **always**, which made every "the deployed
> digest equals the frozen digest" assertion unsatisfiable by construction. It is
> deleted.

### 3.1 Serialisation

A canonical value is one of: object, array, string, integer, boolean, null. Nothing
else — no floats, no dates, no undefined, no class instances.

1. **Objects.** Keys are sorted ascending **by Unicode code point**, recursively, at
   every depth. **Never `localeCompare`**: it is ICU-dependent, so a stranger's clean
   clone can sort differently and produce a different digest for identical input. Every
   key MUST match `^[A-Za-z0-9_]{1,64}$`; any other key is `E_CANON_KEY`. Under that
   restriction byte order, code-point order and UTF-16 code-unit order all coincide, so
   a JCS-compatible sorter and a naive codepoint `Array.sort()` cannot disagree.
   Serialised `{"a":1,"b":2}` with no whitespace.

   **Carve-out, `inputSchema` subtrees only.** Inside an `inputSchema` value —
   `erp/contracts/tool-export.schema.json` `$defs.inputSchema` — keys matching
   `^\$[A-Za-z0-9_]{1,63}$` are permitted, so `$schema`, `$ref` and `$defs` do not raise
   `E_CANON_KEY`, and JSON Schema numeric keywords are exempt from rule 3. Without this
   carve-out OCF-1 could not canonicalise a real tool definition at all and
   `surface_digest` would be uncomputable for any tool whose schema uses them. The
   carve-out is scoped to that subtree and nowhere else, and S11's vector suite asserts
   both halves — that `$`-keys pass inside `inputSchema` and still raise `E_CANON_KEY`
   outside it.
2. **Arrays.** Order is **preserved and never sorted.** Line order is what the human
   read down the page, so reordering must change the digest.
   (The spike sorted lines by `merchant+date` at `countinghouse/src/erp.js:387`, which
   would let an agent reorder a signed report invisibly.)
3. **Numbers.** Integers only, in `[-(2^53-1), 2^53-1]`. Shortest decimal, no leading
   zeros, no `+`, no exponent. `-0` normalises to `0`. A non-integer is
   `E_CANON_NUMBER`. **All money is integer cents; all FX is integer micro-USD**
   (ruling R-6 — `rate × 1e6`, so `EUR 1.09` becomes `1090000` and `JPY 0.0067` becomes
   `6700`), converted as `usd_cents = round_half_up(amount_cents * micros / 1000000)`.
   No float ever enters a canonical form. This rule exists to delete the entire
   float-to-string disagreement class rather than specify a way through it. The only
   exemption is the `inputSchema` carve-out in rule 1.

   **Where the boundary is, because it was specified nowhere and that cost us a control.**
   Money crosses the **tool boundary** as integer cents. Every money argument on every
   write tool is named `<thing>_cents` and typed `integer` in that tool's own
   `inputSchema`; **there is no dollars-to-cents conversion step, because there is no
   dollars representation to convert from.** Dollars appear in exactly two places, both
   of them *output* and neither of them digested: rendered page copy, and the `message`
   string of a violation envelope (`"$212.40 is above the $150.00 per-trip transport
   limit."`). `erp/contracts/eval-case.schema.json` enforces this as a schema keyword,
   not a convention — `$defs.tool_arg` restricts every `args` value, recursively, to
   object / array / string / integer / boolean / null, so a float in a suite file is a
   validation error at any depth.

   This is written down because leaving it unwritten made a negative control silently
   vacuous. The eval examples passed `amount: 86.4`, `212.4`, `106.2` — float dollars —
   while N-07 asserts that a **non-integer amount** must come back as a violation
   envelope. Under that pair, `neg-post-signature-tamper` would have been refused as a
   *bad argument* by N-07's own guard before it ever reached the snapshot comparison it
   exists to test, **and would still have reported green**, because a `required_failure`
   that fails for the wrong reason is indistinguishable from one that fails for the right
   reason. The values are now `8640`, `21240`, `10620`, and `21240` is the same integer
   the worked violation instance in §4 carries as `observed`.
4. **Strings.** Normalised to **NFC**, then serialised as a JSON string escaping only
   `"`, `\`, and C0 controls (`\b \t \n \f \r` for those five, `\u00xx` lowercase hex
   otherwise). Everything from U+0020 up, including U+007F and all non-ASCII, stays
   literal. Lone surrogates are `E_CANON_STRING`. Canonicalisation does **not** trim
   or case-fold — that is field normalisation, deliberately a separate upstream step.
5. **null.** Legal, serialised `null`. **A key is never omitted.** Every field in a
   fixed projection is always present; a value that does not apply is emitted as
   `null`. Absent and null can therefore never be confused.
6. **Whitespace.** None. Separators are `,` and `:`.

### 3.2 Digest

```
digest(kind, value) = "sha256:" + hex(SHA-256(utf8(kind + "\n" + canon(value))))
```

`kind` is a domain-separation prefix so a digest can never be replayed into another
context:

| kind | over |
| --- | --- |
| `outpocket/ocf/1` | the C0 conformance vectors only |
| `outpocket/snapshot/1` | the signed report snapshot |
| `outpocket/chain/1` | one day-book chain entry, without its own `entry_digest` |
| `outpocket/policy/1` | the policy document |
| `outpocket/value/1` | one field value, for a provenance record |
| `outpocket/surface/1` | one state's `tools` array in the export — this and nothing else is what `tools.export.json`'s `surface_digest` holds |

**SHA-256, not FNV-1a.** The spike used 32-bit FNV-1a
(`countinghouse/src/erp.js:19`). A 32-bit space is brute-forced to a collision on a
laptop in seconds, so it cannot bind a signature to anything. Grade: MEASURED — the
code is in the repository.

### 3.3 Conformance

`erp/contracts/canonical-vectors.json` holds seven frozen vectors: input value,
expected canonical string, expected digest. The file is pure ASCII with `\uXXXX`
escapes so no editor can renormalise the inputs. Any implementation must reproduce
all seven exactly.

The load-bearing pair:

```
v6_line_source_agent  ... "provenance":{"amount":"agent",...}
                          sha256:9b23b4a3eb2850436cfd4c80190ff6dc989b82532b15582b54f8adb82cda210a
v7_line_source_human  ... "provenance":{"amount":"human",...}
                          sha256:a82c3e7c229737432cb38d6cb077f5d82b5f54027163adeaad16cde6acb4b3bd
```

Two values differing only in one provenance source, two different digests. This is
the standing regression test for the bug this contract layer exists to close.

---

## 4. C1 — violation envelope

**Produced by** S4 (owner I3) on every write tool, and by T3 (owner I2) for the
absence register. **Consumed by** T1 T2 T3 F2 F5 E2 E3 X2. Frozen by **S10** —
`graph.json.interface_freezes` records it as the only strong I2/I3 coupling, unblocking
T1, S1 and S4 by end of Day 1.

Shape: `{schema, code, rule_id, severity, entity, entity_id, field, message, fix,
fix_class, candidates, policy_version, observed?, limit?}`.

### Worked instance

```json
{
  "schema": "outpocket.violation/1",
  "code": "CAP_TRANSPORT", "rule_id": "R07", "severity": "block",
  "entity": "line", "entity_id": "ln_4", "field": "amount",
  "message": "$212.40 is above the $150.00 per-trip transport limit.",
  "fix": "A trip above the limit needs a written exception from your approver before it can be filed.",
  "fix_class": "human_exception_required",
  "candidates": [], "policy_version": "2026-08.1",
  "observed": 21240, "limit": 15000
}
```

The absence register (HANDOVER §8 item 1) reuses this exact envelope with
`entity: "surface"`, `entity_id` = a tool name, and an `S`-prefixed `rule_id`. That is
the whole of node T3: a resident read-only tool that answers "why is this tool not
here and how do I get it back" in the same shape as every other refusal.

### `fix` and `candidates` are a policy-evasion oracle

A refusal that says *"over the cap — split it into two lines"* turns every line
compliant while the report is fraud. The spike ships that exact string:
`countinghouse/src/policy.js:133`, `CAP_TRANSPORT` fix =
`"Split legitimate multi-trip charges into one line per trip."` Grade: MEASURED.

**Mitigations, in the schema:**

1. `fix_class` is a closed enum. `human_exception_required` and `not_reimbursable`
   MUST carry `candidates: []` — schema-enforced by an `if/then`. There is no
   self-service route past a cap.
2. `fix` is lint-checked against `x-fixLint.bannedSubstrings` (19 substrings, case
   insensitive: `split`, `one line per`, `reclassify`, `a different category`, …).
   The lint runs in node G4's layer-0 hook, so a banned fix cannot be committed.
   The worked counter-example — the spike's live `"Split legitimate multi-trip charges
   into one line per trip."` from `countinghouse/src/policy.js:133` — sits under
   `x-lintFailingExamples`, **not** under `x-invalidExamples`, because it is
   schema-valid and no JSON Schema keyword can catch it. §11 check 1 asserts every
   `x-invalidExamples` instance *fails* validation; this one passed, so leaving it
   there would have made a green check 1 a lie. Check 4 owns it.
3. `candidates[].origin` is a closed enum of `enum_member`, `existing_entity`,
   `policy_threshold`. There is **no** origin for a value derived from the disputed
   claim, so the array is structurally unable to propose an evasive rewrite.

**Residual risk — stated, not solved.** The caps are published on purpose;
`get_expense_policy` serves them and that is mechanism ②. A filer always knows where
the cliff is, and this lint does not change that. What it stops is the product naming
the evasive edit *for this claim, at the moment the claim is refused*. The remaining
control is human and downstream:

- the commit artifact carries `violation_history` (C4 `$defs.artifact`);
- the signature dialog F4 prints `violation_history_count` above the signature line,
  so the person signing a clean report can see it was not clean an hour ago;
- eval case `neg-cap-split-visible` (C6) asserts the history survives into the
  artifact and that no violation the agent saw contained banned wording.

We do not claim the oracle is closed. We claim it is visible to the person who
carries the consequence.

### Compatibility

| change | verdict |
| --- | --- |
| new `code` value | **additive, no bump.** Consumers MUST NOT enumerate codes; branch on `severity` and `fix_class`. |
| new optional property with a behaviour-preserving default | additive, no bump |
| new `severity` value | **BREAKING** — `block` gates the existence of the submit tool |
| new `fix_class` member | **BREAKING** — consumers switch on it |
| new `candidates[].origin` member | **BREAKING** — it is the evasion guard |
| tightening `message`/`fix` maxLength | **BREAKING** for stored records |

---

## 5. C2 — blind tool-surface export

**Produced by** T5 (owner I2) as `artifacts/tools.export.json` — the canonical path in
`PATHS.md §2.7`; `outpocket/tools.export.json` and bare `tools.export.json` are dead
spellings. **Consumed by** E1 E2 E3 E5 E6 E10 (C4), E4 (L2) and E8 (C1), G4, X6.
Frozen by S10; `graph.json.interface_freezes` gives the artifact's own freeze as
*"frozen_by T5, unblocks E2 E4 E5, deadline end of Day 3"*.

### State ids

State ids are the six canonical ids defined once in **`PATHS.md §5`**:

`S0-anon` · `S1-emp-home` · `S2-emp-draft-clean` · `S3-emp-draft-dirty` ·
`S4-emp-submitted` · `S5-aud`

No other spelling appears in any artifact. `surface_digest`, `evals/surfaces.expected.json`,
every suite and the README results table are keyed by these strings. The schema
previously carried a second vocabulary — `signed_out`, `employee.no_report`,
`employee.draft.dirty`, `employee.draft.clean`, `auditor` — which shared **zero**
spellings with the ids seven other documents already used, so E2's `setEquals` could
not be written against both and E6's "the deployed surface digest equals the frozen
one" was undefined for a frozen contract. Never write a bare `S1` or `S5` for a state:
those are server-lane **node** ids in `graph.json`.

This is the only artifact seat **C1 ever receives**. C1 has no repository access on
purpose: a verifier who can read the source systematically overestimates a tool
surface that the judge's model only ever sees as name + description + inputSchema +
annotations.

### Worked instance (one state, elided)

```json
{ "schema": "outpocket.tool_export/1",
  "app_commit": "0000000000000000000000000000000000000000",
  "policy_version": "2026-08.1",
  "policy_digest": "sha256:b7ccc1ff9fdadb66399f48b26617a53572dd793ac7c57af55d72929561965b38",
  "states": [ { "state_id": "S0-anon",
    "preconditions": {"role":"none","open_report":"none","verdict":"n_a"},
    "tools": [ {"name":"get_signin_status","description":"Read whether …",
                "inputSchema":{"type":"object","properties":{}},
                "annotations":{"readOnlyHint":true}} ],
    "surface_digest": "sha256:630daf558b002f3db938bc3abfd873b4c68b6fc99084b681de1026fe9fe95ecc",
    "accounting": {"tool_count":1,"description_bytes":230,"schema_bytes":33,
                   "total_bytes":280,"estimated_tokens":70} } ],
  "totals": {"state_count":6,"distinct_tool_count":15,"max_description_bytes":307} }
```

That single state is arithmetically exact and reproduces: `230 + 33 + 17 = 280`,
`ceil(280/4) = 70`, and `digest("outpocket/surface/1", tools)` is `sha256:630daf55…`
(re-verified 2026-08-28). But it carries one state where the schema requires six, so it
lives in the schema under **`x-elidedExample`, not `examples`** — §11 check 1 asserts
that every `examples[*]` validates against its own schema, and a one-state excerpt
sitting there would have failed that check on day one. Inlining all six states would
mean hand-writing forty-odd tool definitions no node has produced yet. C2's real
conformance assertion is that the **generated** `artifacts/tools.export.json` validates
against the schema, which is what E2 and E5 run.

### What the schema enforces

- `additionalProperties: false` on the tool object, permanently. Any extra key gives
  C1 information the judge's model does not have.
- `outputSchema` is forbidden — **it does not exist in the API** (MEASURED, HANDOVER
  §3 rule 3). Its appearance means someone wrote against an old tutorial.
- `annotations` allows only `readOnlyHint` and `untrustedContentHint`.
  `consequentialHint` appears in the WPT `webmcp.idl` but not in the spec text; the
  IDL and the prose disagree in at least three places (HANDOVER §3 rule 9), so we
  bind to the prose and record the disagreement rather than shipping against the union.
- `description` `maxLength: 500` — PUBLISHED guidance, not browser enforcement, so
  this schema *is* the enforcement, mirrored by G4's layer-0 lint.
- `x-forbiddenKeys` scan: `execute`, `handler`, `endpoint`, `url`, `cookie`,
  `session`, `token`, `generated_at`, `timestamp`.
- `x-requiredStates` pins the **six** state tool counts — `S0-anon` 1, `S1-emp-home` 5,
  `S3-emp-draft-dirty` 12, `S2-emp-draft-clean` 13, `S4-emp-submitted` 6, `S5-aud` 6 —
  all MEASURED by reading `countinghouse/src/tools.js:343-354`. The compiler produces
  **six** distinct surfaces, not five: the previous revision omitted the submitted state
  entirely (`if (open.status !== "draft") return [...base, t_get_open]`). That omission
  mattered. `S4-emp-submitted` and `S5-aud` both carry 6 tools and differ by exactly one
  name (`create_expense_report` vs `get_day_book`), which is precisely why **E2 asserts
  set equality over the tool names and never count equality** — a count assertion passes
  even if the auditor is handed the employee's surface, and a five-state export cannot
  express the state that motivates the assertion. Node T2's registration flips are
  graded against these numbers, and `surface_digest` turns each flip into a single
  string comparison.
- `totals.distinct_tool_count` is **15 before node T6 and 16 after**. Under ruling R-9,
  T6 removes `open_expense_report` from the auditor surface and adds a genuinely
  side-effect-free `get_report(report_id)`: read-only must be constructive, not a hint
  to the model. `S5-aud`'s tool count stays 6; the distinct set grows by one.

### Determinism and token accounting

The export contains no wall-clock and no environment-dependent value:

```
node tools/export-surface.mjs > /tmp/a.json
node tools/export-surface.mjs > /tmp/b.json
cmp /tmp/a.json /tmp/b.json
```

`estimated_tokens = ceil(total_bytes / 4)`. Grade: **OUR-ESTIMATE**, a comparability
metric, not a tokenizer output, and it must be labelled that way anywhere it is
published.

> **Correction to the ground truth, forced by arithmetic.** HANDOVER §3 rule 10
> records four surface measurements as `395 chars ≈ 99 tok`, `1947 ≈ 487`,
> `6682 ≈ 1671`, `2070 ≈ 518`. All four are *exactly* `ceil(bytes/4)`. Those token
> figures are therefore this same estimate, not independent tokenizer measurements.
> The byte counts are MEASURED; the token counts are OUR-ESTIMATE. Citing them to a
> judge as measured token counts would be circular, and E5 must not do it.

### Compatibility

| change | verdict |
| --- | --- |
| new top-level metadata property | additive, no bump |
| new state in `states` | additive, no bump |
| **any** new property inside a tool object | **BREAKING** — it breaks C1's blindness |
| new `annotations` member | **BREAKING** — requires a re-verified API claim first |
| changing `estimated_tokens` formula | **BREAKING** — invalidates every published number |

---

## 6. C3 — per-field provenance record

**Produced by** S8 (owner I3). **Consumed by** S5 S6 S7 T1 F2 E3 X4.
Frozen by S10.

Append-only. Records are never updated and never deleted; a correction is a new record
with a higher `seq` and a `supersedes` pointer.

### Worked instance

```json
{ "schema":"outpocket.provenance/1","seq":41,"id":"pv_41",
  "at":"2026-08-29T09:38:02.114Z","entity":"line","entity_id":"ln_3",
  "field":"amount","source":"agent","actor":"agent","tool":"add_expense_line",
  "value_digest":"sha256:7326867166d535636e1efcc825476239e5834ffee67ee70c6b59a125015a9b2e",
  "supersedes":"pv_28","revision":11 }
```

**Ordering is by `seq`, never by `at`.** Two records can share a millisecond, and
clock skew must never be able to reorder authorship.

**Derivation rule.** The current source of field `F` on entity `E` is the `source` of
the highest-`seq` record for `(E, F)`. There is always exactly one, because a record
with `source: "unset"` is written for every field of an entity at creation. The
snapshot's compact `provenance` map is that derivation and nothing else.

`actor` is a **display identity, not an authorization input.** Authorization is decided
per request from the session cookie by S2, never from anything a tool argument carries.

### Compatibility

| change | verdict |
| --- | --- |
| new record for an existing field | that is the normal operation, not a change |
| new optional property outside the digested set | additive, no bump |
| new `source` enum member | **BREAKING** — it enters the signed digest and consumers switch on it |
| adding a field to `x-fieldSets.line` | **BREAKING** — changes the snapshot projection, see C4 |

---

## 7. C4 — sign gate, snapshot, hash chain

**Produced by** S5 and S6 (owner I3), with **S12** (report revision counter and atomic
sign lock, I3) and **S11** (the OCF-1 canonicaliser, I3). **Consumed by** T1 T2 S7 S12
F4 F5 E3 D3 X3. Ownership, hours, cut rank and accept predicates for every one of those
ids are in `graph.json`; this file does not restate them.

> ### THE CLAIM THIS SECTION IS ALLOWED TO MAKE — ruling R-13, read this first
>
> **The only provable sentence is: *a commit cannot be made without a POST from the
> authenticated session to `/api/sign/{request_id}/respond`.*** That is the whole of it.
> Every stronger headline is deleted from this document and may not be restored here, in
> `erp/**`, in the README, in the video script or in the Devpost text. Specifically
> deleted: *"a commit cannot be made without a human decision"*; *"Layer 0 answers 'did
> a human decide?'"*; and any flag, table cell or `forgeryClosed` key asserting that the
> sign-gate forgery is closed. `signature.schema.json` `x-signRequestState.provableClaim`
> carries the same sentence, and `graph.json.falsification` fires against any document
> that restores a stronger one.
>
> **A second forgery survives R-1 and commits *before the `confirm_token` ships* — node
> `S5`, Day 3 — and that clause is part of the claim, not a caveat on it (R-34).** The
> walk below is written against the build as it stands today, on which no token is minted
> and `/respond` demands none. From Day 3 the same body is **refused 403
> `E_NO_CONFIRM_TOKEN`**, because `confirm_token` is one of the eight required fields of
> the frozen `$defs.sign_respond_request` under `additionalProperties:false` and the body
> below carries seven. **That refusal is scheduled and documented; it is not a discovery,
> and it does not make the gate stronger than the provable sentence above** — a caller
> who can read the dialog's DOM lifts the token and the walk holds again for that caller
> (open unknown **V3**). Anyone quoting *"it commits"* without *"before the
> `confirm_token` ships"* is quoting half of it.
>
> Two requests instead of one. The
> attacker calls `submit_expense_report`, takes the `snapshot_digest` D and `revision` R
> out of the `sign_request` the server just handed back, **never renders the dialog**, and
> POSTs `/api/sign/{request_id}/respond` itself with
> `{schema, request_id, decision:"signed", reason:null, method:"click",
> acknowledged_digest:D, acknowledged_revision:R}` — every field a constant or a verbatim
> copy. Then it POSTs the commit. Walk every code in §7.3's table — cite the table, never a
> numeral; the count has gone stale three times (eleven, twelve, thirteen) and R-34 made it
> fourteen:
> `E_DIGEST_ACK_MISMATCH` no (D was echoed), `E_NO_CONFIRM_TOKEN` **yes, once the token
> of R-13(c) ships and only for a caller that cannot read the dialog's DOM — which is why
> this walk is written against the build as specified and the control is `known-open`,
> not closed**, `E_NOT_SIGNED` no (**the record genuinely
> *is* answered-and-signed, because the attacker answered it**), `E_SNAPSHOT_MISMATCH` no
> (nothing changed), `E_REVISION_MISMATCH` no (the server's own R),
> `E_SIGN_REQUEST_UNKNOWN` no, `E_SIGN_REQUEST_EXPIRED` no, `E_SIGN_IN_PROGRESS` no,
> `E_POLICY_VERSION_MOVED` no, `E_POLICY_DIGEST_MOVED` no (the policy did not move —
> R-33 closes a different attack and is no defence against this one),
> `E_NOT_CLEAN` no, `E_FORBIDDEN` no (the filer's own
> session), `E_DECLINED` no, **`E_ALREADY_ANSWERED` no** (the record is answered exactly
> once, by the attacker; nobody responds twice). **It commits — today, and until `S5`
> lands the token on Day 3.** This is inside *our own* declared threat
> model — the N-04 shape, curl and a session cookie and no browser — and it needs no
> script execution on the origin.
>
> **What R-1 bought, and what it cost.** *Bought:* the attacker loses the ability to
> choose the **name** and the **timestamp**. `signed_by` comes from the session cookie
> and `at` from the server clock, and `sign_respond_request` has no key for either.
> *Cost:* the resulting record is a **true attribution of a false event** — signed
> `chen`, at a genuine server time, in a chain entry **forensically indistinguishable
> from a real click**, in the day book, forever. Arguably that is worse than the old
> forgery, which at least left an implausible name or time behind for an auditor to
> notice. It is written here rather than omitted because a reviewer who finds it unaided
> concludes the entire layer is advocacy.
>
> **Defence in depth, and not a proof: the `confirm_token`.** R-13(c). The server mints a
> `confirm_token` with the sign request and **`/respond` requires it**; a body without it
> is **403 `E_NO_CONFIRM_TOKEN`** and the record stays `open`. Its whole value is the
> delivery channel: the token is written **only into the rendered dialog's DOM**, never
> into a tool-call result, never into the `sign_request` message, never into any
> `/api/sign/{request_id}` response body. `sign_request` therefore has no `confirm_token`
> property at all, and `additionalProperties:false` makes its appearance there a
> validation failure rather than a review comment. **The residual risk, stated exactly:
> this raises cost, it does not establish personhood, and it is a direct function of open
> unknown `V3` — if an agent-initiated fetch carries the page session cookie *and* the
> agent can read the DOM, the token is reachable and the vector is open again for that
> caller.** Those terms, wherever the sign gate is described. See §14.
>
> **The instrument is pointed at it.** Negative control **`neg-respond-without-click`**
> is scripted verbatim as the attack, carried in `erp/contracts/eval-case.schema.json`
> `x-requiredCases`, and it records the honest outcome: `controlStatus: "known-open"`,
> **it COMMITS today**, and after the `confirm_token` lands it fails *only* for a caller
> that cannot read the DOM. Node **E9**'s accept additionally asserts that
> `erp/charters/C3.md` has been rewritten to put "POST `/respond` yourself" on the red
> team's standing target list and to delete the instruction to *prove that closure, not
> to rediscover the hole* — the one instrument that would have found this was pointed
> away from it, by a sentence.
>
> ### BREAKING CHANGE, 2026-08-28 — the server records the answer (R-1)
>
> Ruling **R-1**. Before this revision the sign gate did not prove a human had signed,
> and there was a working forgery. `sign_response` was entirely client-authored:
> `request_id`, `decision`, `signed_by`, `method`, `at`, `acknowledged_digest` and
> `acknowledged_revision` were each a constant, attacker-chosen, or copied verbatim out
> of the `sign_request` the server itself had just returned. It was then POSTed to
> commit as `commit_request.signature`. So: call `submit_expense_report`, never render
> the dialog, synthesise a `sign_response` echoing the server's own `snapshot_digest`
> and `revision`, POST it with the session cookie. Walk the whole rejection table —
> `E_SIGN_REQUEST_UNKNOWN` no (real id), `E_SIGN_REQUEST_EXPIRED` no (inside 300 s),
> `E_REVISION_MISMATCH` no (copied), `E_DIGEST_ACK_MISMATCH` no (copied),
> `E_SNAPSHOT_MISMATCH` no (the lock guarantees nothing changed), and on down. **The
> report commits**, a chain entry is written, and an artifact is stored attesting a
> human signature by a client-chosen name at a client-chosen time.
>
> The cruelty was structural. The tamper defence works *because nothing changed between
> sign request and commit*; the forgery succeeded **for exactly the same reason**. A
> digest comparison cannot distinguish "a human signed and nothing changed" from
> "nobody signed and nothing changed". And the ten-code table had **no code for "this
> sign request was never answered"** — direct evidence that the server held no state.
> Nor did §7.4's "none of this defends against script execution on the origin" cover it:
> the attack needs no script execution, only a POST with the session cookie, which is
> the over-the-wire vector the negative-control suite exists to test.
>
> **What changed.** The server no longer verifies a client's claim about a decision; it
> records the answer itself. See §7.3. **That closed the one-request form and nothing
> else** — the box above this one is what it did not close. Adding `request_id` to the
> snapshot projection is a BREAKING projection change under §10, so it landed **before**
> the C4 freeze, and every digest published before 2026-08-28 is void. All of them were
> recomputed with the OCF-1 reference canonicaliser and republished in §7.2 and §7.5.
> **The `confirm_token` of R-13 is *not* a projection change** — it is not in the
> snapshot, so every digest in §7.2 and §7.5 is unaffected, and all five were recomputed
> from scratch after R-13 landed and reproduce byte for byte.

Five messages — `sign_request`, `sign_respond_request`, `sign_response`,
`commit_request`, `commit_result` — plus two digested structures, `snapshot` and
`chain_entry`.

### 7.1 The snapshot projection

Fully specified in `signature.schema.json` `$defs.snapshot`. Every field always
present; `null` where it does not apply. It covers:

- report identity, `project`, `status`, **`revision`**, `title`, `total_usd_cents`;
- `policy_version` **and `policy_digest`** — the name *and* the content of the ruleset the
  verdict was computed under. `policy_digest` was added 2026-08-28 under R-33 and is the
  second BREAKING projection change; §7.6 is why, including the honest scope of the attack
  it closes;
- **`request_id`** — the sign request this snapshot was built for. A snapshot digest is
  meaningless outside the request that produced it: with `request_id` inside, a digest
  can never be presented against a different sign request, and one harvested from a
  dialog cannot be replayed into another commit. Added 2026-08-28 under R-1;
  §7.2 pins the same snapshot under a different `request_id` to show the digest moves;
- every line in **page order**, each with its ten value fields *and its ten-entry
  `provenance` map*;
- `receipt_sha256` — the real SHA-256 of the file bytes, so a signature cannot be
  carried onto a different file;
- the verdict: `blocking`, `warning`, and the identifying quadruple of each violation.

**The provenance map is inside the digest.** This is the hole a review round found:
the prior implementation digested a projection that excluded the source, in two
separate places —

- `countinghouse/src/erp.js:366` — `dayBookDigest = fnv1a(JSON.stringify(dayBook.map(e => [e.kind, e.label])))`, which drops `source` and `actor` from every entry;
- `countinghouse/src/erp.js:377-389` — `canonicalDigest`, whose line projection has no `createdBy`/`lastEditedBy` at all.

Under either, flipping a field from `agent` to `human` left the digest unchanged.
Grade: MEASURED, both readable in the spike today.

The verdict is inside the digest on purpose: if the policy moves between signing and
committing, the verdict moves, the digest moves, and the commit is refused — which is
what we want, because the human signed a report that was clean *under a named policy
version*. `message` and `fix` are excluded because they are prose derived from `code`,
`field` and values already digested.

### 7.2 Real digests (verified, not illustrative)

Over the snapshot in `signature.schema.json` `examples[0]` (**1570** canonical bytes —
1480 before `policy_digest` joined the projection, 1445 before `request_id` did).
**Recomputed and republished 2026-08-28, the second time**; every value published before
this republication is void. Two changes landed together and both move every row: ruling
**R-33** puts `policy_digest` inside the projection (§7.6), and the signed fixture's
`attendees` was repaired from 2 to 3 (§7.2a).

| what | digest |
| --- | --- |
| signed snapshot | `sha256:535bb82f4258b38583d017c48986954e9aabcdffb3e8ea16cfe60f9b3e8515ff` |
| amount 18640 → 8640, **consistent re-total** | `sha256:b4934bfc991a9b1022881407e8ca3e794b47a3e184c690208b765587c0cb4e93` |
| `provenance.amount` agent → human | `sha256:f5fd3e7adf420d48ec1fa8b6209258dd62ea33dfe0276a76616fe27ebe365c18` |
| line order reversed | `sha256:4b51c0c2fa22d5e822643f5e098e8260555358867784e6e884b235558d3fa7c4` |
| same report, different `request_id` | `sha256:5d55be339598b63ba0759f1dd05b5f97a7b102c38b36f62530dd746a7325f0d4` |
| **same version, swapped policy content** | `sha256:7237591a7a6ae6e40f20c79977cf4d89d1d01403b7ec6c9f334e18ed58ec91ff` |

Five different tampers, five different digests, all different from the signed one.
**The amount row is a *consistent* re-total** — `report.lines[0].amount_cents`,
`report.lines[0].usd_cents` and `report.total_usd_cents` all move together
(18640 → 8640, 22850 → 12850), which is the realistic attack — while the provenance flip
and the line reorder are single-field edits. The previous revision described the amount
row as a single edit; editing `amount_cents` alone, or `amount_cents` with `usd_cents`,
gives a digest that is not the published one, and a reviewer following that prose (this
is one `sha256` away) would have concluded our pinned digest was fabricated. The
`x-knownDigests` key is renamed `tampered_amount_consistent_retotal_18640_to_8640` and
names the three fields. The tampered snapshot is deliberately left internally
inconsistent in one further respect — its itemisation still sums to 18640 against an
amount of 8640 — and `tests/signature.test.mjs` should say so in the fixture, because
that inconsistency is not what the digest catches.

The provenance flip is the one a checksum over a projection without `source` would have
missed. The `request_id` row is what R-1 buys. **The last row moved no digest at all
until 2026-08-28** — it is the same report under the same policy *version name* with
different policy *content*, and it is what R-33 buys; see §7.6. **None of the five is
what defends against a commit with no human in the loop** — and neither, on the evidence
of §7's first box, is §7.3. The digest binds *what was signed*; it says nothing about
*who signed*, and no arrangement of these six rows can be made to say otherwise.

### 7.2a The signed fixture was not committable, and the repair was one integer

`signature.schema.json` `examples[0].snapshot` is the canonical *signed, clean* snapshot
this entire layer is built on. Until 2026-08-28 it carried `report.lines[0].attendees: 2`
against `amount_cents: 18640` — and `policy.schema.json` `examples[0]`, frozen in the
same directory, sets `limits_cents.meal_per_attendee` to **8000**. 18640 over 2 attendees
is **9320 per attendee**, so the frozen policy emits a **blocking `CAP_MEALS` (R05)** on
`ln_3` and the commit is **422 `E_NOT_CLEAN`** — while the snapshot's own verdict read
`{blocking: 0, violations: [], warning: 0}`. `violation.schema.json`'s
`x-invalidExamples` documented that identical violation: same code, same `rule_id` R05,
same `entity_id` `ln_3`, message *"$186.40 is above $80.00 per attendee for 2
attendees"*. **Two frozen contract files asserted opposite things about one line**, and
the snapshot every digest in §7.2 and §7.5 is taken over could not have been committed by
the system that produced it.

**The repair is `attendees` 2 → 3, and not the amount.** At three attendees the line is
6213 per attendee (18640 / 3), under the cap, and *nothing else in the fixture moves*:
the itemisation still sums to 18640 (14200 + 2240 + 2200), `usd_cents` is still 18640,
the report total is still 22850 = 18640 + 4210, and `violation.schema.json` `examples[1]`
still carries `observed: 18640` on `ln_3`. Moving the **amount** instead takes at least
four numbers with it, leaves the itemisation summing to an amount it no longer matches —
an R11 `ITEMIZATION_GAP` **warn**, which the verdict's `warning: 0` would then also
contradict — and collides with two further frozen fixtures keyed to 18640: the
consistent-re-total row in §7.2, and `eval-case.schema.json`'s
`neg-post-signature-tamper`, which writes `amount_cents: 8640` onto `ln_3`. One integer;
the arithmetic all still reconciles.

The two `x-invalidExamples` are **re-keyed off `ln_3`** to `ln_7` at $214.00, so no
reader can pair them with the signed snapshot again. The illustration is unchanged and
still works: 21400 over 2 attendees is 10700 against the 8000 cap, and 21400 over 3 is
7133, so *"3 attendees clears the cap"* remains true and remains the thing the schema
forbids the **product** from saying.

**Nothing checked this, which is why it survived three review rounds.** §11 gains
**check 3b**: run the frozen policy over the frozen snapshot and assert that the verdict
it produces equals the verdict the snapshot carries.

### 7.3 What the server records, and the rejection

**The server records the answer it received. It does not verify a client's claim about
one — and it does not witness a person.** Read that sentence as narrowly as it is
written; the box at the head of §7 says why. The
sign request is a server-held record with a state machine
(`signature.schema.json` `x-signRequestState`):

```
open ──respond(signed)──▶ answered(signed) ──commit──▶ committed
 │                                │
 ├──respond(declined)──▶ answered(declined)
 └──expiry──▶ expired ◀───────────┘
```

- **open** is created by the server in the same synchronous step that takes the report's
  sign lock (node **S12**). No client input creates it and none can move it.
- **answered** is entered *only* by `POST /api/sign/{request_id}/respond` arriving on an
  `open` record from the authenticated session that owns it. **That arrival is the whole
  admission test** — no nonce beyond the token below, no user-activation check, no
  `Sec-Fetch-*` gate, and nothing in it requires a browser or a person. The body
  (`sign_respond_request`) is **eight fields, all required, `additionalProperties:false`**:
  `schema`, `request_id`, `decision`, `reason`, `method`, `acknowledged_digest`,
  `acknowledged_revision`, `confirm_token`. It carries **neither `signed_by` nor
  `at`, and there is no key for them**: the server takes the signer from the **session
  cookie** and the time from the **server clock**. (`signed_by` was previously a free
  120-character client string — an agent could commit as anyone.) The server writes its
  own `sign_response` record and returns it. The machine is one-shot.

  > **HISTORICAL — corrected 2026-08-28, all sites landed. Nothing here is open, and no
  > seat should act on it.** An earlier `F4` acceptance predicate — and its restatements
  > in `GRAPH.md` and `charters/UX.md` — said the dialog POSTs a body carrying **"ONLY
  > `{decision, reason}`"**. That was an overshoot against this frozen shape: such a body
  > failed `required`, and carried no `acknowledged_digest` for `E_DIGEST_ACK_MISMATCH` to
  > check and no `confirm_token` for `/respond` to require. The true and narrower point
  > those predicates were reaching for is **"no `signed_by`, no `at`, and no key for
  > either"**, and that is what they now assert. `graph.json`, `PLAN.md` and `GRAPH.md`
  > carry the corrected **eight-field** wording byte-identically; `charters/UX.md` was the
  > last stale site and was reconciled the same day. **The flag to the `graph.json` owner
  > is discharged — do not re-raise it, and do not file a send-back on F4.** What survives
  > is the standing rule, not the incident: the body is **eight** fields, `schema`,
  > `request_id`, `decision`, `reason`, `method`, `acknowledged_digest`,
  > `acknowledged_revision`, `confirm_token`, under `additionalProperties: false`.
- **committed** requires state `answered` with decision `signed`. Anything else is
  **`E_NOT_SIGNED`, HTTP 409** — *except* a record answered `declined`, which is
  `E_DECLINED` and never `E_NOT_SIGNED`. See the disjointness note below.

**`commit_request` no longer carries a signature.** It is `{schema, request_id,
report_id}` and nothing else; the server looks up its own record. There is nothing left
for a client to forge. The revision and digest compared are the server's own, not
values the caller supplied.

Only then does the tamper check run: the server **rebuilds the snapshot from its own
state**, canonicalises under OCF-1, digests, and compares. Revision first, because it is
the cheap check. The exact rejection: **`E_SNAPSHOT_MISMATCH`, HTTP 409**, carrying
`expected_digest`, `actual_digest`, and `diff_paths`.

**The code table is `signature.schema.json` `x-rejectionCodes`, and that is how you cite
it. Do not write the count as a numeral** — it has gone stale three times already
(*eleven* under R-1, *twelve* under R-13, *thirteen* under R-33, and R-34 makes it
*fourteen*), and every document that hard-coded a number had to be chased. Derive it:
`Object.keys(x-rejectionCodes).length - 1`. The codes are `E_NOT_SIGNED`,
`E_SNAPSHOT_MISMATCH`, `E_REVISION_MISMATCH`, `E_DIGEST_ACK_MISMATCH`,
**`E_NO_CONFIRM_TOKEN`**, **`E_ALREADY_ANSWERED`**, `E_SIGN_REQUEST_UNKNOWN`,
`E_SIGN_REQUEST_EXPIRED`,
`E_SIGN_IN_PROGRESS`, `E_POLICY_VERSION_MOVED`, **`E_POLICY_DIGEST_MOVED`**,
`E_NOT_CLEAN`, `E_FORBIDDEN`,
`E_DECLINED`. Each entry records the **endpoint** that raises it, because three of them
— `E_DIGEST_ACK_MISMATCH`, `E_NO_CONFIRM_TOKEN` and `E_ALREADY_ANSWERED` — are raised at
`/respond` and not at commit, and a table that does not say so reads as if every code were
a commit-time check.

**No two codes may claim the same condition, and two of them did.** `E_NOT_SIGNED` (409)
listed *"it was `declined`"* among its conditions while `E_DECLINED` (200) said *"the
record is `answered` with decision `declined`"* — so a commit against a declined record
had **two contradictory correct answers**, and either implementation could have been
called conforming. Resolved in favour of `E_DECLINED`, which is the one with the right
status code for a non-error: the draft stays editable, the lock is released, the reason
the human gave is returned. `E_NOT_SIGNED` now covers exactly three conditions — still
`open`, already `committed`, or `expired` — and the server branches on `decision` before
it branches on `state`.

**And the dual holds too: no condition may claim ZERO codes — R-34.** The disjointness
rule was enforced in one direction only, and the gap it left was exactly one condition
wide. `x-signRequestState.answered` has always asserted *"a second respond on an
already-answered record is refused; the machine is one-shot"* — and **no code claimed
it**. `E_NOT_SIGNED` is commit-only; `E_SIGN_IN_PROGRESS` is every mutating *report*
route, not `/respond`. So the one rule this table states about itself was broken from
both sides at once. **`E_ALREADY_ANSWERED` (409, at `/respond`)** closes it.

The condition is not hypothetical, and the attack it exposes is **claimed here rather
than left for a reviewer to find**. *Decline-to-unlock:* an attacker holding the
`confirm_token` POSTs `decision:'declined'` before the human clicks; the human's genuine
click then arrives second and is refused with `E_ALREADY_ANSWERED`, and the commit
returns **200 `E_DECLINED`**. The human watches their own signature bounce.

**Severity, stated honestly and not inflated: this is a nuisance-grade denial, not a
forgery.** Nothing commits, nothing is attested, no false entry reaches the day book —
the attacker *cancels* a signature and cannot *manufacture* one; the ledger ends up
strictly emptier, not falser. And it needs the `confirm_token`, i.e. DOM read access,
which is a **strictly stronger precondition** than the cookie-only two-request forgery in
`survivingVector` — anyone able to run this can already run the worse one. It is written
down because a hole we can name is worth more than a claim we cannot defend, not because
it threatens the gate. Negative control **`neg-decline-to-unlock`**
(`eval-case.schema.json` `x-requiredCases`, `controlStatus: "enforced"`, red until R-34
ships); standing red-team target in `charters/C3.md`. Recovery is specified, not assumed:
the declined answer releases the sign lock, the draft stays editable, and the human opens
a **new** sign request — so F4's dialog must render `E_ALREADY_ANSWERED` as *"this
request was already answered — start a new one"*, never as a generic failure.

`E_DIGEST_ACK_MISMATCH` moves to the `/respond` endpoint, where it belongs, and its
rationale is corrected: it detects a client that echoed the wrong digest, and it has
**never** detected a substituted dialog. A substituted dialog renders content X and
echoes the server's digest D unchanged; the rebuild equals D; it passes. The echo
verifies only that the client can copy a number the server handed it. Say that — and note
that this is the same reason it does not fire against the surviving vector at the head of
§7, which echoes the digest correctly on purpose.

**Two negative controls live here, and they say different things.**

- **`neg-commit-without-human`** (N-15; `erp/contracts/eval-case.schema.json`
  `examples[0]`) runs the *one-request* forgery and asserts 409 `E_NOT_SIGNED`. It is a
  *genuine* control: `controlStatus: "enforced"`, red on the build as it stands, green
  only once S5 lands the state machine.
- **`neg-respond-without-click`** (`examples[1]`) runs the *two-request* forgery — the
  one at the head of §7 — and is `controlStatus: "known-open"`. **It commits today**, and
  the case carries that commit verbatim in `observedToday` rather than asserting a
  refusal that does not happen. The runner asserts the recorded outcome and fails if the
  behaviour moves in **either** direction without the record being updated, so a silent
  fix is caught as loudly as a silent regression, and the case is reported in its own row
  and never inside a green must-fail count. `graph.json`'s `S5` accept calls it **N-16**;
  `EVAL.md §7.2` already uses N-16 for the anonymous-read control, so the stable
  identifier is the **case id** and the N-number needs one ruling from EVAL's writer.

- **`neg-policy-content-swap`** (ruling R-33; §7.6) runs the same-version policy content
  swap and expects **409 `E_POLICY_DIGEST_MOVED`**. It is `controlStatus: "enforced"`
  and **red on the build as it stands**, because the code it expects does not exist yet.
  Its honest scope travels with it: the attack needs **write access to the served policy
  document**, which is arguably outside the declared N-04 curl-and-cookie model, so it is
  a *weaker* vector than `neg-respond-without-click`. Do not let it be written up as a
  break of that model.

`x-requiredCases` therefore now lists **ten** negative controls.

### 7.4 Freezing the write tools — what it does and does not do

**Does:**

0. *Underneath all three.* The sign request is a server-held record with a state
   machine, and commit refuses anything the server did not itself record as
   answered-and-signed (409 `E_NOT_SIGNED`). Layers 1–3 answer *"did the report
   change?"*. **Layer 0 answers exactly one question, and it is narrower than the one
   this list used to claim: "did a POST from the authenticated session reach
   `/api/sign/{request_id}/respond` before the commit?"** It does **not** answer *"did a
   human decide?"*, and R-13 deletes that sentence from this document. §7 and §7.3.
1. *In the page.* While a sign request is open, **every write tool** is revoked by
   aborting its `AbortController`. The **next** execute of any of them cannot happen.

   **The revoked set is computed, never hard-coded (ruling R-20).** It is exactly the
   tools whose **`annotations.readOnlyHint !== true`** on the surface being revoked, and
   both the implementation and every document describing it derive it that way. Evaluated
   against `S2-emp-draft-clean` as the surface stands today that predicate selects
   **seven** tools, **not five**: the previous revision of this sentence — and
   `signature.schema.json` `x-freeze.does[0]` with it — enumerated five names and
   silently omitted `submit_expense_report` and `open_expense_report`, which is precisely
   the failure mode a hard-coded list has. `graph.json` is the authority for the count,
   `G4 --assert-register` carries *"the five write tools"* in
   `kb/webmcp/RETRACTED.txt` as a literal scannable string, and this file states the rule.
2. *On the server.* The sign request is created **by the server**, and creating it and
   taking the report's sign lock are one synchronous step (node **S12**). Every mutating
   request for that `report_id` is then refused **HTTP 423 `E_SIGN_IN_PROGRESS`** until
   commit, decline or expiry.
3. *At commit.* Re-canonicalisation and digest comparison, per §7.3.

**Does not:**

- **Revocation does not cancel a call that is already executing.** From Chrome 153,
  aborting a tool's signal stops the *next* execute; it does not unwind the one
  already inside its handler. Grade: MEASURED — HANDOVER §3 rule 12 and
  `gatehouse/BUILD.md` rule 10. We must never write or say "revoking the tool blocks
  the write". Layer 1 alone therefore guarantees nothing; it is there so the agent
  sees an honest surface, not because it is a control.
- **It does not establish that a human decided.** A caller holding the session cookie
  can POST `/respond` itself, echoing the digest and revision the server issued moments
  earlier, and then commit; every rejection code in `erp/contracts/signature.schema.json` `x-rejectionCodes` was walked against that sequence
  and none fires — R-33's `E_POLICY_DIGEST_MOVED` included, because the policy did not
  move and this attack never needed it to. That is the surviving vector at the head of §7, it is open on the build
  as specified, and `neg-respond-without-click` records it as such.
- **Nothing here defends against script execution on the origin.** Anything that can
  run JavaScript on the page can call the same endpoints with the same cookie. The
  sign gate defends against an agent whose only reach is the tool surface. Say that;
  do not overclaim it. **And note what this sentence does not excuse:** it was offered
  as cover for the R-1 forgery in §7's BREAKING-change box, and it did not cover it —
  and it does not cover the surviving vector either. **Neither attack needs script
  execution; both need only a POST with the session cookie.**

**The load-bearing precondition.** Layer 2 closes the TOCTOU window *completely*
because taking the lock and computing the snapshot cannot be interleaved. Grade:
**OUR-ESTIMATE, true by construction of a single-process Node server with synchronous
state mutation inside each request handler.**

> **This breaks silently if node D1 deploys more than one instance.** A second
> instance reintroduces the race and **no test in this repository would notice.**
> D1's deploy notes must carry this, not only this file.

**Residual.** A write whose fetch reaches the server *before* the sign request is
created is inside the snapshot the human reads. That is correct — but it means the
human can be shown a report an agent modified 200 ms ago. What makes it visible is the
provenance map in the snapshot: the field says `agent`, and F2 renders it as such.

### 7.5 The hash chain (S7)

```
entry_digest = digest("outpocket/chain/1", {seq, at, kind, source, actor,
                                            label, detail, payload_digest, prev})
prev(0) = "sha256:" + "0"*64
```

`source` and `actor` are inside the canonical form — precisely what the spike's
`dayBookDigest` dropped.

**Both entries are published with their inputs, so both recompute.** Until 2026-08-28
only the two `entry_digest` values appeared here, and **`seq 0`'s input existed nowhere
in the corpus** — it was the one published digest in this project no reader could
reproduce, while this section called the pair *"verified"*. A brute force over three
dozen plausible shapes found nothing, because there was nothing to find. The word is not
withdrawn; **the input is published instead**, in `signature.schema.json` `x-knownChain`,
and both digests below are recomputed from those exact objects.

```
seq 0  boot    {seq:0, at:"2026-08-29T09:00:00.000Z", kind:"boot", source:"server",
                actor:"server", label:"day book opened", detail:"policy 2026-08.1",
                payload_digest:"sha256:b7ccc1ff…", prev:"sha256:" + "0"×64}
             → sha256:b0ab10c6375a5c6336ce72bab31ce273f1e017779855838146823515544369bb

seq 1  commit {seq:1, at:"2026-08-29T09:41:12.000Z", kind:"commit", source:"human",
                actor:"Chen Xiao", label:"signed & submitted RP-1018", detail:"CH-0001",
                payload_digest:<the §7.2 signed snapshot digest>, prev:<seq 0 above>}
             → sha256:a25d6903b187cdabd98f504cf8bfe86164a8138cc8c046cfeafafe7d18666b04
```

The boot entry's `payload_digest` is the OCF-1 digest of the policy document in force
when the day book opened — `policy.schema.json` `examples[0]` under `outpocket/policy/1`,
the same `b7ccc1ff…` that `policy-versions.json` pins for `2026-08.1`. That is not
decoration: it makes `seq 0` recomputable end to end from two files already in this
directory, and it anchors the chain root to the ruleset the day began under — the same
binding §7.6 puts inside the snapshot. `seq 1` moved twice: its `payload_digest` follows
the snapshot projection, and its `prev` follows `seq 0`'s publication.

### 7.6 What the signature binds about the *policy* — ruling R-33

**The snapshot bound the policy's NAME, not its CONTENT, and that was a hole.**
`policy_digest` sat in the **artifact**, *outside* the signed projection. So: serve a
policy document whose bytes differ from the pinned `2026-08.1` document while leaving the
`version` string at `"2026-08.1"`. The verdict computed under the swapped rules is
whatever the swapped rules say; the snapshot carries only the unchanged version string,
so its digest is unmoved; `E_POLICY_VERSION_MOVED` compares **names** and correctly
declines to fire; `E_SNAPSHOT_MISMATCH` compares a rebuild that is equally unmoved. **The
commit succeeds**, and the artifact attests *"clean under 2026-08.1"* against content
whose digest is no longer the pinned one. The corpus already ships a ready-made payload:
`sha256:17bc4b2d…` is `2026-08.1`'s own document with `transport_per_line` dropped to
5000 and the version string **not** bumped — it is in `policy-versions.json` as the trap
a careless implementer of the demo bump lands on (§8).

> **Honest scope, and do not inflate it.** The attack needs **write access to the served
> policy document**. That is arguably **outside** the declared N-04 threat model — curl,
> a session cookie, no browser — and an attacker with that reach alone cannot change what
> the server serves. It is a *weaker* vector than the surviving forgery at the head of §7,
> which needs nothing but the cookie. It is recorded and fixed anyway for two narrower
> reasons: (1) the same hole fires on an **honest operator** hot-editing a limit without
> bumping the version, which is the likeliest way it actually happens; (2) an attestation
> whose meaning can be changed after the fact by a party the attestation does not name is
> a defect in *what the artifact means*, independent of who can reach it. Anyone
> describing this as a break of the curl-and-cookie model is overclaiming.

**The fix is two halves and neither is sufficient alone.**

1. **`policy_digest` joins the signed snapshot projection.** A swap performed *between*
   the sign request and the commit now moves the rebuild's digest: **409
   `E_POLICY_DIGEST_MOVED`**, the thirteenth code (§7.3). This is a **BREAKING projection
   change** under §10 — the second this contract has taken — so every digest published
   before it is void; all of them are recomputed in §7.2 and §7.5, and the canonical byte
   count moves **1480 → 1570**.
2. **The version lock moves out of the test suite and into the server.** A swap performed
   *before* the sign request is not closed by (1) — the snapshot is simply built with the
   swapped digest and commits consistently. `policy.schema.json` `x-versionDiscipline`
   now requires the server to recompute the policy document's digest **at load** and
   refuse to serve one whose `(version, digest)` pair is not in `policy-versions.json`.
   As a test-only check the lock guarded the repository and nothing else.

What (1) buys even in the before-sign case is **forensic**: a stored signature records
which *rules* the human was judged against, not merely what that ruleset was called.
What none of it buys: a bound digest does not make the policy correct, and does not
establish that a human read it. An operator who bumps the version honestly can still
change every limit — that is demo beat ①, and the control on it is that the version
moves, the indicator moves, and the surface recompiles in front of the user.

### Compatibility

| change | verdict |
| --- | --- |
| new optional field on `commit_result.error` | additive, no bump |
| new rejection code | additive, no bump — consumers must treat unknown codes as "rejected" |
| **any** change to the snapshot projection field list | **BREAKING.** Bumps OCF, invalidates every stored digest, and requires a re-anchor entry in the chain. There is no compatible way to change what a signature means. *Exercised once, 2026-08-28, adding `request_id` — see §7 and §15.* |
| new `method` value in `sign_response` | **BREAKING** — and needs a real justification, since the one member is `click` |
| changing `kind` prefixes | **BREAKING** |
| moving a field of `sign_response` from server-set to client-set | **BREAKING, and refused.** `signed_by` and `at` are server-set. A contract in which the client authors any part of the record of a human decision is the defect R-1 repaired. |
| accepting a `signature` object on `commit_request` again | **BREAKING, and refused.** Same reason. Commit carries `request_id`; the server consults its own record. |

---

## 8. C5 — versioned policy document

**Produced by** S3 (owner I3), the port of `countinghouse/src/policy.js`.
**Consumed by** T1 S4 F5 E2 E5. Frozen by S10.

The only place a rule exists. No threshold is duplicated in a tool description, in page
copy, or in a prompt, so swapping the model cannot change what counts as valid.

Worked instance: `policy.schema.json` `examples[0]` — 19 rules `R01`–`R19`,
2458 canonical bytes,
digest `sha256:b7ccc1ff9fdadb66399f48b26617a53572dd793ac7c57af55d72929561965b38`
(verified against the file as written).

### Two required changes from the spike

1. **FX becomes integer micro-USD.** `countinghouse/src/policy.js:28` holds floats
   (`EUR: 1.09`, `JPY: 0.0067`). OCF-1 forbids non-integer numbers, so the port must
   emit `EUR: 1090000`, `JPY: 6700`, and convert as
   `usd_cents = round_half_up(amount_cents * micros / 1000000)`.
2. **Every `fix` string is rewritten** to pass the C1 fix lint.

### The agent view is a projection

`get_expense_policy` does **not** serve this document: 2458 canonical bytes is over
the 1500-character per-tool output budget (PUBLISHED, HANDOVER §3 rule 4). It serves
caps, thresholds, categories, currencies and window, plus `version` and the first 12
hex of `policy_digest`, so an agent or an eval can bind what it read to what is
enforced. `rules` is excluded from the projection.

### Version discipline (C5b)

**Every byte change requires a new `version`.** There is no editorial change to a
policy that is enforced on every write. `policy-versions.json` pins each version to
its OCF-1 digest; `tests/policy-lock.test.mjs` recomputes and asserts. A limit cannot
move without the version moving, the version cannot move without the document moving,
and a retired version cannot be reused for different content.

The demo bump is pinned in advance: **`2026-08.2`**, byte-identical to `2026-08.1`
except **three** values — `version` becomes `2026-08.2`, `effective_from` becomes
`2026-08-29`, and `limits_cents.transport_per_line` drops 15000 → 5000 — giving digest
`sha256:d024607ef7d8597e4d403f97c0ebe9fadf69a8196f6ba16cb60c10292df1f362` over **2457**
canonical bytes. (Changing the limit alone gives
`sha256:17bc4b2d1031b63e07a3983b067c8485316e8c16b53454e481680f65b7962e92`; if your
recomputation lands there, you did not bump the version.) `policy-versions.json`'s
`derivation` field always stated all three correctly; only this prose was wrong, and it
is the prose a reviewer runs `sha256` from.

Note the byte count: **2457, one less than `2026-08.1`'s 2458.** `version` and
`effective_from` keep their lengths and `15000` shortens to `5000`.
`policy-versions.json` published 2458 for both until 2026-08-28, which would have failed
`tests/policy-lock.test.mjs` on the demo policy — that is, on demo beat ① itself. Fixed.

This is what makes demo beat ① mechanical rather than theatrical.

### Compatibility

| change | verdict |
| --- | --- |
| any value change | **new `version` + new lock entry.** Not a schema bump. |
| new `limits_cents` key or new rule | schema minor bump **and** new version |
| removing a rule | **BREAKING** — stored violations reference `rule_id` |
| new currency in `fx_micros_per_unit_usd` | new version; additive for the schema |

---

## 9. C6 — eval case

**Produced by** E1 (owner C4). **Consumed by** E2 E3 E5 E6 E8 E10, E4 (L2, C1's rubric), X6.
Frozen by S10 in the same commit as the rest of `erp/contracts/`, where the schema
itself lives; the **cases** it validates live in `webmcp-eval-kit/evals/suites/`.

A case is data; the runner is generic. `driver` is `cdp` (real Chrome with
`--enable-features=WebMCP` for automation — MEASURED, HANDOVER §3 rule 16),
`in_page` (H3's fallback agent), or `static` (no browser; reads
`artifacts/tools.export.json`).

Every graded run is anchored to the **installed** Chrome major, **152** (ruling R-8):
we build against the current version and demand an upgrade only if something actually
breaks, and node **V0** asks about the installed major rather than asserting a floor.
The previous "Chrome 151+" was a floor nobody had measured against.

### The required-failure form

```json
{ "expect": {
    "outcome": "required_failure",
    "failure": {"mode":"server_rejects","http_status":409,"error_code":"E_SNAPSHOT_MISMATCH"},
    "assertions": [{"kind":"error_code","value":"E_SNAPSHOT_MISMATCH"}],
    "must_also": [
      {"kind":"tool_present","tool":"submit_expense_report"},
      {"kind":"chain_verifies","value":true}
    ] } }
```

`failure.mode` is one of `tool_absent`, `server_rejects`, `violation_returned`,
`tool_gone_midflight` — the last being the double lock at
`countinghouse/src/tools.js:370`, where a captured `execute` outlives its registration.

**`must_also` is required and non-empty, and this is the point of the design.** A
negative-control suite that only asserts *that something failed* is passed in full by
an application that errors on everything, and by a blank page. `must_also` is at least
one positive assertion that a working build satisfies and a broken build does not. The
runner refuses to score a suite where any `required_failure` case has an empty
`must_also`, and E6 fails the job rather than reporting a lower score.

Second guard, node **E10**: every negative control is also run against a deliberately
broken build in `evals/mutants/` and **must fail there**. A control that passes on
both builds is measuring nothing. (This node was numbered `E8` in the previous
revision of §12, colliding with lane E's blind grading run, which is the real `E8`.
Both now exist, distinctly, in `graph.json`.)

### The three pairing fields are part of the schema, not part of the prose

Every `required_failure` case carries **`pairsWith`**, **`provingNode`** and
**`brokenBy`**, and the schema's own `allOf` enforces it:

| field | meaning |
| --- | --- |
| `pairsWith` | the state id(s) or case id(s) this control pairs with. The runner **builds** the pairing map from this and fails if any state in `evals/surfaces.expected.json` has an empty pair set. It replaces `count(mustFail) >= count(capability states)` — `14 >= 7`, trivially true of the shipped suite in which two states had no control at all. |
| `provingNode` | the `graph.json` node id whose mechanism this case proves. If that node is cut the case is `not-runnable`, never `refused`. |
| `brokenBy` | **a one-line mutation that makes this case go green.** If you cannot write one, it is not a negative control. This is the string E10 executes. |

> **This was the most embarrassing defect left in the layer, and it was a ten-second
> check.** Until 2026-08-28 this schema had root `additionalProperties: false` over
> exactly eight permitted keys and **none of the three was among them**. Meanwhile
> `EVAL.md §7.1` said *"the suite file is invalid without them"*, E3's accept required
> *"every case declares `provingNode` and `brokenBy`"*, and **E10 — the only mechanical
> definition of a real negative control this project has — executes `brokenBy`.** So a
> conforming suite file could not carry the fields, and a file that carried them failed
> validation against the contract that must validate it. The whole non-vacuity mechanism
> was illegal under its own schema. Fixed, and verified by running `ajv` against fourteen
> mutations of the worked case: missing or null `brokenBy`, missing `provingNode`, missing
> or empty `pairsWith`, and an unknown root key all fail; the honest `not-runnable` and
> `known-open` shapes pass.

Two further fields make the honest cases expressible rather than deletable.
**`controlStatus`** is `enforced` (the default), `not-runnable` (no node produces the
mechanism — empty `pairsWith`, excluded from the pairing map, never counted as a
refusal), or **`known-open`** (*the attack succeeds on the build as specified and we
say so*). A `known-open` case must carry **`observedToday`**: what the attack actually
does, in plain words, with its HTTP status and what lands in the day book. The runner
asserts *that*, and fails if the behaviour moves in **either** direction without the
record being updated.

> **R-27 — the enum has three members and `refused` is not one of them.**
> `["enforced", "known-open", "not-runnable"]`, frozen. `refused` is EVAL.md §7's word for
> what a *run* did; it is never a value of this field. **S5's scheduled deviation
> `DEV-E3-eval-case-known-open` moves `examples[1].controlStatus` to `enforced`**, which is
> this enum's own word for "the refusal is now the required result". A gate written as
> `controlStatus === 'refused'` makes the frozen file fail its own schema — ajv:
> *"must be equal to one of the allowed values"* — and **§11 check 1 is wired into
> `npm test`, so that turns the suite red repo-wide on Day 3.** One word. Both this file's
> §11 and `contracts/eval-case.schema.json` now say so at the field itself.

Minimum case set is pinned in `x-requiredCases`: **ten** negative controls, four
capability, two accounting. The eighth is **`neg-commit-without-human`** (N-15, ruling
R-1), the ninth is **`neg-respond-without-click`** (ruling R-13), and the tenth is
**`neg-policy-content-swap`** (ruling R-33); all three are described in §7.3, and the
tenth in full in §7.6 — including the honest scope that must travel with it.

**What makes a control genuine, and what makes one honest.**
`neg-commit-without-human` is the reference *genuine* control: red on the build as it
stands, green only once node S5 lands the server-held sign-request state machine. A case
that is green before its mechanism exists is a *regression guard*, not a control, and the
two must never appear in the same table. `neg-respond-without-click` is the reference
*honest* control: its attack **commits today**, it is `known-open`, and it is reported in
its own row. Deleting a case because it does not refuse — or writing a hoped-for refusal
into its `expect` block and calling the table green — is worse than having no control at
all: it converts an open vector into a claimed closure.

**A float argument is a validation error, at any depth.** `$defs.tool_arg` restricts
every value under a step's `args` to the OCF-1 value space — object, array, string,
integer, boolean, null. Money crosses the tool boundary as **integer cents** in a
`<thing>_cents` argument; see §3.1 rule 3 for why this is a schema keyword and not a
style note.

### Compatibility

| change | verdict |
| --- | --- |
| new case file | additive |
| new `assertion.kind` | additive **for the schema**, but the runner must reject unknown kinds loudly rather than skipping — a silently skipped assertion is a false green |
| new `suite` | additive, no bump |
| new `failure.mode` | **BREAKING** for the runner |
| relaxing `must_also` minItems | **BREAKING**, and would void every published negative-control result |

---

## 10. Compatibility, in one rule

> Add optional things freely. Change the meaning of an existing thing never.
> Anything that alters what a stored digest covers, or what a closed enum a consumer
> switches on can contain, is breaking and needs a PM adjudication plus a `schema`
> major bump.

---

## 11. Mechanical checks

Every one of these must exist and be wired into `npm test` (node G3). None of them
is "looks good".

These are the contract layer's own checks. **The authoritative, runnable form of each
is the `accept` field of the node named in the last column** — `graph.json` owns those
strings and this table never carries a second copy of one. Every check must be wired
into `npm test`.

| # | what it asserts | fails when | node |
| --- | --- | --- | --- |
| 1 | `npm run contracts:check` | any `examples[*]` in a schema fails validation against its own schema, or any `x-invalidExamples[*].instance` **passes**. Note `violation.schema.json`'s banned-wording case is filed under `x-lintFailingExamples`, not here: it is schema-valid by construction and belongs to check 4 | **G6** |
| 2 | the canonical form | the canonicaliser fails any of the seven C0 vectors, `v6`/`v7` digests are equal, `$`-keys are rejected inside an `inputSchema` subtree, or `$`-keys are *accepted* outside one | **S11** |
| 3 | the policy version lock | the shipped policy's digest or `canonical_bytes` is not the triple recorded in `policy-versions.json` for its version — **and, under R-33, the check runs at server policy LOAD and not only in the test suite**: a document whose `(version, digest)` pair is absent must not be served (§7.6) | **S3** |
| 3b | **the frozen snapshot is committable under the frozen policy** | running `policy.schema.json` `examples[0]` over `signature.schema.json` `examples[0].snapshot` produces a verdict that differs from the `verdict` that snapshot carries — in `blocking`, in `warning`, or in the set of identifying quadruples. **This check did not exist and its absence is the whole of §7.2a**: the canonical signed snapshot declared `blocking: 0` on a line the frozen policy blocks with `CAP_MEALS`, and three review rounds re-hashed that snapshot without ever running the policy over it. Re-hashing a fixture proves the canonicaliser agrees with itself; it proves nothing about whether the fixture could exist | **S3**, hooked by **G6** |
| 4 | the fix lint | any `fix` string emitted by the policy engine contains a substring from `violation.schema.json` `x-fixLint.bannedSubstrings` | **S3**, hooked by **G4** |
| 5 | export determinism | two runs of the surface export are not byte-identical | **T5** |
| 6 | export shape | the export contains any `x-forbiddenKeys` key, a description over 500 bytes, an `outputSchema`, or a `consequentialHint`; or the **six** `x-requiredStates` counts do not match; or state ids are not the six canonical ids | **T5** |
| 7 | signature binding | tampering the amount, the provenance source, or the line order after signing does not produce HTTP 409 `E_SNAPSHOT_MISMATCH` | **S6** |
| 7b | **the `/respond` precondition** — *not* "the human decision" | a commit constructed with the session cookie and a real `request_id`, on a sign request that was **never answered**, does not return HTTP 409 `E_NOT_SIGNED`; or `signed_by`/`at` in the stored record can be influenced by anything in a request body. This is N-15, and it is the whole of what this check tests | **S5** |
| 7c | **the surviving vector, recorded** | `neg-respond-without-click` stops producing the outcome recorded in its `observedToday` — **in either direction.** Today that outcome is *a successful commit*; the check fails if it starts refusing without the record being updated just as loudly as if it started refusing and then stopped. This check exists so that an open hole cannot quietly become a claimed closure, and its result must never be counted inside a green must-fail total | **S5** |
| 8 | server-side authorization | the auditor session can write (expects 403 over the wire, not a hidden menu item) | **S2** |
| 9 | the atomic sign lock | a mutating endpoint called while a sign request is open does not return `423` | **S12** |
| 10 | contract ownership | `erp/contracts/` is touched in a branch owned by anyone other than L1 | **G5** |

Check 1 needs `ajv` (2020-12 build) as a devDependency — it is not installed today, and
neither is a `package-lock.json`, without which `npm ci` fails outright. **L0** carries
both; G6 is the first node that can run check 1.

---

## 12. Nodes this document argued for — now owned by `graph.json`

**The node table that used to sit here is deleted.** It listed four nodes with full
fields — id, lane, owner, inputs, outputs, accept, hours, cut rank, horizon — as if this
file were an authority. It is not, and the collisions were exactly what a private node
table produces:

- its `S10` (*report revision counter + atomic sign lock*, I3, 2 h) was **a different
  node** from `graph.json`'s `S10` (*freeze the I2/I3 contracts*, L1) — which is the
  second node on the critical path and the freeze that gates T1, S1 and S4. A seat
  dispatched "S10" would have got a mutex or a schema freeze depending on which file was
  open. It is now **S12**, in `graph.json`, with hard edges S1 → S12, S5 → S12, S12 → S6.
- its `E8` (*mutation check for the negative controls*, C4) collided with EVAL's `E8`
  (*C1 blind grading run*, C1). The mutation node is now **E10**; `E8` keeps its meaning
  as the blind run.
- `S11` and `G6` existed in no authority at all, so `agent_hours_total_A` was wrong by
  the whole of their hours and every figure derived from it moved.

All four now exist in `graph.json` with ids, owners, hours, cut ranks, edges and
`accept` predicates. Look them up there. What belongs here is only the **argument** for
why the contract layer needs each of them:

- **S11** — the OCF-1 canonicaliser and the seven-vector suite. Numbered last in lane S
  and **scheduled first** in it: every digest in the system depends on it, and asserting
  a canonical form without a passing vector suite is exactly the failure this document
  exists to prevent. It is also the *only* implementation (§3); the eval-kit's
  `canon.mjs` is a port of it.
- **S12** — the report revision counter and the atomic sign lock. S6 ("re-canonicalise
  and reject") closes the TOCTOU window only if the lock is taken atomically with
  snapshot creation. Without S12 that property is asserted, not built, and its check is
  a `curl` returning 423 — nothing in S5 or S6 would catch its absence.
- **G6** — the contracts conformance runner. Without it none of these eight files is
  enforced by anything.
- **E10** — the mutation check. `must_also` guards a suite against vacuity from the
  inside; E10 guards it from the outside. Both are needed and neither implies the other.

One more thing this section used to hide: **S5 is not a small node.** It now carries the
whole server-side decision state machine of §7.3 plus negative control N-15, and
`graph.json` funds it accordingly. Do not schedule it as if it were a dialog.

---

## 13. Where the ground truth forced a contradiction

1. **Float FX rates must go.** `countinghouse/src/policy.js:28` is incompatible with a
   canonical form two implementations can agree on. Integer micro-USD, and the port
   (S3) carries the migration. §8.
2. **The spike's two digests are both unfit**, for two independent reasons: 32-bit
   FNV-1a is a checksum, and both projections exclude the provenance source. Replaced
   wholesale rather than patched. §3.2, §7.1.
3. **`canonicalDigest` sorts lines; the snapshot must not.** Sorting is right for the
   drift-comparison use it was written for and wrong for signature binding. Both
   behaviours are needed; they are different functions. §3.1 rule 2.
4. **The HANDOVER's "measured" token counts are OUR-ESTIMATE**, exactly `ceil(bytes/4)`
   in all four cases. The byte counts are the measured part. §5.
5. **`fix` wording is a live defect, not a hypothetical.** The oracle string is in the
   repository today. §4.
6. **The policy has 19 rules, not 16.** `countinghouse/src/policy.js` emits **19**
   distinct violation codes — 15 line-level plus 4 report-level (`EMPTY_REPORT`,
   `PROJECT_SCOPE`, `PROJECT_INACTIVE`, `REPORT_REVIEW`) — and `policy.schema.json`
   `examples[0]` carries `R01`–`R19`, digest `sha256:b7ccc1ff…`, verified. "16" was
   carried out of HANDOVER §1 without re-counting; it matches nothing in the file — not
   the codes (19), not `LIMITS` (9 keys), not the push sites (23). S3's accept predicate
   in `graph.json` asserts 19 and enumerates `R01`–`R19`. Ruling R-7.
7. **The client cannot be trusted to report a human decision.** The spike has no server
   at all, so there was nothing to port here and nothing to contradict — but the first
   contract we wrote reproduced the shape anyway, with a client-authored `sign_response`.
   Recorded as a contradiction because it is the same class of error as items 2 and 5: a
   record of provenance produced by the party whose provenance is in question. §7.
8. **And moving the record server-side did not fix it, because the client still supplies
   the *event*.** R-1 took the *fields* away from the client — `signed_by` from the
   session cookie, `at` from the server clock — and left the *trigger* where it was: the
   arrival of a POST the client makes. So the same class of error survives one level
   down. There is no arrangement of an HTTP endpoint that distinguishes a person from a
   process holding that person's cookie, and no amount of schema work will produce one.
   **What we can honestly claim is a precondition, not a witness**, and §7's first box
   is the sentence. The `confirm_token` moves the bar without moving the class.

## 14. Open unknowns that can force a change here

Register keys are **`V0`–`V4`**, matching the V-lane nodes that answer them
(`PATHS.md §5`). The previous revision keyed them `T2`/`T3`/`T4`, which collide with
live lane-T **node** ids meaning *Port tools.js*, *Real registerTool*, *Absence
register* and *Description budget*.

| id | unknown | which contract moves |
| --- | --- | --- |
| V2 | does the built-in browser refresh the tool list mid-session | C2 — if not, `surface_digest` per state is still valid but the demo beat for T2's flips must move to the in-page driver |
| V3 | does an agent-initiated execute carry the page session cookie | C4, and **this is now the load-bearing unknown of the whole layer.** Two separate consequences, and the previous revision recorded only the first. **(a) Attribution:** if the cookie is *not* carried, the commit path needs a different carrier and §7 is rewritten, because the server takes `signed_by` from the session and a `/respond` arriving without one cannot be attributed at all. **(b) The forgery vector, which matters more:** if the cookie *is* carried, the agent can drive `/respond` itself — that is exactly §7's surviving vector — and the `confirm_token` holds only for as long as the agent cannot read the DOM. **A yes on V3 plus DOM read access reopens `neg-respond-without-click` for that caller, and no wording anywhere may upgrade to "a human decided" on either answer.** |
| V4 | does a suspended execute time out in the built-in browser | C4 — `expires_at` (300 s default) must be shorter than any client timeout, and F4 must degrade legibly when the execute is torn down under us |

Nodes V2–V4 answer these. **Contract C4 must not be treated as load-bearing for the
video until V3 returns.**

---

## 15. Changelog

| date (PT) | contract | change | adjudicated by |
| --- | --- | --- | --- |
| 2026-08-28 | all | initial draft, pre-freeze | — |
| **2026-08-28** | **C4, C1** | **The signed fixture was not committable under the frozen policy, and it is repaired (§7.2a).** `signature.schema.json` `examples[0].snapshot` carried `verdict {blocking:0, violations:[]}` on `ln_3` at 18640 cents for **2** attendees, which `policy.schema.json` `examples[0]` blocks with `CAP_MEALS` (R05) at 9320 against a `meal_per_attendee` of 8000 — and `violation.schema.json` `x-invalidExamples` documented that identical violation, same code, same `rule_id`, same `entity_id`. Two frozen contract files asserted opposite things about one line, and every digest in §7.2 and §7.5 was taken over a snapshot that returns **422 `E_NOT_CLEAN`**. **Repair: `attendees` 2 → 3** — 6213 per attendee, and *nothing else in the fixture moves*; moving the amount instead would have taken four numbers, broken the itemisation sum into an R11 warn the verdict also denies, and collided with the §7.2 re-total row and `neg-post-signature-tamper`. C1's two `x-invalidExamples` are **re-keyed off `ln_3`** to `ln_7` at $214.00, preserving the illustration (21400/2 = 10700 over cap; 21400/3 = 7133 under) while making the collision unrepeatable. **§11 gains check 3b** — run the frozen policy over the frozen snapshot and compare verdicts — because nothing did, which is why this survived three rounds of re-hashing. All five §7.2 digests, the byte count and both §7.5 chain entries recomputed. | — (internal contradiction) |
| **2026-08-28** | **C4, C5, C6** | **Ruling R-33 — the signature binds the policy's CONTENT, not its version name (§7.6). BREAKING projection change, the second.** `policy_digest` joins `$defs.snapshot`; it had sat in the **artifact**, outside the signed projection, so serving different policy content under an unchanged `"2026-08.1"` moved no digest, left `E_POLICY_VERSION_MOVED` (a **name** comparison) unable to fire, and let the artifact attest *"clean under 2026-08.1"* against content whose digest was not the pinned one — with `sha256:17bc4b2d…`, already in `policy-versions.json`, as a ready-made payload. **`E_POLICY_DIGEST_MOVED` (409)** added, taking the code table to **thirteen**. C5's `x-versionDiscipline` moves the version lock **out of the test suite and into server policy load**: a document whose `(version, digest)` pair is absent must not be served — that half closes the swap performed *before* a sign request, which the projection change alone does not. C6 gains **`neg-policy-content-swap`**, `enforced` and red on the build as it stands, taking `x-requiredCases` to **ten** negative controls. **Honest scope, recorded rather than hidden:** the attack needs **write access to the served policy**, arguably outside the declared N-04 curl-and-cookie model, so it is a *weaker* vector than `neg-respond-without-click`; it is fixed anyway because the same hole fires on an honest operator hot-editing a limit, and because an attestation whose meaning a party it does not name can change afterwards is a defect in what the artifact **means**. Byte count **1480 → 1570**; all five §7.2 digests plus a sixth row and both §7.5 chain entries recomputed. Rework: **S5**, **S3**, **S6**, **E3**, **F5**. | PM ruling R-33 |
| **2026-08-28** | **C6, C7** | **Ruling R-34 — the one condition with no code, and the attack it hid. CLAIMED AND CODED.** `x-signRequestState.answered` asserted *"a second respond on an already-answered record is refused; the machine is one-shot"* and **no entry in `x-rejectionCodes` claimed that condition** — while that table's own first rule is that no two entries may claim one condition. The rule was enforced in one direction only; the dual (**no condition may claim zero codes**) is now written into the table and holds both ways. **`E_ALREADY_ANSWERED` (409, at `/respond`)** added — the table's count is now cited as the table, never as a numeral, because it has gone stale at eleven, twelve and thirteen. The gap hid a working attack, **decline-to-unlock** (the audit's Invented D): an attacker holding the `confirm_token` declines first, the human's genuine click is then refused, and the commit returns 200 `E_DECLINED`. **Severity is stated honestly and must not be inflated — a NUISANCE-GRADE DENIAL, not a forgery:** nothing commits, nothing is attested, no false chain entry is written, the attacker cancels a signature and cannot produce one, and the precondition (DOM read access) is *strictly stronger* than the cookie-only vector it sits next to. Negative control **`neg-decline-to-unlock`** added, `enforced` and red until the code ships, taking `x-requiredCases` to **eleven** negative controls; standing red-team target added to `charters/C3.md`; recovery specified for **F4** (render it as *"already answered — start a new one"*). **NOT a projection change:** `x-rejectionCodes` and `x-requiredCases` are metadata outside every digested projection. VERIFIED BY EXECUTION, TWICE, AFTER THE EDIT: all 21 published values still reproduce from an independent OCF-1 written from §3 prose — 7/7 C0 vectors, the `2026-08.1` policy digest and its 2458 canonical bytes, the snapshot digest at **1570** bytes unchanged, and both chain entries with `seq 1.prev == seq 0.entry_digest`; ajv-2020: 6/6 compile, 17/17 examples valid, 9/9 `x-invalidExamples` rejected. Rework: **S5**, **F4**, **E3**, **E9**. | audit Invented D / confirmation NEW-5 |
| **2026-08-28** | **C4** | **Chain `seq 0` is published with its input, so the pair §7.5 calls *verified* actually recomputes.** Until now only the two `entry_digest` values appeared and `seq 0`'s input existed **nowhere in the corpus** — the one published digest in this project no reader could reproduce. The word is not withdrawn; the input is published, in `signature.schema.json` `x-knownChain`, and the boot entry's `payload_digest` is the OCF-1 policy digest `b7ccc1ff…`, so `seq 0` recomputes from two files already in this directory and the chain root is anchored to the ruleset the day began under. `seq 0` and `seq 1` both move. | — (unreproducible published value) |
| **2026-08-28** | prose only | **"Eight frozen schemas" is retired as dead vocabulary (§2).** Eight **contract files**, of which **six** are `*.schema.json` and validate instances; `canonical-vectors.json` and `policy-versions.json` are frozen **data**. `ajv` compiles six, not eight, and any check scoped by the word must say which count it means. | — (dead vocabulary) |
| **2026-08-28** | **C4** | **Ruling R-13 — the claim is narrowed to what is provable, and the surviving forgery is written down.** (a) The only sentence this layer may assert is *"a commit cannot be made without a POST from the authenticated session to `/api/sign/{request_id}/respond`"*; *"a commit cannot be made without a human decision"*, *"Layer 0 answers 'did a human decide?'"* and the `x-signRequestState.forgeryClosed` key are **deleted** and may not be restored. (b) What R-1 bought (no attacker-chosen name or timestamp) and what it cost (a **true attribution of a false event**, forensically indistinguishable from a real click) are both recorded, in `x-signRequestState.whatR1BoughtAndWhatItCost`. (c) **`confirm_token` added** to `sign_respond_request` — minted with the sign request, delivered **only** into the rendered dialog's DOM, never in a tool-call result or any `/api/sign/{id}` body; required by `/respond`; **`E_NO_CONFIRM_TOKEN` (403)** added, taking the code table to **twelve**. Defence in depth, **not** a proof: it raises cost, does not establish personhood, and its value is a direct function of open unknown **V3**. (d) Negative control **`neg-respond-without-click`** added, scripted as the attack, `controlStatus: "known-open"` — **it COMMITS today** and says so. **NOT a projection change**: `confirm_token` is not in the snapshot, and all five §7.2 digests plus the §7.5 chain entry were recomputed from scratch after this landed and reproduce byte for byte. Rework: **S5**, **F4** (read the token out of the dialog DOM), **E3**, **E9** (the `charters/C3.md` target-list rewrite), **D3**, **D5**. | PM ruling R-13 |
| **2026-08-28** | **C6** | **Recheck NEW-1 — the non-vacuity mechanism was illegal under this schema.** `pairsWith`, `provingNode` and `brokenBy` are added as root properties and **required on every `required_failure` case**; root `additionalProperties:false` had permitted eight keys and none of the three, while `EVAL.md §7.1` called a file without them invalid and E3/E10 execute them. `controlStatus` (`enforced` / `known-open` / `not-runnable`) and `observedToday` added so an honest open vector is expressible rather than deletable. `$defs.tool_arg` added: **a float tool argument is now a validation error at any depth** (recheck NEW-6), and the examples move to integer cents — `86.4 → 8640`, `212.4 → 21240`, `106.2 → 10620`. Two new `x-invalidExamples` (a missing `brokenBy`, a float argument) make both rules self-testing under §11 check 1. `x-requiredCases` is now **nine** negative controls. | PM ruling R-13, recheck NEW-1/NEW-6 |
| **2026-08-28** | **C4** | **Recheck NEW-5 — `E_NOT_SIGNED` (409) and `E_DECLINED` (200) both claimed the declined condition**, so a commit against a declined record had two contradictory correct answers. Resolved in favour of `E_DECLINED`; `E_NOT_SIGNED` now covers exactly `open`, already-`committed` and `expired`, and the server branches on `decision` before `state`. Every `x-rejectionCodes` entry gains an `endpoint` field, because `E_DIGEST_ACK_MISMATCH` and `E_NO_CONFIRM_TOKEN` are raised at `/respond`, not at commit. | — (internal contradiction) |
| **2026-08-28** | **C4** | **fact-conformance 23 / ruling R-20 — `x-freeze.does[0]` named exactly FIVE write tools** and omitted `submit_expense_report` and `open_expense_report`, so the frozen contract contradicted `graph.json`. The enumeration is deleted: the revoked set is **computed from `annotations.readOnlyHint !== true`, never hard-coded**, and evaluates to **seven** against `S2-emp-draft-clean` today. §7.4. | PM ruling R-20 |
| **2026-08-28** | prose only | **Ruling R-17 — the canonical directory is `erp/contracts/`, and the bare `contracts/` spelling is deleted from this document** (nine sites, plus the §2 index table, which now carries full paths). The eight contract files are **pre-existing planning artifacts**: no node produces, moves or copies them, `S10` freezes them where they are, and none of them appears in any node's `outputs`. §2. Also: C6's *schema* lives at `erp/contracts/eval-case.schema.json`; only the *cases* live in `webmcp-eval-kit`. §9. | PM ruling R-17 |
| **2026-08-28** | prose only | **Recheck NEW-3 — F4's predicate said the dialog POSTs "ONLY `{decision, reason}`"**, which contradicted the frozen `sign_respond_request` (eight required fields, `additionalProperties:false`). Corrected here; the true, narrower point is *"no `signed_by`, no `at`, and no key for either"*. §7.3. **CLOSED 2026-08-28: `graph.json`, `PLAN.md` and `GRAPH.md` carry the eight-field wording byte-identically, and `charters/UX.md` — the last stale site, which still told the UX seat to escalate a send-back on Day 1 and miscounted the schema at seven fields — was reconciled. The flag to the `graph.json` owner is discharged and §7.3's box is marked historical.** | — (contract/graph drift) |
| **2026-08-28** | **C4** | **BREAKING — ruling R-1, the sign gate.** `request_id` joins the snapshot projection; `commit_request` loses `signature` and reduces to `{schema, request_id, report_id}`; `sign_respond_request` is added as the body of `POST /api/sign/{request_id}/respond`; `sign_response` becomes the **server's** record, with `signed_by` from the session cookie, `at` from the server clock and a `state` field; `E_NOT_SIGNED` (409) is added, taking the code table to eleven; `x-signRequestState` documents `open → answered(signed\|declined) → committed \| expired`. **Every digest published before this date is void**; §7.2 and §7.5 are recomputed with the OCF-1 reference canonicaliser and republished, snapshot canonical bytes 1445 → 1480. Landed **pre-freeze**, as §10 requires. Rework: **S5** (state machine, N-15), **S6** (compare against the server's record), **S12**, **F4** (POST to `/respond`, render the server's record), **E3** (new control), **D3**. | PM ruling R-1 |
| **2026-08-28** | **C6** | Negative control **`neg-commit-without-human`** (N-15) added to `x-requiredCases`; the minimum set is now eight negative controls. State ids in every case and example changed to the six canonical ids of `PATHS.md §5`. | PM ruling R-1 / R-9 |
| **2026-08-28** | **C2** | Six states, not five — `S4-emp-submitted` was missing, and it is the state that motivates set equality. State ids changed to the canonical six. `distinct_tool_count` documented as 15 before T6 and 16 after (ruling R-9). The one-state worked instance moved from `examples` to `x-elidedExample`, because it could never have validated. | PM rulings R-9, fact-conformance 13/14 |
| **2026-08-28** | **C5b** | `2026-08.2` `canonical_bytes` corrected 2458 → **2457**. The demo policy is one byte shorter than `2026-08.1`; as published, `tests/policy-lock.test.mjs` would have failed on demo beat ①. | — (arithmetic) |
| **2026-08-28** | **C1** | The banned-`fix`-wording counter-example moved from `x-invalidExamples` to a new `x-lintFailingExamples`. It is schema-valid by construction, so §11 check 1 — which asserts every `x-invalidExamples` instance *fails* — was green on a false premise. Check 4 owns it. | — (internal inconsistency) |
| **2026-08-28** | **C6, C7, prose** | **Ruling R-32 — two ruling numbers were self-assigned twice, and `graph.json` is the authority, so the CONTRACTS-side pair is renumbered.** `graph.json` keeps **R-24** = *"D-17 has a home and a gate on Day 0"* and **R-30** = *"flag names, headless"*. In this document, `erp/contracts/*.json` and `charters/C3.md`, the policy-content binding moves **R-24 → R-33** and decline-to-unlock moves **R-30 → R-34**; every citation in those files is rewritten and no other file's numbering changes. **Ruling R-33 (N-numbers), same round:** `neg-policy-content-swap` keeps **N-20**, which `graph.json`'s E3 accept assigned and states it assigned; `neg-decline-to-unlock` becomes **N-21**; both now have their own row in `EVAL.md` §7.2. **`eval-case.schema.json` self-contradiction closed:** `x-requiredCases.note` claimed ELEVEN negative controls while the `negative_control` array held ten and did not contain `neg-decline-to-unlock` — the id is added and the note now cites `negative_control.length` instead of a numeral. **Nothing here moves an hour, an edge, a digest or a node**; `x-requiredCases` and `x-rejectionCodes` are metadata outside every digested projection. | sign-off 2026-08-28 defects 3, 4, 5 |
| **2026-08-28** | **C4, prose** | **Ruling R-34's other half — the surviving forgery's account gets its temporal qualifier, in every place the claim is made.** `signature.schema.json` `x-signRequestState.survivingVector` said flatly *"IT COMMITS"* and walked the rejection table with **two entries missing** — `E_NO_CONFIRM_TOKEN`, which is precisely the code that refuses the body it posts, and `E_ALREADY_ANSWERED`. Both are added to the walk, and the claim now reads **"before the `confirm_token` ships (`S5`, Day 3)"** wherever it appears: `survivingVector`, `provableClaim`, §7's head block here, `eval-case.schema.json` `examples[1].observedToday` (whose stale numeral *"twelve codes"* is replaced by a citation of the table, the very rule R-34 had just written), `EVAL.md` §7.2.1 and the N-16 row, and **`charters/C3.md` target 6** — which had ordered the red team to run the vector on **Day 5** and say so loudly if it refused, two days *after* S5 makes the refusal certain. C3 now reads that a 403 `E_NO_CONFIRM_TOKEN` on Day 5 is the schedule working and not a finding, and that the finding would be the commit still succeeding, or any document reading the refusal as proof the gate establishes personhood. | sign-off 2026-08-28 defect 6 |
| **2026-08-28** | prose only | §7.2's amount tamper re-described as a **consistent re-total** across three fields, not a single edit; the `x-knownDigests` key renamed accordingly. §8's demo-bump derivation re-described as **three** changes, not one. Both digests were always correct; both descriptions produced a mismatch for anyone who recomputed them, which is the first thing an expert reviewer does. | — (reproducibility) |
