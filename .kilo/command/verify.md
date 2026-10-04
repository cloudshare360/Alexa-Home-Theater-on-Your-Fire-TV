---
description: Run the enforced validation gate for this repository
---

Run the pre-report validation for this workspace from the repo root and summarize any failures. Follow AGENTS.md and .kilo/skills/release-checks/SKILL.md.

Steps, in order:

- If node_modules is missing, run npm ci first and say so.
- Run npm run test:coverage; report the test count and the coverage table row for planner.js.
- Run node --check planner.js.
- Parse device-prices.json and prices.json with node and report the result.
- Run git diff --check.

Then state explicitly whether planner.js is still at 100% statements, branches, functions, and lines. Report failures instead of fixing them unless the user asks for fixes.
