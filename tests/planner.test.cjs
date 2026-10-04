const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const plannerSource = fs.readFileSync(
  path.join(__dirname, "..", "planner.js"),
  "utf8",
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
    querySelectorAll() {
      return [speaker];
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
    fetch: async () => {
      if (fetchFails) throw new Error("offline");
      return {
        ok: true,
        status: 200,
        json: async () => ({ prices }),
      };
    },
  };
  vm.runInNewContext(plannerSource, context, { filename: "planner.js" });
  return { nodes, storage };
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
  "eero-pro-6e-2-unit": {
    amount: 300,
    currency: "USD",
    retrievedAt: new Date().toISOString(),
  },
};

test("keeps the cart examples when no endpoint is configured", async () => {
  const { nodes } = createPlanner({ apiUrl: "", fetchFails: true });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.match(nodes["#live-price-status"].textContent, /not connected/);
});

test("keeps the existing cart-example estimate when no offer cache exists", async () => {
  const { nodes } = createPlanner({ fetchFails: true });
  await new Promise(setImmediate);

  assert.equal(nodes["#plan-total"].textContent, "$669.94");
  assert.match(nodes["#live-price-status"].textContent, /temporarily unavailable/);
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
  assert.match(nodes["#live-price-status"].textContent, /temporarily unavailable/);
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
    ["pro-7", "3", "$599.99", "$1,009.94"],
  ];
  for (const [eeroModel, eeroCount, packPrice, total] of eeroPacks) {
    const planner = createPlanner({ apiUrl: "", eeroModel, eeroCount });
    await new Promise(setImmediate);
    assert.equal(planner.nodes["#plan-breakdown"].children[2].children[1].textContent, packPrice);
    assert.equal(planner.nodes["#plan-total"].textContent, total);
  }
});

test("documents supplied eero specifications and pack prices on the site", () => {
  assert.match(htmlSource, /wireless speeds up to 3\.9 Gbps/);
  assert.match(htmlSource, /coverage up to 2,000 sq\. ft\. per eero/);
  assert.match(htmlSource, /1-pack<\/span><b>\$149\.99/);
  assert.match(htmlSource, /2-pack<\/span><b>\$259\.99/);
  assert.match(htmlSource, /3-pack<\/span><b>\$374\.99/);
  assert.match(htmlSource, /1-pack<\/span><b>\$224\.99/);
  assert.match(htmlSource, /2-pack<\/span><b>\$399\.99/);
  assert.match(htmlSource, /3-pack<\/span><b>\$599\.99/);
  assert.match(htmlSource, /\$549\.99/);
});
