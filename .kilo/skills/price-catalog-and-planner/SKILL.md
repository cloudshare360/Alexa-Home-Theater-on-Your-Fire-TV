---
name: price-catalog-and-planner
description: Use when changing device prices, the CSV/JSON price catalog, prices.json metadata or configurations, planner selections, router pack bundles, totals, price rendering attributes in index.html, or the planner tests.
---

# Price catalog and planner

Prices reach the page through four coupled places. Change one without the others and the page, the planner, and the tests disagree.

## The chain

1. `device-prices.csv` — editable table, one row per device or router pack (`Device Type,Device Name,Quantity,Price`).
2. `device-prices.json` — `{ "currency": "USD", "items": [...] }`, hand-converted from the CSV. There is no generator script; mirror every CSV edit by hand.
3. `prices.json` — metadata only: `prices[key].source`, optional `prices[key].previousAmount`, and `configurations` (named item lists). It must not carry current amounts; `planner.js` ignores any `amount` there.
4. `planner.js` — `productCatalog` maps product keys to `deviceType`/`deviceName`/`quantity`/`quantityUnit`; `getProductKey` maps HTML `<option>`/radio values to keys; `renderStaticPrices` writes integer cents into the HTML data attributes.

## HTML contract

`index.html` holds readable fallback amounts inside the same elements the runtime overwrites:

| Attribute | Behaviour |
| --- | --- |
| `data-current-price-key` | Catalog amount; appends `data-price-suffix` text when present |
| `data-previous-price-key` | `previousAmount` from `prices.json`; left untouched when absent |
| `data-product-price-key` | Catalog amount × `data-price-quantity` (default 1) |
| `data-config-total-key` | Sum of a `configurations` entry |
| `data-config-difference` | `higherKey:lowerKey`, rendered as an absolute difference |

Keep those fallback literals equal to the catalog — `tests/planner.test.cjs` asserts several of them, including the eero Pro 7 3-pack cell.

## Router packs

Router `quantity` 1/2/3 is the number of routers in one bundle (1 Pack, 2 Pack, 3 Pack). It is never a count of bundles being purchased. Any new model needs all of `eero-<model>-{1,2,3}-pack` in `productCatalog`, `getProductKey`, the CSV, the JSON, `prices.json`, the planner `<select>`, and the HTML keys.

## Procedure

1. Read the CSV/JSON rows, the selection mapping, the rendering logic, and the tests before editing anything.
2. Never infer or silently "correct" a supplied price. If two supplied values conflict, use the latest explicit value, record the conflict in `docs/sources/home-theater-shopping-costs.md`, and tell the user. Known open conflict: eero Pro 7 3 Pack is $224.99 in the catalog while the transcript earlier recorded $599.99 (previously $799.99) — ask before changing.
3. Update, in the same change: CSV → JSON → `prices.json` metadata → HTML fallbacks → tests.
4. Cover every changed product and quantity with tests. For selection changes, assert line items *and* totals; include router-pack and Echo Sub combinations.
5. Keep `planner.js` at 100% statements, branches, functions, and lines. Any new branch needs a test in `tests/planner.test.cjs`; the mock-DOM helper `createPlanner` is where the new case goes.
6. Validate: `npm run test:coverage`, `node --check planner.js`, JSON parse of both price files, `git diff --check`. The 448-combination matrix (4 Fire TVs × 2 speaker models × 4 counts × 7 router options × sub on/off) must still pass.
7. When a runtime file is added or renamed, update the `cp` line in `.github/workflows/pages.yml`; the test suite asserts that line.
8. If browser tooling is available, exercise the real page over HTTP and compare rendered totals with `device-prices.json`.

## Hard limits

Do not add API credentials to the browser, scrape retail pages at runtime, or describe supplied amounts as current checkout offers. Prices are an October 4, 2026 snapshot. Live offers stay dormant while `pricing-config.js` `apiUrl` is empty.
