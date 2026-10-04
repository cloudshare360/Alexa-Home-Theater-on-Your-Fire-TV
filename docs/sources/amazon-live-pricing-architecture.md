# Amazon Live Pricing: Architecture and Requirements

This document records the planned and partially implemented approach for showing current Amazon offer data in the static home-theater planner. The browser-side integration is in place, but it remains inactive until a compliant server-side endpoint is deployed and configured.

## Recommended data source

Use Amazon's official **Creators API** for Amazon product and offer information, subject to current program eligibility and API terms:

- [Creators API documentation](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/)
- [PA-API 5 deprecation and migration information](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation)
- [GetItems using cURL](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/get-started/using-curl)
- [OffersV2 resource](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/resources/offersV2)
- [API rate limits](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/api-rates)

The API is hosted by Amazon but is **not anonymous or credential-free**. The official documentation identifies the host as `https://creatorsapi.amazon` and an example product lookup as `POST /catalog/v1/getItems`. Verify current endpoints, request formats, resources, and requirements in the official documentation before deployment.

## Suggested architecture

```text
GitHub Pages planner (public browser)
        |
        | HTTPS request for approved product identifiers
        v
Small serverless price endpoint (AWS Lambda + API Gateway, or equivalent)
        |
        | OAuth-authenticated Creators API request
        v
Amazon Creators API
        |
        v
Sanitized offer data returned to the planner
```

For a simple display of current offers, the serverless endpoint can fetch and briefly cache the data; a database and scheduled polling are not required. Add EventBridge and DynamoDB (or equivalent) only if the project later needs scheduled snapshots, price history, or price-drop alerts:

```text
EventBridge schedule -> Lambda -> Creators API -> DynamoDB price history
                                                    |
Planner -> API Gateway -> current/last-saved offer -+
```

GitHub Pages is static hosting and cannot securely store OAuth client secrets. The browser must never call Amazon with private credentials. Keep credentials in a server-side secret store, restrict the endpoint to the required product identifiers and response fields, and configure CORS for the published site origin.

## Prerequisites

Before implementing a live connection:

1. Confirm eligibility for the Amazon Associates/Creators API program in the target marketplace.
2. Create or obtain the required API credentials and partner/associate tag through Amazon's official process.
3. Identify the exact product ASINs and marketplace for each planner item. Do not guess ASINs from product names.
4. Confirm approved product-data usage, attribution, price display, caching/refresh rules, and disclosure requirements in current program terms.
5. Deploy a server-side endpoint and store OAuth credentials in a managed secret store, never in this repository, `.env` committed to Git, client-side JavaScript, or a public Pages artifact.
6. Decide how the UI represents missing, stale, unavailable, or API-error prices. Do not show a stale or failed lookup as a successful live quote.

An illustrative `GetItems` request in the supplied research includes ASIN identifiers, marketplace, partner tag, and resources such as `itemInfo.title` and `offersV2.listings`. The exact schema and authentication signature must follow current official documentation; treat any snippets in research notes as illustrative, not copy-ready code.

## What the API can provide

The supplied API research says product and offer data may include title, ASIN, images, current offers, price, list price or savings, availability, merchant, Buy Box status, and deal information. The `OffersV2` resource documentation describes offer price, savings, availability, merchant information, and Buy Box status. Request only fields the UI needs, and check the current resource catalog and data-use rules.

## Price accuracy and personalization

An API offer price is not necessarily the exact price a particular visitor sees at checkout. The supplied Amazon documentation notes that returned price information is based on a default in-marketplace shipping address and can differ from a shopper's account-, location-, delivery-, seller-, or cart-specific price.

The planner should therefore label values as an Amazon-reported offer with a retrieval time, not promise a ZIP-specific or account-specific checkout price. Do not imply that the API provides price history unless a separate permitted history source has been implemented.

## Rate limits and caching

The supplied research reports an initial limit of up to **1 request per second and 8,640 requests per day for the first 30 days**, with later limits related to shipped-item revenue and a documented maximum of **10 requests per second**. Limits can change and may vary by account. Confirm the current limits and eligibility in the official [rate limits documentation](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/api-rates) before launch.

For a small public planner:

- Cache successful responses server-side for a short, terms-compliant period.
- The Creators API documentation lists a one-hour cache time for Offers data. The browser fallback therefore rejects and removes cached offers once their `retrievedAt` timestamp is one hour old.
- Avoid one Amazon request per visitor page load.
- Refresh only the small catalog of supported products.
- Respect rate-limit responses, use bounded retries with backoff, and return a clear unavailable state on failure.
- Do not collect or retain visitor Amazon account, delivery-address, or cart information.

The stated API limits alone are not a guarantee that a particular application or polling frequency is permitted. Follow the current terms and account-specific quotas. Browser-local storage is only a temporary outage fallback; it is not a shared cache or price-history database.

## Optional price tracking

If price history and alerts become a goal, this is a separate feature from live product lookup. It would need scheduled collection, durable storage, retention and deletion rules, rate-budget management, a history endpoint, and alert delivery. Compare the costs, terms, coverage, and data rights of an official Amazon API and permitted third-party providers before building it. Do not scrape Amazon pages as a shortcut around API access or terms.

## Current project status

- The planner supports live-price responses from a configured HTTPS endpoint. The endpoint URL is set in `pricing-config.js`; it is blank by default.
- The browser expects JSON shaped as `{"prices":{"echo-dot-max":{"amount":79.99,"currency":"USD","retrievedAt":"2026-01-01T12:00:00Z"}}}`. Keys must match the planner's supported product keys, and the price must be USD with a valid ISO timestamp. `retrievedAt` must be the actual Creators API offer retrieval time, not when a cached backend response was served. The endpoint must return only verified, approved products.
- Supported response keys: `fire-tv-cube-3rd-gen`, `fire-tv-stick-4k-max-2nd-gen`, `fire-tv-stick-4k-2nd-gen`, `fire-tv-stick-4k-plus`, `echo-dot-max`, `echo-studio-2025`, `echo-sub`, and `eero-pro-6e-{1,2,3}-pack` / `eero-pro-7-{1,2,3}-pack`. Router quantities represent the bundle pack size, not the quantity of separate packs purchased.
- The page never calls Amazon directly and contains no Amazon API credentials. A backend must handle Creators API authentication, product approval, throttling, and any shared cache.
- On endpoint failure, the browser may use an offer previously returned by the endpoint, clearly labeled as cached and only while it is less than one hour old. Otherwise, it keeps the supplied cart-example price, or shows that no price is available.
- No runtime Amazon-page crawler is used. The user chose the last valid API offer as the fallback; automated Amazon-page crawling is not an approved workaround for API failures or access controls.
- Current static product prices come from `device-prices.json`, the JSON conversion of `device-prices.csv`. The planner matches each product and router pack to this catalog for product cards and selected totals. `prices.json` retains source labels, previous prices, and the example cart component mappings.
- The Pages workflow publishes `pricing-config.js`, `prices.json`, and `device-prices.json` with the planner files. After a compliant endpoint is deployed, set its public URL in `pricing-config.js`. Do not put credentials or admin tokens there.
- No API credentials, approved product ASINs, or endpoint URL have been added. The user selected front-end integration only for now; serverless backend deployment remains a separate step.
