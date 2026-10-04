# AGENTS.md

Workspace context for coding agents in this repository. Rules here take precedence over agent defaults. `readme.md` is the human-facing summary; this file is the operational contract. Detailed procedures live in `.kilo/skills/` — load only the skill that matches the task.

## What this project is

"Living Room, Levelled Up" — a beginner-friendly static guide for building an Alexa Home Theater over time, improving eero Wi-Fi coverage, and enabling compatible smart-home control. The audience is everyday users, not installers, and the tone stays practical, plain-spoken, and budget-aware.

Published site: <https://cloudshare360.github.io/Alexa-Home-Theater-on-Your-Fire-TV/> (deployed by `.github/workflows/pages.yml` on push to `main`).

## Stack and file map

No bundler, no runtime dependencies, no framework. Plain HTML/CSS/JavaScript. Node and `c8` are development-only test tools.

| Path | Role |
| --- | --- |
| `index.html` | Main guide: hero, starter recommendation, product sections, `#planner`, `#budget`, sources footer |
| `home-theater.html` | Illustrative room-layout diagrams for 2–5 speakers plus an optional Echo Sub |
| `styles.css` | All styling, including the responsive breakpoints asserted by tests (`900px`, `650px`, `390px`) |
| `planner.js` | Catalog loading, price rendering, live-offer handling, planner totals. The only file with a coverage gate |
| `pricing-config.js` | Sets `window.HOME_THEATER_PRICING = { apiUrl: "" }`; empty by default |
| `device-prices.csv` | Editable price table — one row per device or router pack |
| `device-prices.json` | Browser-consumed conversion of the CSV |
| `prices.json` | Per-key `source` labels, `previousAmount` values, and named `configurations` |
| `tests/planner.test.cjs` | Node built-in test runner + `vm` with a mocked DOM; 26 tests |
| `docs/sources/*.md` | Topic research notes (Amazon help, eero Built-in, Echo comparison, shopping costs, live-pricing architecture) |
| `docs/conversations/2026-10-04-home-theater-planning.md` | Chronological transcript of the planning conversation |
| `Temp-Images/`, `docs/sources/images/` | Local-only research assets, gitignored |
| `scripts/` | Untracked local tooling; leave untracked unless asked |

## Price data flow

1. `device-prices.csv` is the editable source. Columns: `Device Type,Device Name,Quantity,Price`.
2. `device-prices.json` is `{ "currency": "USD", "items": [...] }`. The conversion is **manual** — there is no generator script. Any CSV change must be mirrored here, or the planner and the site disagree.
3. `prices.json` holds metadata only: `prices[key].source`, optional `prices[key].previousAmount`, and `configurations` (named item lists rendered through `data-config-total-key` and `data-config-difference`). Current amounts live in `device-prices.json` only.
4. `planner.js` fetches both JSON files on load, joins rows to product keys by `deviceType` + `deviceName` + `quantity` + `quantityUnit`, converts to integer cents, and writes into `[data-current-price-key]`, `[data-previous-price-key]`, `[data-product-price-key]`, `[data-config-total-key]`, `[data-config-difference]`. Optional `data-price-quantity` and `data-price-suffix` attributes multiply amounts and append text.
5. `index.html` contains human-readable fallback literals inside those same elements. They are overwritten at runtime but tests assert some of them, so keep them equal to the catalog.
6. Product keys (`echo-dot-max`, `eero-pro-6e-2-pack`, `fire-tv-stick-4k-2nd-gen`, …) are shared across `planner.js` (`productCatalog` and `getProductKey`), `prices.json`, and the HTML `data-*-key` attributes. A new product must be registered in all three.
7. Router `quantity` values 1/2/3 mean routers inside a single bundle (1 Pack, 2 Pack, 3 Pack) — never a count of bundles being purchased.

Live offers are optional and currently dormant: `planner.js` uses `window.HOME_THEATER_PRICING.apiUrl` only when it is a non-empty HTTPS URL without embedded credentials, aborts after 10 seconds, accepts only offers retrieved within the last hour, and reuses a `localStorage` cache (`home-theater-amazon-offer-cache`, keyed by the endpoint URL) only within that hour. Otherwise it falls back to the static catalog.

## Invariants that break CI or tests

- `planner.js` must stay at 100% statements, branches, functions, and lines. `npm run test:coverage` and the Pages workflow both enforce it, so every new branch needs a test in `tests/planner.test.cjs`.
- The suite drives all 448 planner combinations (4 Fire TVs × 2 speaker models × 4 speaker counts × 7 router options × Echo Sub on/off) and compares exact totals with `device-prices.json`. Changing a catalog value or a selection mapping means updating the affected expectations.
- Tests read `index.html`, `home-theater.html`, `styles.css`, `prices.json`, `device-prices.json`, and `.github/workflows/pages.yml` as text. Copy edits, wording changes, CSS selector renames, and the workflow `cp` line are all covered by assertions.
- Any new runtime asset must be added to the `cp` line in `.github/workflows/pages.yml` and covered by a test assertion; otherwise it is never published.
- The planner result panel lists each selected device exactly once. Do not reintroduce a second summary element for the Fire TV or any other item; `tests/planner.test.cjs` asserts there is exactly one Fire TV row, that no `plan-tv` markup or styles remain, and that the total adds each device once.
- Static totals are integer cents. No floating-point currency arithmetic.

## Validation

Run before reporting work as done (`/verify` wraps this):

```sh
npm ci                  # once per fresh checkout
npm run test:coverage   # 26 tests + 100% coverage gate
node --check planner.js
node -e "for (const f of ['device-prices.json','prices.json']) JSON.parse(require('fs').readFileSync(f))"
git diff --check
```

For page-level behavior: `python3 -m http.server 8000` from the repo root, then drive the page with browser automation and compare rendered totals against `device-prices.json`. Prose-only edits need no build.

## Data and safety rules

- Never read, print, stage, or commit `.env`, anything in `Temp-Images/`, or `docs/sources/images/`. The cart screenshots contain Amazon account and delivery details. All are gitignored.
- Leave the untracked `scripts/` directory alone unless the user explicitly asks for it.
- Prices are user-supplied snapshots dated October 4, 2026 — not live checkout quotes. Never invent a missing price, silently "correct" a supplied one, or present amounts as current. When supplied values conflict, use the latest explicit value and state the discrepancy in `docs/sources/` and to the user.
- Keep compatibility claims conditional and scoped: model generation, region, and app version limits belong next to the claim. Never turn "compatible" into "guaranteed".
- Preserve the separation between Alexa Home Theater audio, eero mesh networking, and eero Built-in Echo extension. They are three capabilities with separate requirements.
- Do not scrape retail pages at runtime, add API credentials to the browser, or claim the site shows live prices while `pricing-config.js` is blank.
- Do not commit, push, publish, or open PRs unless explicitly asked.

## Content and conversation-log rules

- The user asks for every pasted conversation to be appended to `docs/conversations/2026-10-04-home-theater-planning.md` after each interaction, not batched at the end, until they say "done". Follow the existing `### User` / `### Assistant` structure, add new sections chronologically, and never include secrets or account/delivery details.
- Keep one topic per file under `docs/sources/`, cross-link related notes, and record where a claim came from: supplied material, a screenshot transcription, or independent verification.
- Update the directly related source note whenever a page, price, or capability changes.

## Current state (October 4, 2026)

Shipped: affordable starter framing (Fire TV Stick 4K 2nd Gen + 2 × Echo Dot Max = $197.97, optional eero Pro 6E 1-pack = $347.96), the interactive planner, `home-theater.html` layouts, a `#budget` section whose Dot Max and Studio cards follow the live planner selections, the CSV-derived catalog with `previousAmount` metadata, the dormant live-offer integration, and the CI coverage gate.

Verified baseline: `npm run test:coverage` passes 26 tests at 100% coverage on `planner.js`. The rendered planner was checked in Chromium: one Fire TV row, totals `$197.97` (2 × Dot Max + Fire TV Stick 4K) and `$1,119.93` (5 × Studio + Fire TV Cube + Echo Sub), and no errors with eero unchecked.

Open items for whoever continues:

1. **Confirm the eero Pro 7 3 Pack price.** The catalog, budget table, and planner all use $224.99 — identical to the 1 Pack — with no previous price, per the latest supplied table. The transcript earlier recorded $599.99 (previously $799.99). Ask the user before changing any value.
2. **Price-combination screenshots.** The transcript's last two entries say images are still forthcoming; six screenshots currently sit in `Temp-Images/`. Transcribe any new combinations into `docs/sources/home-theater-shopping-costs.md`, then into the catalog, HTML fallbacks, and tests.
3. **Live pricing** stays front-end only until a compliant backend exists. `pricing-config.js` `apiUrl` is intentionally empty.
4. **Deployed-build re-check.** The planner error that occurred when eero was unchecked is fixed and verified locally; confirm it again on the Pages URL after the next deployment completes.
5. **Unused catalog metadata.** `prices.json` still defines `dot-max-cart`, `studio-cart`, `four-dot-max-speakers`, `four-studio-speakers`, `five-dot-max`, and `five-studio`, which no longer render anywhere in the page. They are only covered by tests. Remove them together with their test assertions, or restore the historical cart section deliberately.
6. **Catalog conversion is manual.** If the catalog keeps growing, add a small CSV→JSON generator and a test for its parity.

## Skills

- `.kilo/skills/price-catalog-and-planner/SKILL.md` — prices, catalog, planner selections, bundles, totals, and their tests.
- `.kilo/skills/guide-content-and-sources/SKILL.md` — consumer-facing copy, comparisons, setup/Wi-Fi/smart-home advice, citations, transcript capture.
- `.kilo/skills/release-checks/SKILL.md` — Pages workflow, coverage gate, local preview, browser verification, deployment rules.

`.github/copilot-instructions.md` and `.github/skills/` point back to this file and these skills; keep `AGENTS.md` and `.kilo/skills/` canonical so the two assistants cannot drift.