const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const plannerSource = fs.readFileSync(
  path.join(__dirname, "..", "planner.js"),
  "utf8",
);
const priceMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "prices.json"), "utf8"),
);
const devicePriceCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "device-prices.json"), "utf8"),
);
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const formatUSD = (amountInCents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(amountInCents / 100);
const jsonResponse = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => payload,
});

test("provides responsive viewport, tablet, and mobile layouts", () => {
  assert.match(htmlSource, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(stylesSource, /@media \(max-width: 900px\)/);
  assert.match(stylesSource, /@media \(max-width: 650px\)/);
  assert.match(stylesSource, /@media \(max-width: 390px\)/);
  assert.match(stylesSource, /\.main-nav \{[^}]*overflow-x: auto/s);
  assert.match(stylesSource, /\.planner-card \{ grid-template-columns: 1fr; \}/);
  assert.match(htmlSource, /id="fire-tv-price"/);
  assert.match(stylesSource, /\.planner-result \{[^}]*background: #f8f6f1/);
  assert.match(stylesSource, /\.plan-breakdown li \{[^}]*font-size: 15px/);
  assert.match(stylesSource, /\.plan-breakdown li small \{[^}]*font-size: 12px/);
  assert.match(stylesSource, /\.plan-tv strong \{[^}]*font-size: 16px; font-weight: 700; text-align: right/);
});

function createPlanner({
  prices,
  fetchFails = false,
  storage = new Map(),
  apiUrl = "https://prices.example.test/prices",
  eeroModel = "pro-6e",
  eeroCount = "2",
  priceCatalog = devicePriceCatalog,
  metadata = priceMetadata,
  staticResponses = {},
  liveResponse,
  pricingConfig,
  storageReadFails = false,
  storageWriteFails = false,
} = {}) {
  class Element {
    constructor(value = "") {
      this.value = value;
      this.textContent = "";
      this.dataset = {};
      this.children = [];
      this.listeners = {};
      this.checked = false;
      this.disabled = false;
    }

    addEventListener(event, listener) {
      this.listeners[event] = listener;
    }

    append(...children) {
      this.children.push(...children);
    }

    replaceChildren(...children) {
      this.children = children;
    }

    querySelectorAll() {
      return [];
    }
  }

  const nodes = {
    "#fire-tv-choice": new Element("cube"),
    "#fire-tv-price": new Element(),
    "#speaker-count": new Element("4"),
    "#include-sub": new Element(),
    "#include-eero": new Element(),
    "#eero-picks": new Element(),
    "#eero-model": new Element(eeroModel),
    "#eero-count": new Element(eeroCount),
    "#eero-price-hint": new Element(),
    "#plan-title": new Element(),
    "#plan-tv": new Element(),
    "#plan-tv-price": new Element(),
    "#plan-breakdown": new Element(),
    "#plan-total-label": new Element(),
    "#plan-total": new Element(),
    "#plan-price-note": new Element(),
    "#live-price-status": new Element(),
  };
  const fireTvOptions = [
    ["cube", "Fire TV Cube (3rd Generation)"],
    ["stick-max", "Fire TV Stick 4K Max (2nd Generation)"],
    ["stick-4k", "Fire TV Stick 4K (2nd Generation)"],
    ["stick-plus", "Fire TV Stick 4K Plus"],
  ].map(([value, textContent]) => Object.assign(new Element(value), { textContent }));
  const priceDisplayElements = [
    ["[data-current-price-key]", "eero-pro-6e-2-pack", "currentPriceKey"],
    ["[data-previous-price-key]", "eero-pro-6e-2-pack", "previousPriceKey"],
    ["[data-current-price-key]", "echo-dot-max", "currentPriceKey"],
    ["[data-product-price-key]", "echo-dot-max", "productPriceKey"],
    ["[data-config-total-key]", "dot-max-cart", "configTotalKey"],
    ["[data-config-difference]", "four-studio-speakers:four-dot-max-speakers", "configDifference"],
    ["[data-config-difference]", "studio-cart:dot-max-cart", "configDifference"],
  ].map(([selector, key, datasetProperty]) => {
    const element = new Element();
    element.dataset[datasetProperty] = key;
    element.dataset.priceQuantity = "4";
    element.dataset.priceSuffix = "";
    return [selector, element];
  });
  nodes["#fire-tv-choice"].selectedOptions = [fireTvOptions[0]];
  nodes["#include-eero"].checked = true;
  nodes["#eero-model"].selectedOptions = [{
    value: eeroModel,
    textContent: eeroModel === "pro-7" ? "eero Pro 7 · Wi-Fi 7" : "eero Pro 6E · Wi-Fi 6E",
  }];
  nodes["#eero-count"].selectedOptions = [{ value: eeroCount, textContent: `${eeroCount} Pack` }];
  nodes["#eero-picks"].querySelectorAll = () => [nodes["#eero-model"], nodes["#eero-count"]];

  const speakers = [
    ["dot-max", "Echo Dot Max"],
    ["studio", "Echo Studio (2025 release)"],
  ].map(([value, name], index) => {
    const speaker = new Element(value);
    speaker.checked = index === 0;
    speaker.closest = () => ({
      querySelector: () => ({ textContent: name }),
    });
    return speaker;
  });

  const document = {
    querySelector(selector) {
      return selector === 'input[name="speaker-model"]:checked'
        ? speakers.find((speaker) => speaker.checked)
        : nodes[selector];
    },
    querySelectorAll(selector) {
      const prices = priceDisplayElements
        .filter(([elementSelector]) => elementSelector === selector)
        .map(([, element]) => element);
      return selector === 'input[name="speaker-model"]' ? speakers : prices;
    },
    createElement() {
      return new Element();
    },
  };
  const localStorage = {
    getItem(key) {
      if (storageReadFails) throw new Error("storage read failed");
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (storageWriteFails) throw new Error("storage write failed");
      storage.set(key, value);
    },
  };

  const context = {
    AbortController,
    Date,
    Intl,
    Map,
    Number,
    Object,
    Set,
    URL,
    document,
    localStorage,
    window: {
      HOME_THEATER_PRICING: pricingConfig === undefined ? { apiUrl } : pricingConfig,
      setTimeout,
      clearTimeout,
    },
    fetch: async (url) => {
      if (Object.hasOwn(staticResponses, url)) {
        const response = staticResponses[url];
        if (response instanceof Error) throw response;
        return typeof response === "function" ? response() : response;
      }
      if (url === "device-prices.json") {
        return {
          ok: true,
          status: 200,
          json: async () => priceCatalog,
        };
      }
      if (url === "prices.json") {
        return {
          ok: true,
          status: 200,
          json: async () => metadata,
        };
      }
      if (fetchFails) throw new Error("offline");
      if (liveResponse !== undefined) {
        if (liveResponse instanceof Error) throw liveResponse;
        return typeof liveResponse === "function" ? liveResponse() : liveResponse;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ prices }),
      };
    },
  };
  vm.runInNewContext(plannerSource, context, {
    filename: path.join(__dirname, "..", "planner.js"),
  });
  return { nodes, speakers, fireTvOptions, storage, priceDisplayElements };
}

const liveOffers = {
  "echo-dot-max": {
    amount: 90,
    currency: "USD",
    retrievedAt: new Date().toISOString(),
  },
  "fire-tv-cube-3rd-gen": {
    amount: 100,
    currency: "USD",
    retrievedAt: new Date().toISOString(),
  },
  "eero-pro-6e-2-pack": {
    amount: 300,
    currency: "USD",
    retrievedAt: new Date().toISOString(),
  },
};

test("keeps the cart examples when no endpoint is configured", async () => {
  const { nodes } = createPlanner({ apiUrl: "", fetchFails: true });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.match(nodes["#live-price-status"].textContent, /prices from device-prices\.json/);
});

test("keeps the existing cart-example estimate when no offer cache exists", async () => {
  const { nodes } = createPlanner({ fetchFails: true });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.match(nodes["#live-price-status"].textContent, /Price refresh failed/);
  assert.equal(nodes["#plan-breakdown"].children[0].children[0].children[0].textContent, "Supplied cart example");
});

test("uses approved live offers in the configuration total", async () => {
  const { nodes } = createPlanner({ prices: liveOffers });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$760.00");
  assert.match(nodes["#live-price-status"].textContent, /Amazon offer data retrieved/);
  assert.match(
    nodes["#plan-breakdown"].children[0].children[0].children[0].textContent,
    /^Amazon offer · last retrieved/,
  );
});

test("uses a successful offer cache when refresh fails", async () => {
  const sharedStorage = new Map();
  createPlanner({ prices: liveOffers, storage: sharedStorage });
  await new Promise(setImmediate);
  const { nodes } = createPlanner({ fetchFails: true, storage: sharedStorage });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$760.00");
  assert.match(nodes["#live-price-status"].textContent, /refresh failed/i);
  assert.match(
    nodes["#plan-breakdown"].children[0].children[0].children[0].textContent,
    /^Cached Amazon offer · last retrieved/,
  );
});

test("does not use cached offer data older than one hour", async () => {
  const expiredOffers = Object.fromEntries(
    Object.entries(liveOffers).map(([key, offer]) => [
      key,
      { ...offer, retrievedAt: new Date(Date.now() - 61 * 60 * 1000).toISOString() },
    ]),
  );
  const storage = new Map([
    [
      "home-theater-amazon-offer-cache",
      JSON.stringify({
        apiUrl: "https://prices.example.test/prices",
        prices: expiredOffers,
      }),
    ],
  ]);
  const { nodes } = createPlanner({ fetchFails: true, storage });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.match(nodes["#live-price-status"].textContent, /Price refresh failed/);
});

test("rejects invalid live offers and keeps supplied catalog prices", async () => {
  const invalidOffers = {
    "unsupported-product": liveOffers["echo-dot-max"],
    "echo-dot-max": null,
    "echo-studio-2025": { ...liveOffers["echo-dot-max"], currency: "CAD" },
    "echo-sub": { ...liveOffers["echo-dot-max"], retrievedAt: 123 },
    "fire-tv-cube-3rd-gen": { ...liveOffers["echo-dot-max"], amount: "invalid" },
    "fire-tv-stick-4k-max-2nd-gen": { ...liveOffers["echo-dot-max"], amount: 0 },
    "fire-tv-stick-4k-2nd-gen": { ...liveOffers["echo-dot-max"], retrievedAt: "invalid-date" },
    "fire-tv-stick-4k-plus": {
      ...liveOffers["echo-dot-max"],
      retrievedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    "eero-pro-6e-1-pack": {
      ...liveOffers["echo-dot-max"],
      retrievedAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
    },
    "eero-pro-6e-2-pack": { ...liveOffers["echo-dot-max"], amount: 0.004 },
  };
  const { nodes } = createPlanner({
    prices: invalidOffers,
    liveResponse: jsonResponse({ prices: invalidOffers }),
  });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.match(nodes["#live-price-status"].textContent, /Price refresh failed/i);
  assert.equal(nodes["#plan-breakdown"].children[0].children[1].textContent, "$319.96");
});

test("uses valid cache entries when refresh has no new offers", async () => {
  const cachedOffer = {
    ...liveOffers["echo-dot-max"],
    retrievedAt: new Date().toISOString(),
  };
  const storage = new Map([
    ["home-theater-amazon-offer-cache", JSON.stringify({
      apiUrl: "https://prices.example.test/prices",
      prices: { "echo-dot-max": cachedOffer },
    })],
  ]);
  const { nodes } = createPlanner({
    storage,
    liveResponse: jsonResponse({ prices: {} }),
  });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$709.98");
  assert.match(nodes["#live-price-status"].textContent, /cached/i);
});

test("handles live pricing configuration, response, and cache-storage failures", async () => {
  const misconfigurations = [
    [null, /Using supplied prices/i],
    [{ apiUrl: 123 }, /misconfigured/i],
    [{}, /Using supplied prices/],
    [{ apiUrl: "not a URL" }, /misconfigured/i],
    [{ apiUrl: "http://prices.example.test/prices" }, /HTTPS/],
    [{ apiUrl: "https://user:secret@prices.example.test/prices" }, /HTTPS/],
  ];
  for (const [pricingConfig, expectedStatus] of misconfigurations) {
    const { nodes } = createPlanner({ pricingConfig });
    await new Promise(setImmediate);
    assert.match(nodes["#live-price-status"].textContent, expectedStatus);
  }

  const badResponses = [
    jsonResponse({}, { ok: false, status: 503 }),
    jsonResponse(null),
    jsonResponse({ prices: [] }),
    { ok: true, status: 200, json: async () => { throw new Error("invalid response JSON"); } },
    jsonResponse({ prices: {} }),
  ];
  for (const liveResponse of badResponses) {
    const { nodes } = createPlanner({ liveResponse });
    await new Promise(setImmediate);
    assert.match(nodes["#live-price-status"].textContent, /Price refresh failed/i);
  }

  const { nodes } = createPlanner({
    prices: liveOffers,
    storageWriteFails: true,
  });
  await new Promise(setImmediate);
  assert.match(nodes["#live-price-status"].textContent, /could not save the temporary fallback/);
});

test("ignores malformed caches and reports static-plus-live failures", async () => {
  const cacheValues = [
    "invalid JSON",
    JSON.stringify({ apiUrl: "https://other.example.test/prices", prices: liveOffers }),
    JSON.stringify({ apiUrl: "https://prices.example.test/prices", prices: [] }),
    JSON.stringify({ apiUrl: "https://prices.example.test/prices" }),
  ];
  for (const value of cacheValues) {
    const storage = new Map([["home-theater-amazon-offer-cache", value]]);
    const { nodes } = createPlanner({ fetchFails: true, storage });
    await new Promise(setImmediate);
    assert.equal(nodes["#plan-total"].textContent, "$669.94");
    assert.match(nodes["#live-price-status"].textContent, /Price refresh failed/i);
  }

  const { nodes } = createPlanner({
    fetchFails: true,
    staticResponses: {
      "device-prices.json": jsonResponse({}, { ok: false, status: 503 }),
    },
  });
  await new Promise(setImmediate);
  assert.equal(nodes["#plan-total"].textContent, "$0.00");
  assert.match(nodes["#live-price-status"].textContent, /static price list could not be loaded/i);

  const storageError = createPlanner({ fetchFails: true, storageReadFails: true });
  await new Promise(setImmediate);
  assert.match(storageError.nodes["#live-price-status"].textContent, /Price refresh failed/i);
});

test("uses supplied eero pack prices in the matching planner configuration", async () => {
  const { nodes } = createPlanner({ apiUrl: "", eeroModel: "pro-7" });
  await new Promise(setImmediate);

  assert.match(nodes["#eero-price-hint"].textContent, /2-pack \$399\.99 \(previously \$549\.99\)/);
  assert.equal(nodes["#plan-breakdown"].children[2].children[1].textContent, "$399.99");
  assert.match(nodes["#plan-breakdown"].children[2].children[0].children[0].textContent, /Supplied Amazon listing/);
  assert.equal(nodes["#plan-total"].textContent, "$809.94");

  const eeroPacks = [
    ["pro-6e", "1", "$149.99", "$559.94"],
    ["pro-6e", "2", "$259.99", "$669.94"],
    ["pro-6e", "3", "$374.99", "$784.94"],
    ["pro-7", "1", "$224.99", "$634.94"],
    ["pro-7", "2", "$399.99", "$809.94"],
    ["pro-7", "3", "$224.99", "$634.94"],
  ];
  for (const [eeroModel, eeroCount, packPrice, total] of eeroPacks) {
    const planner = createPlanner({ apiUrl: "", eeroModel, eeroCount });
    await new Promise(setImmediate);
    assert.equal(planner.nodes["#plan-breakdown"].children[2].children[1].textContent, packPrice);
    assert.equal(planner.nodes["#plan-total"].textContent, total);
  }
});

test("recalculates every planner selection from the CSV-derived JSON price catalog", async () => {
  const { nodes, speakers, fireTvOptions } = createPlanner({ apiUrl: "" });
  await new Promise(setImmediate);

  const catalogPrice = (deviceType, deviceName, quantity = 1, quantityUnit) => {
    const item = devicePriceCatalog.items.find((candidate) =>
      candidate.deviceType === deviceType &&
      candidate.deviceName === deviceName &&
      candidate.quantity === quantity &&
      (candidate.quantityUnit ?? undefined) === quantityUnit);
    assert.ok(item, `Missing catalog row for ${deviceName} (${quantity}${quantityUnit ?? ""})`);
    return Math.round(item.price * 100);
  };
  const routerChoices = [
    null,
    ...["pro-6e", "pro-7"].flatMap((model) =>
      ["1", "2", "3"].map((quantity) => ({ model, quantity }))),
  ];

  for (const fireTvOption of fireTvOptions) {
    for (const speaker of speakers) {
      for (const speakerCount of ["2", "3", "4", "5"]) {
        for (const router of routerChoices) {
          for (const includeSub of [false, true]) {
            nodes["#fire-tv-choice"].selectedOptions = [fireTvOption];
            for (const choice of speakers) choice.checked = choice === speaker;
            nodes["#speaker-count"].value = speakerCount;
            nodes["#include-sub"].checked = includeSub;
            nodes["#include-eero"].checked = router !== null;
            if (router) {
              nodes["#eero-model"].value = router.model;
              nodes["#eero-model"].selectedOptions = [{
                value: router.model,
                textContent: router.model === "pro-7" ? "eero Pro 7 · Wi-Fi 7" : "eero Pro 6E · Wi-Fi 6E",
              }];
              nodes["#eero-count"].value = router.quantity;
              nodes["#eero-count"].selectedOptions = [{
                value: router.quantity,
                textContent: `${router.quantity} Pack`,
              }];
            }
            nodes["#speaker-count"].listeners.change();

            let expectedCents =
              catalogPrice("Speaker", speaker.value === "studio" ? "Echo Studio (2025 release)" : "Echo Dot Max") *
              Number(speakerCount) +
              catalogPrice("FireTV", fireTvOption.textContent);
            if (router) {
              expectedCents += catalogPrice(
                "Router",
                router.model === "pro-7" ? "eero Pro 7" : "eero Pro 6E",
                Number(router.quantity),
                "Pack",
              );
            }
            if (includeSub) expectedCents += catalogPrice("Woofer", "Echo Sub");

            assert.equal(
              nodes["#plan-total"].textContent,
              formatUSD(expectedCents),
              `${fireTvOption.textContent}, ${speaker.value}, ${speakerCount} speakers, ${router?.model ?? "no eero"} ${router?.quantity ?? ""}, sub ${includeSub}`,
            );
            assert.equal(nodes["#plan-breakdown"].children[0].children[1].textContent,
              formatUSD(catalogPrice("Speaker", speaker.value === "studio" ? "Echo Studio (2025 release)" : "Echo Dot Max") * Number(speakerCount)));
            assert.equal(nodes["#plan-breakdown"].children[1].children[1].textContent,
              formatUSD(catalogPrice("FireTV", fireTvOption.textContent)));
            assert.equal(
              nodes["#fire-tv-price"].textContent,
              `Supplied ${fireTvOption.value === "cube" ? "cart example" : "price"}: ${formatUSD(catalogPrice("FireTV", fireTvOption.textContent))}`,
            );
            assert.equal(nodes["#plan-tv"].textContent, fireTvOption.textContent);
            assert.equal(nodes["#plan-tv-price"].textContent,
              formatUSD(catalogPrice("FireTV", fireTvOption.textContent)));
            if (router) {
              assert.equal(
                nodes["#plan-breakdown"].children[2].children[1].textContent,
                formatUSD(catalogPrice(
                  "Router",
                  router.model === "pro-7" ? "eero Pro 7" : "eero Pro 6E",
                  Number(router.quantity),
                  "Pack",
                )),
              );
            }
            if (includeSub) {
              const subIndex = nodes["#plan-breakdown"].children.length - 1;
              assert.equal(
                nodes["#plan-breakdown"].children[subIndex].children[1].textContent,
                formatUSD(catalogPrice("Woofer", "Echo Sub")),
              );
            }
            assert.equal(nodes["#plan-breakdown"].children.length, 2 + (router ? 1 : 0) + (includeSub ? 1 : 0));
          }
        }
      }
    }
  }
});

test("documents supplied eero specifications and pack prices on the site", () => {
  assert.match(htmlSource, /wireless speeds up to 3\.9 Gbps/);
  assert.match(htmlSource, /coverage up to 2,000 sq\. ft\. per eero/);
  assert.match(htmlSource, /1-pack<\/span><b><span data-current-price-key="eero-pro-6e-1-pack">/);
  assert.match(htmlSource, /2-pack<\/span><b><span data-current-price-key="eero-pro-6e-2-pack">/);
  assert.match(htmlSource, /3-pack<\/span><b><span data-current-price-key="eero-pro-6e-3-pack">/);
  assert.match(htmlSource, /1-pack<\/span><b><span data-current-price-key="eero-pro-7-1-pack">/);
  assert.match(htmlSource, /2-pack<\/span><b><span data-current-price-key="eero-pro-7-2-pack">/);
  assert.match(htmlSource, /3-pack<\/span><b><span data-current-price-key="eero-pro-7-3-pack">\$224\.99/);
  assert.match(htmlSource, /\$549\.99/);
  assert.match(htmlSource, /Loading selected router price from device-prices\.json/);
  assert.match(htmlSource, /1 Pack/);
  assert.match(htmlSource, /2 Pack/);
  assert.match(htmlSource, /3 Pack/);
  assert.doesNotMatch(htmlSource, /Other prices have not been provided/);
});

test("loads product amounts from the CSV-derived JSON catalog", async () => {
  const { nodes, priceDisplayElements } = createPlanner({ apiUrl: "" });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.equal(nodes["#plan-breakdown"].children[0].children[1].textContent, "$319.96");
  assert.equal(nodes["#plan-breakdown"].children[1].children[1].textContent, "$89.99");
  assert.equal(nodes["#plan-breakdown"].children[2].children[1].textContent, "$259.99");
  assert.equal(priceDisplayElements[0][1].textContent, "$259.99");
  assert.equal(priceDisplayElements[1][1].textContent, "$349.99");
  assert.equal(priceDisplayElements[2][1].textContent, "$79.99");
  assert.equal(priceDisplayElements[3][1].textContent, "$319.96");
  assert.equal(priceDisplayElements[4][1].textContent, "$669.94");
  assert.equal(priceDisplayElements[5][1].textContent, "$400.00");
  assert.equal(priceDisplayElements[6][1].textContent, "$529.99");
});

test("uses CSV-derived product amounts instead of duplicate metadata amounts", async () => {
  const metadataWithDifferentAmounts = JSON.parse(JSON.stringify(priceMetadata));
  metadataWithDifferentAmounts.prices["echo-dot-max"].amount = 1;
  metadataWithDifferentAmounts.prices["fire-tv-cube-3rd-gen"].amount = 1;
  metadataWithDifferentAmounts.prices["eero-pro-6e-2-pack"].amount = 1;
  const { nodes } = createPlanner({
    apiUrl: "",
    metadata: metadataWithDifferentAmounts,
  });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.equal(nodes["#plan-breakdown"].children[0].children[1].textContent, "$319.96");
  assert.equal(nodes["#plan-breakdown"].children[1].children[1].textContent, "$89.99");
  assert.equal(nodes["#plan-breakdown"].children[2].children[1].textContent, "$259.99");
});

test("shows unavailable prices and skips invalid catalog rows and display values", async () => {
  const priceCatalog = JSON.parse(JSON.stringify(devicePriceCatalog));
  priceCatalog.items.find((item) => item.deviceName === "Fire TV Cube (3rd Generation)").price = null;
  priceCatalog.items.find((item) => item.deviceName === "Fire TV Stick 4K Max (2nd Generation)").price = "not-a-price";
  priceCatalog.items.find((item) => item.deviceName === "Fire TV Stick 4K (2nd Generation)").price = 0;
  priceCatalog.items.find((item) => item.deviceName === "Echo Dot Max").price = null;
  priceCatalog.items = priceCatalog.items.filter((item) =>
    !(item.deviceName === "eero Pro 7" && item.quantity === 3));
  const metadata = JSON.parse(JSON.stringify(priceMetadata));
  metadata.prices["fire-tv-cube-3rd-gen"].source = 1;
  metadata.prices["echo-studio-2025"].previousAmount = 0;
  metadata.prices["echo-sub"].source = 1;
  metadata.prices["eero-pro-6e-2-pack"].previousAmount = undefined;
  metadata.configurations = {
    invalid: {},
    unknownProduct: [{ product: "unknown", quantity: 1 }],
    invalidQuantity: [{ product: "echo-sub", quantity: 0 }],
  };

  const { nodes, priceDisplayElements } = createPlanner({
    apiUrl: "",
    priceCatalog,
    metadata,
  });
  priceDisplayElements[0][1].dataset.currentPriceKey = "unknown-product";
  priceDisplayElements[1][1].dataset.previousPriceKey = "echo-pro-7-3-pack";
  priceDisplayElements[4][1].dataset.configTotalKey = "missing-configuration";
  priceDisplayElements[5][1].dataset.configDifference = "missing:higher";
  priceDisplayElements.push(
    ["[data-current-price-key]", Object.assign(new (priceDisplayElements[2][1].constructor)(), {
      dataset: { currentPriceKey: "echo-sub", priceSuffix: " each" },
    })],
    ["[data-product-price-key]", Object.assign(new (priceDisplayElements[3][1].constructor)(), {
      dataset: { productPriceKey: "echo-sub", priceQuantity: "0" },
    })],
    ["[data-config-total-key]", Object.assign(new (priceDisplayElements[4][1].constructor)(), {
      dataset: { configTotalKey: "missing-configuration" },
    })],
    ["[data-product-price-key]", Object.assign(new (priceDisplayElements[3][1].constructor)(), {
      dataset: { productPriceKey: "echo-sub" },
    })],
  );
  await new Promise(setImmediate);

  assert.equal(nodes["#fire-tv-price"].textContent, "Fire TV price not provided.");
  assert.equal(nodes["#plan-tv-price"].textContent, "Price not provided");
  assert.equal(nodes["#plan-total-label"].textContent, "Known subtotal");
  assert.equal(nodes["#plan-total"].textContent, "$259.99");
  assert.match(nodes["#plan-price-note"].textContent, /Prices not provided and excluded/);
  assert.equal(priceDisplayElements[7][1].textContent, "$129.99 each");
  assert.equal(priceDisplayElements[8][1].textContent, "");
  assert.equal(priceDisplayElements[10][1].textContent, "$129.99");

  nodes["#eero-model"].value = "pro-7";
  nodes["#eero-model"].selectedOptions = [{ value: "pro-7", textContent: "eero Pro 7 · Wi-Fi 7" }];
  nodes["#eero-count"].value = "3";
  nodes["#eero-count"].selectedOptions = [{ value: "3", textContent: "3 Pack" }];
  nodes["#eero-count"].listeners.change();
  assert.match(nodes["#eero-price-hint"].textContent, /No price is available/);

  nodes["#eero-model"].value = "unknown";
  nodes["#eero-model"].selectedOptions = [{ value: "unknown", textContent: "Unknown model" }];
  nodes["#speaker-count"].value = "1";
  nodes["#speaker-count"].listeners.change();
  assert.match(nodes["#plan-title"].textContent, /^1 Echo Dot Max speaker$/);
  assert.equal(nodes["#plan-total"].textContent, "$0.00");
});

test("shows a live router offer when its static catalog row is missing", async () => {
  const priceCatalog = JSON.parse(JSON.stringify(devicePriceCatalog));
  priceCatalog.items = priceCatalog.items.filter((item) =>
    !(item.deviceName === "eero Pro 7" && item.quantity === 3));
  const { nodes } = createPlanner({
    priceCatalog,
    prices: {
      "eero-pro-7-3-pack": {
        amount: 225,
        currency: "USD",
        retrievedAt: new Date().toISOString(),
      },
    },
  });
  await new Promise(setImmediate);

  nodes["#eero-model"].value = "pro-7";
  nodes["#eero-model"].selectedOptions = [{ value: "pro-7", textContent: "eero Pro 7 · Wi-Fi 7" }];
  nodes["#eero-count"].value = "3";
  nodes["#eero-count"].selectedOptions = [{ value: "3", textContent: "3 Pack" }];
  nodes["#eero-count"].listeners.change();
  assert.match(nodes["#eero-price-hint"].textContent, /Amazon offer.*\$225\.00 for this set/);
});

test("reports static catalog fetch, format, and JSON errors", async () => {
  const failures = [
    { "device-prices.json": jsonResponse({}, { ok: false, status: 503 }) },
    { "prices.json": jsonResponse({}, { ok: false, status: 503 }) },
    { "device-prices.json": jsonResponse({ currency: "CAD", items: [] }) },
    { "device-prices.json": jsonResponse({ currency: "USD", items: {} }) },
    { "prices.json": jsonResponse({ currency: "CAD", prices: {} }) },
    { "prices.json": jsonResponse({ currency: "USD", prices: [] }) },
    { "device-prices.json": new Error("catalog fetch failed") },
    { "prices.json": { ok: true, status: 200, json: async () => { throw new Error("invalid json"); } } },
  ];

  for (const staticResponses of failures) {
    const { nodes } = createPlanner({ apiUrl: "", staticResponses });
    await new Promise(setImmediate);
    assert.equal(nodes["#plan-total"].textContent, "$0.00");
    assert.match(nodes["#live-price-status"].textContent, /static price list could not be loaded/i);
  }

  const metadata = { ...priceMetadata, configurations: [] };
  const { priceDisplayElements } = createPlanner({ apiUrl: "", metadata });
  await new Promise(setImmediate);
  assert.equal(priceDisplayElements[4][1].textContent, "");
});

test("includes supplied prices for each Fire TV device", () => {
  const fireTvPrices = devicePriceCatalog.items.filter((item) => item.deviceType === "FireTV");
  assert.deepEqual(
    fireTvPrices.map(({ deviceName, price }) => [deviceName, price]),
    [
      ["Fire TV Cube (3rd Generation)", 89.99],
      ["Fire TV Stick 4K Max (2nd Generation)", 44.99],
      ["Fire TV Stick 4K (2nd Generation)", 37.99],
      ["Fire TV Stick 4K Plus", 37.99],
    ],
  );
});
