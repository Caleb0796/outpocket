# outpocket

A WebMCP expense-reimbursement desk. The employee's own agent works inside the
employee's own authenticated session — no second front door, no second identity
system, no new credential holder.

> **Status: planning.** No product code yet. The build plan lives in
> [`erp/`](erp/) and is the single source of truth for execution.

## What this is

`outpocket` is a web application that registers a *state-dependent* set of
WebMCP tools on the page the employee is already logged into. A third-party
agent (ChatGPT's built-in browser, or Chrome with WebMCP enabled) picks those
tools up and drives the reimbursement flow — but the boundary is enforced on
the server, per request, against the session the human already holds.

Reimbursement is high-risk and carries personal responsibility. That is the
reason the human stays on the page rather than being replaced by a backend
integration.

## Repository layout

| Path | Contents |
| --- | --- |
| `erp/` | Build plan: work graph, agent-team charters, contracts, eval design, risk register |
| `src/` | Application source (not yet created) |
| `tests/` | Test suite (not yet created) |

## Related repositories

- `webmcp-dev-kit` — reusable WebMCP building blocks extracted from this product
- `webmcp-eval-kit` — evaluation harness used to grade this product

## License

MIT — see [LICENSE](LICENSE).
