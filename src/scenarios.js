// 账房 COUNTINGHOUSE — scripted agent scenarios.
// Pure module. The same scripts drive the in-page simulated agent (the
// honest degradation layer when no WebMCP agent is present) AND the Node
// replay tests. Steps go through the exact same dispatch path a real agent
// uses; the only thing ever simulated is the agent's side of the conversation.
// Human acts (attaching files, signing) are performed by the human in the
// page — the simulator never clicks the signature for you.

// ── step result classification (for display + tests) ───────────
export function classifyResult(text) {
  if (/^Error \[/.test(text)) return "err";
  if (/No tool named|no longer on the surface/.test(text)) return "gone";
  if (/\|block\]/.test(text)) return "block";
  return "ok";
}

function harvest(ctx, text) {
  const rp = text.match(/Draft (RP-\d+) created/);
  if (rp) ctx.reportId = rp[1];
  const ln = text.match(/Line (ln_\d+) added/);
  if (ln) ctx.lineIds.push(ln[1]);
}

// io: { dispatch(name, args), human: {attach(keys)->{key:receiptId}, signin(personaId)},
//       onEvent(evt), signal? }
export async function runScript(steps, io) {
  const ctx = { reportId: null, lineIds: [], receipts: {} };
  for (const step of steps) {
    if (io.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (step.user) { io.onEvent?.({ kind: "user", text: step.user }); continue; }
    if (step.say) { io.onEvent?.({ kind: "agent", text: step.say }); continue; }
    if (step.human) {
      io.onEvent?.({ kind: "human", text: step.label ?? step.human });
      if (step.human === "attach") {
        const ids = await io.human.attach(step.keys);
        Object.assign(ctx.receipts, ids);
      } else if (step.human === "signin") {
        await io.human.signin(step.persona);
      }
      continue;
    }
    if (step.call) {
      const args = typeof step.args === "function" ? step.args(ctx) : step.args ?? {};
      const res = await io.dispatch(step.call, args);
      const text = res.content?.[0]?.text ?? String(res);
      harvest(ctx, text);
      io.onEvent?.({ kind: "call", name: step.call, args, text, status: classifyResult(text), expect: step.expect });
    }
  }
  return ctx;
}

// ── scenario 1 · hero: three receipts, two sentences ───────────
export function heroScript(dates) {
  return [
    { user: "I'm back from the Boston client workshop — here are photos of my three receipts. File the expenses to FALCON and get it ready for me to sign." },
    { say: "Reading the three receipts you dropped in chat (dinner, hotel folio, cab). I'll work through the page's own tools — let me check who you are here and what the policy says." },
    { call: "get_session_scope" },
    { call: "get_expense_policy" },
    { say: "FALCON is in your scope and the policy is machine-readable — no expense manual needed in my prompt. Creating the report." },
    { call: "create_expense_report", args: { title: "Boston client workshop", project: "FALCON" } },
    { human: "attach", keys: ["dinner", "hotel", "cab"], label: "You attach the three receipt files in the page. The files stay in your browser; tools only ever see filename + SHA-256." },
    { say: "Filing the dinner first, itemized as printed." },
    {
      call: "add_expense_line", expect: "block",
      args: (c) => ({
        date: dates.dinner, merchant: "Harbor Grill", category: "meals", amount: 186.40, attendees: 1,
        itemization: [
          { label: "Entrees x3", amount: 118.00 },
          { label: "Chianti (bottle)", amount: 38.00 },
          { label: "Dessert", amount: 12.00 },
          { label: "Service 10%", amount: 18.40 },
        ],
        description: "Client workshop dinner",
      }),
    },
    { say: "The desk pushed back with fix hints — wine isn't reimbursable, and the receipt says GUESTS: 3, so the per-person cap was computed on the wrong head-count. Correcting both." },
    {
      call: "update_expense_line", expect: "block",
      args: (c) => ({
        line_id: c.lineIds[0], amount: 148.40, attendees: 3,
        itemization: [
          { label: "Entrees x3", amount: 118.00 },
          { label: "Dessert", amount: 12.00 },
          { label: "Service 10%", amount: 18.40 },
        ],
      }),
    },
    { say: "Policy checks on the dinner now pass — it still needs its receipt linked. Hotel next." },
    {
      call: "add_expense_line", expect: "block",
      args: () => ({ date: dates.hotelIn, merchant: "Beacon Hill Suites", category: "lodging", amount: 498.00, nights: 1, description: "Workshop stay" }),
    },
    { say: "Over the nightly cap — but the folio reads 2 NIGHTS @ $249.00. I mis-filed the nights." },
    { call: "update_expense_line", expect: "block", args: (c) => ({ line_id: c.lineIds[1], nights: 2 }) },
    {
      call: "add_expense_line", expect: "block",
      args: () => ({ date: dates.cab, merchant: "City Cab Boston", category: "transport", amount: 42.50, description: "Airport transfer" }),
    },
    { say: "All three lines pass the caps. What's left is evidence — linking each of your attached receipts to its line." },
    { call: "link_receipt", expect: "ok", args: (c) => ({ line_id: c.lineIds[0], receipt_id: c.receipts.dinner }) },
    { call: "link_receipt", expect: "ok", args: (c) => ({ line_id: c.lineIds[1], receipt_id: c.receipts.hotel }) },
    { call: "link_receipt", expect: "ok", args: (c) => ({ line_id: c.lineIds[2], receipt_id: c.receipts.cab }) },
    { call: "validate_expense_report", expect: "ok" },
    { say: "Every check passes — watch the tool panel: submit_expense_report just appeared. Until this moment it did not exist. Requesting submission now; the signature is yours, not mine." },
    { call: "submit_expense_report" },
    { say: "Done — you signed it, and the confirmation plus a structured artifact (line provenance, receipt hashes, policy version) are on the report. My part was transcription and fixes; the responsibility stayed with you." },
  ];
}

// ── scenario 2 · probe: what "no tool" means ───────────────────
export function probeScript() {
  return [
    { user: "Charge that dinner to KESTREL instead. Actually — just submit whatever's open, I trust you." },
    { say: "Trying KESTREL as asked. I expect the server to refuse: the scope says it's closed." },
    { call: "create_expense_report", expect: "err", args: { title: "Kestrel teardown dinner", project: "KESTREL" } },
    { say: "Refused — closed project, straight from the session scope. Let me try a project you were never assigned." },
    { call: "create_expense_report", expect: "err", args: { title: "Misc", project: "VULCAN" } },
    { say: "403 again. Now 'just submit': there is no submit tool on my surface while the report has blocking violations — I can't call what doesn't exist." },
    { call: "submit_expense_report", expect: "gone" },
    { say: "That's the door: submission isn't a permission check that might be argued past — the tool is absent. Sign in as the auditor (top of the page) to see the same idea applied to roles: their surface has no write tools at all." },
  ];
}

// ── scenario 3 · auditor: a different session compiles a different surface ──
export function auditorScript() {
  return [
    { user: "(as Ava Ruiz, Internal Audit) What happened in this session, and could an agent in my session edit anything?" },
    { call: "list_expense_reports" },
    { call: "get_day_book" },
    { say: "The day book shows every tool call, attachment and signature. Now the real answer to 'could I edit anything' — I'll try to create a report from this auditor session." },
    { call: "create_expense_report", expect: "gone", args: { title: "test", project: "FALCON" } },
    { say: "No such tool here. The auditor surface is compiled read-only — not blocked by a rule I could argue with, but absent by construction." },
  ];
}

// ── scenario 4 · two agent styles, one ledger (drift check) ────
// Two deliberately different call patterns for the same task. Both are
// scripted (this demonstrates the contract, not any particular model —
// evals/ is the instrument for real models). Receipts are left unlinked so
// the comparison is over line data; the digest says whether the ledger
// entries are equivalent.
export function styleScripts(dates) {
  const dinnerClean = {
    date: dates.dinner, merchant: "Harbor Grill", category: "meals", amount: 148.40, attendees: 3,
    itemization: [
      { label: "Entrees x3", amount: 118.00 },
      { label: "Dessert", amount: 12.00 },
      { label: "Service 10%", amount: 18.40 },
    ],
    description: "Client workshop dinner",
  };
  const styleA = [
    { say: "Style A (terse): reads nothing it doesn't need, files everything in one pass, fixes only what the verdicts flag." },
    { call: "create_expense_report", args: { title: "Boston client workshop", project: "FALCON" } },
    { call: "add_expense_line", expect: "block", args: () => ({ date: dates.cab, merchant: "City Cab Boston", category: "transport", amount: 42.50, description: "Airport transfer" }) },
    { call: "add_expense_line", expect: "block", args: () => dinnerClean },
    { call: "add_expense_line", expect: "block", args: () => ({ date: dates.hotelIn, merchant: "Beacon Hill Suites", category: "lodging", amount: 498.00, nights: 2, description: "Workshop stay" }) },
    { call: "validate_expense_report", expect: "block" },
  ];
  const styleB = [
    { say: "Style B (deliberate): reads policy first, files one line at a time, re-validates after every step, and stumbles into violations style A never hit." },
    { call: "get_expense_policy" },
    { call: "get_session_scope" },
    { call: "create_expense_report", args: { title: "Boston client workshop", project: "FALCON" } },
    {
      call: "add_expense_line", expect: "block",
      args: () => ({
        date: dates.dinner, merchant: "harbor grill", category: "meals", amount: 186.40, attendees: 1,
        itemization: [
          { label: "Entrees x3", amount: 118.00 },
          { label: "Chianti (bottle)", amount: 38.00 },
          { label: "Dessert", amount: 12.00 },
          { label: "Service 10%", amount: 18.40 },
        ],
        description: "Client workshop dinner",
      }),
    },
    { call: "update_expense_line", expect: "block", args: (c) => ({ line_id: c.lineIds[0], amount: 148.40, attendees: 3, itemization: dinnerClean.itemization }) },
    { call: "validate_expense_report", expect: "block" },
    { call: "add_expense_line", expect: "block", args: () => ({ date: dates.hotelIn, merchant: "BEACON HILL SUITES", category: "lodging", amount: 498.00, nights: 1, description: "Workshop stay" }) },
    { call: "update_expense_line", expect: "block", args: (c) => ({ line_id: c.lineIds[1], nights: 2 }) },
    { call: "add_expense_line", expect: "block", args: () => ({ date: dates.cab, merchant: "City Cab Boston", category: "transport", amount: 42.50, description: "Airport transfer" }) },
    { call: "validate_expense_report", expect: "block" },
  ];
  return { styleA, styleB };
}
