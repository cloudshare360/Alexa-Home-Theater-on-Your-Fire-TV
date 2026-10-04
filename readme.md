# Living Room, Levelled Up

A beginner-friendly guide to building an Alexa Home Theater over time, improving eero Wi-Fi coverage, and connecting compatible smart-home devices.

## Website

[Visit the published website →](https://cloudshare360.github.io/Alexa-Home-Theater-on-Your-Fire-TV/)

The site is a lightweight, static HTML/CSS/JavaScript website designed for GitHub Pages. It brings together:

- Echo Dot Max and Echo Studio comparisons
- Alexa Home Theater compatibility and setup basics
- eero Built-in coverage and setup notes
- Zigbee, Matter, and Thread smart-home overview
- Cart-based price examples
- An interactive configuration planner for Fire TV, Echo model and quantity, optional Echo Sub, and eero Pro 6E/Pro 7 with one-, two-, or three-unit choices

## Publish with GitHub Pages

The workflow at `.github/workflows/pages.yml` deploys the site when changes are pushed to `main` or when manually started from GitHub Actions.

1. Push the site files to the repository's `main` branch.
2. In the GitHub repository, open **Settings → Pages**.
3. Set the publishing source to **GitHub Actions**.
4. Open the **Actions** tab and check the **Deploy GitHub Pages** workflow.
5. After it succeeds, open the Pages URL shown in the workflow deployment.

The deployment workflow publishes `index.html`, `styles.css`, `planner.js`, and `pricing-config.js`. It does not publish the `Temp-Images` cart screenshots, the conversation/source documents, or product-photo crops.

### Live price endpoint

The planner can read offers from a server-side endpoint, but the endpoint is not configured by default. After deploying a compliant backend, set its public HTTPS URL as `apiUrl` in `pricing-config.js`. The browser never stores Creators API credentials. If a refresh fails, a previously fetched offer is used only while it is less than one hour old; otherwise, the planner shows the supplied cart examples or an unavailable-price message.

## Preview locally

From the repository root, run:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Source notes

The device details and setup instructions are based on supplied comparison imagery and pasted excerpts from Amazon and WIRED. Prices are examples from cart screenshots, not current offers. Compatibility, app steps, specifications, and prices can change; check manufacturer sources before buying or setting up devices.

Detailed working notes remain under [`docs/sources/`](docs/sources/), including [Alexa Home Theater setup](docs/sources/alexa-home-theater-amazon-help.md), [eero Built-in](docs/sources/eero-built-in-echo-speakers.md), [Echo Studio Wi-Fi and smart-home capabilities](docs/sources/echo-studio-wifi-smart-home.md), [shopping costs](docs/sources/home-theater-shopping-costs.md), and the proposed [Amazon live-pricing architecture](docs/sources/amazon-live-pricing-architecture.md).
