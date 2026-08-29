# Decisions register — outpocket sprint A

Rulings of record. Created by node **L0** on Day 0 (2026-08-28); node **V6** appends its
unknowns rows to this same file on Day 2 and does not create it.

The D-17 row below is reproduced verbatim from `erp/RUNBOOK.md` §2, *The D-17 row, literally*.
`L0` accept gate (1) matches it with `^\|\s*D-17\s*\|[^\n]*human_hours_per_day\s*=\s*([0-9.]+)`,
requires the captured value to be `2.5` or `3.0`, and requires `erp/graph.json`
`capacity.human_hours_available` to equal that value x 5.5. If you change a digit here, change
`capacity.human_hours_available` in the same edit or the gate fails — which is what it is for.

D-17 was RULED by the user directly on 2026-08-28, before any seat was dispatched. L0 does not
decide it; L0 records it.

## Rulings

| ID | Date | Ruling | Consequence |
|---|---|---|---|
| D-17 | 2026-08-28 | human_hours_per_day = 3.0 | RULED by the user, directly, before any seat was dispatched. 3.0 x 5.5 days = 16.5 h available; 15.875 required; 0.625 h spare. NOTHING IS CUT — all 62 horizon-A nodes stay in scope. The 2.5 h/day branch and its 27-node amputation set survive in capacity.human_budget_sensitivity as a contingency, not as the plan of record. |
