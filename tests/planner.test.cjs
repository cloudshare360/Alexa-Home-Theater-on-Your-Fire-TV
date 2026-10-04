const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const plannerSource = fs.readFileSync(
  path.join(__dirname, "..", "planner.js"),
  "utf8",
);
const staticPrices = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "prices.json"), "utf8"),
);
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("provides responsive viewport, tablet, and mobile layouts", () => {
  assert.match(htmlSource, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(stylesSource, /@media \(max-width: 900px\)/);
  assert.match(stylesSource, /@media \(max-width: 650px\)/);
  assert.match(stylesSource, /@media \(max-width: 390px\)/);
  assert.match(stylesSource, /\.main-nav \{[^}]*overflow-x: auto/s);
  assert.match(stylesSource, /\.planner-card \{ grid-template-columns: 1fr; \}/);
});

function createPlanner({
  prices,
  fetchFails = false,
  storage = new Map(),
  apiUrl = "https://prices.example.test/prices",
  eeroModel = "pro-6e",
  eeroCount = "2",
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
    "#speaker-count": new Element("4"),
    "#include-sub": new Element(),
    "#include-eero": new Element(),
    "#eero-picks": new Element(),
    "#eero-model": new Element(eeroModel),
    "#eero-count": new Element(eeroCount),
    "#eero-price-hint": new Element(),
    "#plan-title": new Element(),
    "#plan-tv": new Element(),
    "#plan-breakdown": new Element(),
    "#plan-total-label": new Element(),
    "#plan-total": new Element(),
    "#plan-price-note": new Element(),
    "#live-price-status": new Element(),
  };
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
  const fireTvOption = new Element("cube");
  fireTvOption.textContent = "Fire TV Cube (3rd Generation)";
  fireTvOption.dataset.price = "89.99";
  nodes["#fire-tv-choice"].selectedOptions = [fireTvOption];
  nodes["#include-eero"].checked = true;
  nodes["#eero-model"].selectedOptions = [{
    value: eeroModel,
    textContent: eeroModel === "pro-7" ? "eero Pro 7 · Wi-Fi 7" : "eero Pro 6E · Wi-Fi 6E",
  }];
  nodes["#eero-count"].selectedOptions = [{ value: eeroCount, textContent: `${eeroCount}-unit set` }];
  nodes["#eero-picks"].querySelectorAll = () => [nodes["#eero-model"], nodes["#eero-count"]];

  const speaker = new Element("dot-max");
  speaker.dataset.price = "79.99";
  speaker.closest = () => ({
    querySelector: () => ({ textContent: "Echo Dot Max" }),
  });

  const document = {
    querySelector(selector) {
      return selector === 'input[name="speaker-model"]:checked' ? speaker : nodes[selector];
    },
    querySelectorAll(selector) {
      const prices = priceDisplayElements
        .filter(([elementSelector]) => elementSelector === selector)
        .map(([, element]) => element);
      return selector === 'input[name="speaker-model"]' ? [speaker] : prices;
    },
    createElement() {
      return new Element();
    },
  };
  const localStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
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
      HOME_THEATER_PRICING: { apiUrl },
      setTimeout,
      clearTimeout,
    },
    fetch: async (url) => {
      if (url === "prices.json") {
        return {
          ok: true,
          status: 200,
          json: async () => staticPrices,
        };
      }
      if (fetchFails) throw new Error("offline");
      return {
        ok: true,
        status: 200,
        json: async () => ({ prices }),
      };
    },
  };
  vm.runInNewContext(plannerSource, context, { filename: "planner.js" });
  return { nodes, speaker, storage, priceDisplayElements };
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
  assert.match(nodes["#live-price-status"].textContent, /prices from prices\.json/);
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

test("recalculates the selected configuration when planner controls change", async () => {
  const { nodes, speaker } = createPlanner({ apiUrl: "" });
  await new Promise(setImmediate);

  const fireTvStick = nodes["#fire-tv-choice"].selectedOptions[0];
  fireTvStick.value = "stick-4k";
  fireTvStick.textContent = "Fire TV Stick 4K (2nd Generation)";
  nodes["#fire-tv-choice"].listeners.change();
  assert.equal(nodes["#plan-total-label"].textContent, "Estimated equipment subtotal");
  assert.equal(nodes["#plan-total"].textContent, "$617.94");
  assert.equal(nodes["#plan-breakdown"].children[1].children[1].textContent, "$37.99");

  speaker.value = "studio";
  speaker.closest = () => ({
    querySelector: () => ({ textContent: "Echo Studio (2025 release)" }),
  });
  nodes["#speaker-count"].value = "2";
  nodes["#speaker-count"].listeners.change();
  assert.equal(nodes["#plan-total"].textContent, "$657.96");
  assert.match(nodes["#plan-title"].textContent, /2 Echo Studio/);
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
  assert.match(htmlSource, /Loading selected router price from prices\.json/);
  assert.match(htmlSource, /1 Pack/);
  assert.match(htmlSource, /2 Pack/);
  assert.match(htmlSource, /3 Pack/);
  assert.doesNotMatch(htmlSource, /Other prices have not been provided/);
});

test("loads the static product price catalog from the JSON file", async () => {
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

test("includes supplied prices for each Fire TV device", () => {
  assert.equal(staticPrices.prices["fire-tv-cube-3rd-gen"].amount, 89.99);
  assert.equal(staticPrices.prices["fire-tv-stick-4k-max-2nd-gen"].amount, 44.99);
  assert.equal(staticPrices.prices["fire-tv-stick-4k-2nd-gen"].amount, 37.99);
  assert.equal(staticPrices.prices["fire-tv-stick-4k-plus"].amount, 37.99);
});
