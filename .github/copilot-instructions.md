# Repository context

- The public site is static HTML/CSS/JavaScript with no runtime dependencies, deployed to GitHub Pages. There is no bundler; the Pages workflow copies public assets into `_site/`. Node and c8 are development-only test tools.
- `index.html`, `styles.css`, and `planner.js` are the website. `tests/planner.test.cjs` uses Node's built-in test runner and a mocked DOM.
- `device-prices.csv` is the editable price table and `device-prices.json` is its browser-consumed conversion. Keep rows, quantities, pack units, and prices synchronized. The planner reads current amounts from the JSON catalog.
- `prices.json` holds price-source labels, previous prices, and example-cart component mappings; do not use its removed/current `amount` values as a second source of truth. `pricing-config.js` configures optional live offers and is blank by default.
- Router quantity values 1/2/3 mean routers in a single bundle (1 Pack, 2 Pack, 3 Pack), not a count of bundles being purchased. Static totals use integer cents in `planner.js`.
- For planner and catalog changes, read the `price-catalog-and-planner` skill. For consumer-facing research/content changes, read the `guide-content-and-sources` skill. Load only the skill relevant to the task.
- Run `npm ci` and `npm run test:coverage` for the enforced 100% planner coverage; also run `node --check planner.js`, JSON parsing, and `git diff --check`. For page-level behavior, serve over HTTP and use browser automation when available.
- Update related source notes and the chronological conversation log when the user asks to preserve conversation content. Prices are supplied snapshots, not live checkout quotes; never invent missing values or overstate compatibility.
- Do not read, print, stage, or commit `.env` or local screenshot/account data. Preserve unrelated untracked files; in particular, do not stage the local `scripts/` directory unless the user explicitly asks.
- Do not publish or push unless explicitly requested. Keep changes focused and explain any unverified price conflict.
