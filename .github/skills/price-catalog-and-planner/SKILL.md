---
name: price-catalog-and-planner
description: Use when changing device prices, the price catalog, planner selections, bundle quantities, totals, or related tests.
---

# Price catalog and planner

Keep the data flow consistent:

- `device-prices.csv` is the editable table; `device-prices.json` is the runtime price catalog. Preserve exact device names, numeric prices, and router `quantityUnit: "Pack"` fields.
- `planner.js` maps supported HTML selections to catalog products and computes totals in integer cents. `prices.json` contains display/source metadata, previous prices, and example-cart configurations—not current price amounts.
- Product labels and options live in `index.html`; the Pages workflow must publish every runtime JSON file.

When editing:

1. Read the relevant CSV/JSON rows, selection mapping, rendering/calculation logic, and tests before changing anything.
2. Do not infer or silently "correct" user-provided prices. For conflicting values, use the latest explicit value and make the discrepancy clear.
3. Cover changed products and quantities with tests. For selection changes, assert both line items and totals; include router-pack and optional-sub combinations when relevant.
4. Validate CSV/JSON parity and run `npm run test:coverage`, `node --check planner.js`, JSON parsing, and `git diff --check`. Coverage must remain at 100% statements, branches, functions, and lines.
5. If browser tooling is available, exercise the actual page over HTTP and compare rendered totals against `device-prices.json`.

Do not add credentials, scrape retail pages, or claim supplied prices are current checkout offers.
