---
name: price-catalog-and-planner
description: Use when changing device prices, the price catalog, planner selections, bundle quantities, totals, or related tests.
---

Read [`../../.kilo/skills/price-catalog-and-planner/SKILL.md`](../../.kilo/skills/price-catalog-and-planner/SKILL.md) and follow it. That file is canonical for this repository; do not duplicate its rules here.

Quick orientation: `device-prices.csv` is the editable table, `device-prices.json` is its hand-maintained browser conversion, `prices.json` holds only `source` labels, `previousAmount` values, and named `configurations`, and `planner.js` renders all of it into the `data-*-key` elements in `index.html`. Update the CSV, both JSON files, the HTML fallbacks, and `tests/planner.test.cjs` together, then run `npm run test:coverage`, which must stay at 100% for `planner.js`.
