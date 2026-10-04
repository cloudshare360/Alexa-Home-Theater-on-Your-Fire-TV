---
name: release-checks
description: Use when touching the GitHub Pages workflow, the published asset list, coverage gates, local preview setup, browser verification of the planner, or deciding whether to deploy, push, or open a pull request.
---

# Release checks

## What ships

`.github/workflows/pages.yml` runs on pushes to `main` and on manual dispatch. It installs Node 24, runs `npm ci`, then `npm run test:coverage` — the job fails before deploy if `planner.js` drops below 100% statements, branches, functions, or lines. It then copies one explicit list into `_site/`:

```
index.html home-theater.html styles.css planner.js pricing-config.js prices.json device-prices.json
```

Anything not on that line is not published. Adding a runtime asset means editing the line and adding a test assertion for it, or the file will 404 on the live site while working locally.

## Before reporting work as done

```sh
npm ci                    # once per fresh checkout
npm run test:coverage     # 26 tests + 100% coverage gate
node --check planner.js
node -e "for (const f of ['device-prices.json','prices.json']) JSON.parse(require('fs').readFileSync(f))"
git diff --check
```

## Page-level verification

`fetch` of relative JSON paths means `file://` previews fail. Serve the repo root instead:

```sh
python3 -m http.server 8000
```

Then drive `http://localhost:8000/` with browser automation. Useful checks: the selected Fire TV price line, the result-panel breakdown, eero pack hints with and without the eero checkbox, planner totals against `device-prices.json`, and no horizontal overflow at the `900px`, `650px`, and `390px` breakpoints.

Local and deployed builds can differ: a fix in `planner.js` is not live until a push to `main` completes the workflow. When reporting a bug as fixed, say whether it was verified locally, on the Pages URL, or both. The eero-unchecked planner error fixed earlier still needs a re-check against the deployed site.

## Deployment rules

- Do not push, publish, or open PRs unless the user explicitly asks.
- Never stage `.env`, `Temp-Images/`, `docs/sources/images/`, or the untracked `scripts/` directory.
- The published site must not claim live pricing while `pricing-config.js` `apiUrl` is empty.
