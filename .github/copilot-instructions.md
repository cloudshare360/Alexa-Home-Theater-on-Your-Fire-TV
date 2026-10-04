# Repository context

The canonical agent context for this repository is [`AGENTS.md`](../AGENTS.md). Read it first; it defines the architecture, the price data flow, the invariants that break CI, the validation commands, the data-handling rules, and the current open items.

Task procedures live in `.kilo/skills/`, one file per task type:

- `.kilo/skills/price-catalog-and-planner/SKILL.md` — prices, catalog, planner selections, bundles, totals, and tests
- `.kilo/skills/guide-content-and-sources/SKILL.md` — consumer-facing copy, comparisons, setup/Wi-Fi/smart-home advice, citations, transcript capture
- `.kilo/skills/release-checks/SKILL.md` — Pages workflow, coverage gate, local preview, browser verification, deployment rules

Load only the skill that matches the task. `AGENTS.md` and `.kilo/skills/` are canonical; these Copilot files mirror them and must not restate the procedures.

Two rules that matter most for correctness: prices are a user-supplied October 4, 2026 snapshot and must never be invented, silently corrected, or presented as live, and `planner.js` must stay at 100% statement, branch, function, and line coverage because the Pages workflow gates deployment on it.
