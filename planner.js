const fireTvSelect = document.querySelector("#fire-tv-choice");
const fireTvPrice = document.querySelector("#fire-tv-price");
const speakerCountSelect = document.querySelector("#speaker-count");
const includeSubCheckbox = document.querySelector("#include-sub");
const speakerModelInputs = document.querySelectorAll('input[name="speaker-model"]');
const includeEeroCheckbox = document.querySelector("#include-eero");
const eeroPicks = document.querySelector("#eero-picks");
const eeroModelSelect = document.querySelector("#eero-model");
const eeroCountSelect = document.querySelector("#eero-count");
const eeroPriceHint = document.querySelector("#eero-price-hint");
const planTitle = document.querySelector("#plan-title");
const planBreakdown = document.querySelector("#plan-breakdown");
const planTotalLabel = document.querySelector("#plan-total-label");
const planTotal = document.querySelector("#plan-total");
const planPriceNote = document.querySelector("#plan-price-note");
const livePriceStatus = document.querySelector("#live-price-status");
const budgetElements = Object.fromEntries([
  "#budget-dot-total",
  "#budget-dot-speaker-label",
  "#budget-dot-speaker-total",
  "#budget-dot-tv-label",
  "#budget-dot-tv-price",
  "#budget-dot-eero-row",
  "#budget-dot-eero-label",
  "#budget-dot-eero-price",
  "#budget-dot-sub-row",
  "#budget-dot-sub-price",
  "#budget-studio-total",
  "#budget-studio-speaker-label",
  "#budget-studio-speaker-total",
  "#budget-studio-tv-label",
  "#budget-studio-tv-price",
  "#budget-studio-eero-row",
  "#budget-studio-eero-label",
  "#budget-studio-eero-price",
  "#budget-studio-sub-row",
  "#budget-studio-sub-price",
  "#budget-speaker-difference",
  "#budget-difference-label",
  "#budget-compare-count",
  "#budget-dot-speaker-only",
  "#budget-studio-speaker-only",
].map((selector) => [selector, document.querySelector(selector)]));

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const offerCacheStorageKey = "home-theater-amazon-offer-cache";
const offerCacheMaxAgeMs = 60 * 60 * 1000;
let offerCacheApiUrl = "";
let staticPrices = new Map();
let staticConfigurations = {};
let staticPriceLoadError = false;
const productCatalog = {
  "fire-tv-cube-3rd-gen": { deviceType: "FireTV", deviceName: "Fire TV Cube (3rd Generation)" },
  "fire-tv-stick-4k-max-2nd-gen": { deviceType: "FireTV", deviceName: "Fire TV Stick 4K Max (2nd Generation)" },
  "fire-tv-stick-4k-2nd-gen": { deviceType: "FireTV", deviceName: "Fire TV Stick 4K (2nd Generation)" },
  "fire-tv-stick-4k-plus": { deviceType: "FireTV", deviceName: "Fire TV Stick 4K Plus" },
  "echo-dot-max": { deviceType: "Speaker", deviceName: "Echo Dot Max" },
  "echo-studio-2025": { deviceType: "Speaker", deviceName: "Echo Studio (2025 release)" },
  "echo-sub": { deviceType: "Woofer", deviceName: "Echo Sub" },
  "eero-pro-6e-1-pack": { deviceType: "Router", deviceName: "eero Pro 6E", quantity: 1, quantityUnit: "Pack" },
  "eero-pro-6e-2-pack": { deviceType: "Router", deviceName: "eero Pro 6E", quantity: 2, quantityUnit: "Pack" },
  "eero-pro-6e-3-pack": { deviceType: "Router", deviceName: "eero Pro 6E", quantity: 3, quantityUnit: "Pack" },
  "eero-pro-7-1-pack": { deviceType: "Router", deviceName: "eero Pro 7", quantity: 1, quantityUnit: "Pack" },
  "eero-pro-7-2-pack": { deviceType: "Router", deviceName: "eero Pro 7", quantity: 2, quantityUnit: "Pack" },
  "eero-pro-7-3-pack": { deviceType: "Router", deviceName: "eero Pro 7", quantity: 3, quantityUnit: "Pack" },
};
const productKeys = new Set(Object.keys(productCatalog));
let livePrices = new Map();

function parseStaticPrice(price) {
  if (price.amount === null) {
    return {
      amountInCents: null,
      previousAmountInCents: null,
      source: typeof price.source === "string" ? price.source : "Price not provided",
    };
  }
  const amount = Number(price.amount);
  const previousAmount = price.previousAmount === undefined ? null : Number(price.previousAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (previousAmount !== null && (!Number.isFinite(previousAmount) || previousAmount <= 0)) return null;
  return {
    amountInCents: Math.round(amount * 100),
    previousAmountInCents:
      previousAmount === null ? null : Math.round(previousAmount * 100),
    source: typeof price.source === "string" ? price.source : "Supplied price",
  };
}

function renderStaticPrices() {
  for (const element of document.querySelectorAll("[data-current-price-key]")) {
    const price = staticPrices.get(element.dataset.currentPriceKey);
    if (!price || price.amountInCents === null) continue;
    element.textContent = money.format(price.amountInCents / 100);
    if (element.dataset.priceSuffix) {
      element.textContent += element.dataset.priceSuffix;
    }
  }
  for (const element of document.querySelectorAll("[data-previous-price-key]")) {
    const price = staticPrices.get(element.dataset.previousPriceKey);
    if (price?.previousAmountInCents !== null && price?.previousAmountInCents !== undefined) {
      element.textContent = money.format(price.previousAmountInCents / 100);
    }
  }
  for (const element of document.querySelectorAll("[data-product-price-key]")) {
    const price = staticPrices.get(element.dataset.productPriceKey);
    const quantity = Number(element.dataset.priceQuantity ?? "1");
    if (!price || price.amountInCents === null || !Number.isInteger(quantity) || quantity < 1) {
      continue;
    }
    element.textContent = money.format((price.amountInCents * quantity) / 100);
  }
  const calculatedConfigurations = new Map();
  for (const [key, items] of Object.entries(staticConfigurations)) {
    if (!Array.isArray(items)) continue;
    let totalInCents = 0;
    let valid = true;
    for (const item of items) {
      const price = staticPrices.get(item.product);
      if (!price || price.amountInCents === null || !Number.isInteger(item.quantity) || item.quantity < 1) {
        valid = false;
        break;
      }
      totalInCents += price.amountInCents * item.quantity;
    }
    if (valid) calculatedConfigurations.set(key, totalInCents);
  }
  for (const element of document.querySelectorAll("[data-config-total-key]")) {
    const total = calculatedConfigurations.get(element.dataset.configTotalKey);
    if (total !== undefined) element.textContent = money.format(total / 100);
  }
  for (const element of document.querySelectorAll("[data-config-difference]")) {
    const [higher, lower] = element.dataset.configDifference.split(":");
    const difference = calculatedConfigurations.get(higher) - calculatedConfigurations.get(lower);
    if (Number.isFinite(difference)) {
      element.textContent = money.format(Math.abs(difference) / 100);
    }
  }
}

async function loadStaticPrices() {
  try {
    const [catalogResponse, metadataResponse] = await Promise.all([
      fetch("device-prices.json", { headers: { Accept: "application/json" } }),
      fetch("prices.json", { headers: { Accept: "application/json" } }),
    ]);
    if (!catalogResponse.ok) {
      throw new Error(`Device price catalog returned HTTP ${catalogResponse.status}.`);
    }
    if (!metadataResponse.ok) {
      throw new Error(`Price metadata returned HTTP ${metadataResponse.status}.`);
    }
    const [catalog, metadata] = await Promise.all([
      catalogResponse.json(),
      metadataResponse.json(),
    ]);
    if (catalog?.currency !== "USD" || !Array.isArray(catalog.items)) {
      throw new Error("Device price catalog has an invalid format.");
    }
    if (
      metadata?.currency !== "USD" ||
      !metadata.prices ||
      typeof metadata.prices !== "object" ||
      Array.isArray(metadata.prices)
    ) {
      throw new Error("Price metadata has an invalid format.");
    }
    const parsedPrices = new Map();
    for (const [key, product] of Object.entries(productCatalog)) {
      const item = catalog.items.find((candidate) =>
        candidate.deviceType === product.deviceType &&
        candidate.deviceName === product.deviceName &&
        candidate.quantity === (product.quantity ?? 1) &&
        (candidate.quantityUnit ?? null) === (product.quantityUnit ?? null));
      if (!item) continue;
      const price = parseStaticPrice({
        amount: item.price,
        previousAmount: metadata.prices[key]?.previousAmount,
        source: metadata.prices[key]?.source,
      });
      if (price) parsedPrices.set(key, price);
    }
    staticPrices = parsedPrices;
    staticConfigurations =
      metadata.configurations && typeof metadata.configurations === "object" && !Array.isArray(metadata.configurations)
        ? metadata.configurations
        : {};
    staticPriceLoadError = false;
    renderStaticPrices();
  } catch {
    staticPrices = new Map();
    staticPriceLoadError = true;
  }
  updatePlan();
}

function getProductKey(value, eeroCount) {
  const fireTvKeys = {
    cube: "fire-tv-cube-3rd-gen",
    "stick-max": "fire-tv-stick-4k-max-2nd-gen",
    "stick-4k": "fire-tv-stick-4k-2nd-gen",
    "stick-plus": "fire-tv-stick-4k-plus",
  };
  if (Object.hasOwn(fireTvKeys, value)) return fireTvKeys[value];
  if (value === "dot-max") return "echo-dot-max";
  if (value === "studio") return "echo-studio-2025";
  if (value === "sub") return "echo-sub";
  if (value === "pro-6e" || value === "pro-7") {
    return `eero-${value}-${eeroCount}-pack`;
  }
  return null;
}

function parseOffer(key, offer) {
  if (!productKeys.has(key) || !offer || offer.currency !== "USD") return null;
  if (typeof offer.retrievedAt !== "string") return null;
  const amount = Number(offer.amount);
  const retrievedAt = Date.parse(offer.retrievedAt);
  const age = Date.now() - retrievedAt;
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(retrievedAt)) return null;
  if (age < -5 * 60 * 1000 || age >= offerCacheMaxAgeMs) return null;
  const amountInCents = Math.round(amount * 100);
  if (amountInCents <= 0) return null;

  return {
    amountInCents,
    retrievedAt,
    cached: Boolean(offer.cached),
  };
}

function readOfferCache() {
  try {
    const raw = localStorage.getItem(offerCacheStorageKey);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed?.apiUrl !== offerCacheApiUrl) return new Map();
    const offers = parsed.prices;
    if (!offers || typeof offers !== "object" || Array.isArray(offers)) return new Map();
    return new Map(
      Object.entries(offers)
        .map(([key, offer]) => [key, parseOffer(key, offer)])
        .filter(([, offer]) => offer !== null)
        .map(([key, offer]) => [key, { ...offer, cached: true }]),
    );
  } catch {
    return new Map();
  }
}

function storeOfferCache(prices) {
  try {
    const offers = Object.fromEntries(
      [...prices].map(([key, offer]) => [
        key,
        {
          amount: offer.amountInCents / 100,
          currency: "USD",
          retrievedAt: new Date(offer.retrievedAt).toISOString(),
        },
      ]),
    );
    localStorage.setItem(
      offerCacheStorageKey,
      JSON.stringify({ apiUrl: offerCacheApiUrl, prices: offers }),
    );
    return true;
  } catch {
    return false;
  }
}

function formatRetrievedAt(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatOfferStatus(prices) {
  const offers = [...prices.values()];
  const latest = Math.max(...offers.map((offer) => offer.retrievedAt));
  const cached = offers.some((offer) => offer.cached);
  return cached
    ? "At least one offer is cached. See each selected item for its last-retrieved time; cached offers are used only within Amazon's one-hour offer-data window."
    : `Amazon offer data retrieved ${formatRetrievedAt(latest)}. Prices may differ at checkout.`;
}

async function loadLivePrices() {
  const configuredApiUrl = window.HOME_THEATER_PRICING?.apiUrl;
  if (configuredApiUrl !== undefined && typeof configuredApiUrl !== "string") {
    livePriceStatus.textContent =
      "Live pricing is misconfigured; supplied cart examples remain available.";
    updatePlan();
    return;
  }
  const apiUrl = typeof configuredApiUrl === "string" ? configuredApiUrl.trim() : "";
  if (!apiUrl) {
    livePrices = new Map();
    livePriceStatus.textContent = staticPriceLoadError
      ? "The static price list could not be loaded. Check the connection and reload; the displayed subtotal may be incomplete."
      : "Using supplied prices from device-prices.json. Prices are examples, not live quotes.";
    updatePlan();
    return;
  }

  let endpoint;
  try {
    endpoint = new URL(apiUrl);
  } catch {
    livePriceStatus.textContent = "Live pricing is misconfigured; supplied cart examples remain available.";
    updatePlan();
    return;
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    livePriceStatus.textContent =
      "The live price endpoint must use HTTPS without embedded credentials.";
    updatePlan();
    return;
  }

  offerCacheApiUrl = endpoint.toString();
  livePrices = readOfferCache();
  updatePlan();

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(endpoint.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }

    if (!response.ok) throw new Error(`Price service returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (!payload || typeof payload.prices !== "object" || Array.isArray(payload.prices)) {
      throw new Error("Price service returned an invalid response.");
    }

    const refreshedPrices = readOfferCache();
    let refreshedCount = 0;
    for (const [key, value] of Object.entries(payload.prices)) {
      const offer = parseOffer(key, value);
      if (offer) {
        refreshedPrices.set(key, offer);
        refreshedCount += 1;
      }
    }
    if (refreshedCount === 0 && refreshedPrices.size === 0) {
      throw new Error("No current approved offers were returned.");
    }

    livePrices = refreshedPrices;
    const cacheStored = storeOfferCache(livePrices);
    livePriceStatus.textContent = formatOfferStatus(livePrices);
    if (!cacheStored) {
      livePriceStatus.textContent += " This browser could not save the temporary fallback.";
    }
  } catch {
    if (livePrices.size) {
      livePriceStatus.textContent = `Price refresh failed. ${formatOfferStatus(livePrices)}`;
    } else if (staticPriceLoadError) {
      livePriceStatus.textContent =
        "Price refresh failed and the static price list could not be loaded. The displayed subtotal may be incomplete.";
    } else {
      livePriceStatus.textContent =
        "Price refresh failed. Using supplied prices from device-prices.json where available.";
    }
  }

  updatePlan();
}

function getPrice(productKey) {
  const offer = productKey ? livePrices.get(productKey) : null;
  if (offer) {
    return {
      amountInCents: offer.amountInCents,
      source: `${offer.cached ? "Cached Amazon offer" : "Amazon offer"} · last retrieved ${formatRetrievedAt(offer.retrievedAt)}`,
    };
  }
  const staticPrice = productKey ? staticPrices.get(productKey) : null;
  return staticPrice
    ? { ...staticPrice }
    : { amountInCents: null, previousAmountInCents: null, source: "Price not provided" };
}

function renderBudgetComparisons() {
  const fireTvOption = fireTvSelect.selectedOptions[0];
  const fireTvPrice = getPrice(getProductKey(fireTvOption.value)).amountInCents;
  const speakerCount = Number(speakerCountSelect.value);
  const eeroEnabled = includeEeroCheckbox.checked;
  const eeroName = eeroModelSelect.selectedOptions[0].textContent.split(" · ")[0];
  const eeroCount = eeroCountSelect.value;
  const eeroPrice = eeroEnabled
    ? getPrice(getProductKey(eeroModelSelect.value, eeroCount)).amountInCents
    : null;
  const subEnabled = includeSubCheckbox.checked;
  const subPrice = subEnabled
    ? getPrice(getProductKey("sub")).amountInCents
    : null;
  const speakerTotals = {};

  for (const [model, speakerName, productKey] of [
    ["dot", "Echo Dot Max", "echo-dot-max"],
    ["studio", "Echo Studio", "echo-studio-2025"],
  ]) {
    const unitPrice = getPrice(productKey).amountInCents;
    const speakerTotal = unitPrice === null ? null : unitPrice * speakerCount;
    const amounts = [speakerTotal, fireTvPrice];
    if (eeroEnabled) amounts.push(eeroPrice);
    if (subEnabled) amounts.push(subPrice);
    const total = amounts.every((amount) => amount !== null)
      ? amounts.reduce((sum, amount) => sum + amount, 0)
      : null;
    speakerTotals[model] = speakerTotal;

    budgetElements[`#budget-${model}-speaker-label`].textContent =
      `${speakerCount} × ${speakerName}`;
    budgetElements[`#budget-${model}-speaker-total`].textContent =
      speakerTotal === null ? "Price not provided" : money.format(speakerTotal / 100);
    budgetElements[`#budget-${model}-tv-label`].textContent = fireTvOption.textContent;
    budgetElements[`#budget-${model}-tv-price`].textContent =
      fireTvPrice === null ? "Price not provided" : money.format(fireTvPrice / 100);
    budgetElements[`#budget-${model}-eero-row`].hidden = !eeroEnabled;
    budgetElements[`#budget-${model}-eero-label`].textContent =
      `${eeroName} · ${eeroCount}-pack`;
    budgetElements[`#budget-${model}-eero-price`].textContent =
      eeroPrice === null ? "Price not provided" : money.format(eeroPrice / 100);
    budgetElements[`#budget-${model}-sub-row`].hidden = !subEnabled;
    budgetElements[`#budget-${model}-sub-price`].textContent =
      subPrice === null ? "Price not provided" : money.format(subPrice / 100);
    budgetElements[`#budget-${model}-total`].textContent =
      total === null ? "Incomplete" : money.format(total / 100);
  }

  const difference = speakerTotals.studio === null || speakerTotals.dot === null
    ? null
    : speakerTotals.studio - speakerTotals.dot;
  budgetElements["#budget-speaker-difference"].textContent =
    difference === null ? "Unavailable" : money.format(Math.abs(difference) / 100);
  budgetElements["#budget-difference-label"].textContent =
    `speaker difference at ${speakerCount} units`;
  budgetElements["#budget-compare-count"].textContent = String(speakerCount);
  budgetElements["#budget-dot-speaker-only"].textContent =
    speakerTotals.dot === null ? "Price not provided" : money.format(speakerTotals.dot / 100);
  budgetElements["#budget-studio-speaker-only"].textContent =
    speakerTotals.studio === null ? "Price not provided" : money.format(speakerTotals.studio / 100);
}

function updatePlan() {
  const fireTvOption = fireTvSelect.selectedOptions[0];
  const speakerModel = document.querySelector('input[name="speaker-model"]:checked');
  const speakerOption = speakerModel.closest(".choice-option");
  const speakerName = speakerOption.querySelector("b").textContent;
  const speakerPricing = getPrice(getProductKey(speakerModel.value));
  const speakerCount = Number(speakerCountSelect.value);
  const fireTvPricing = getPrice(getProductKey(fireTvOption.value));
  fireTvPrice.textContent = fireTvPricing.amountInCents === null
    ? "Fire TV price not provided."
    : `${fireTvPricing.source}: ${money.format(fireTvPricing.amountInCents / 100)}`;
  const eeroProductKey = getProductKey(eeroModelSelect.value, eeroCountSelect.value);
  const selectedEeroListing = staticPrices.get(eeroProductKey);
  const eeroPricing = getPrice(eeroProductKey);
  const subPricing = includeSubCheckbox.checked
    ? getPrice(getProductKey("sub"))
    : null;
  const speakerTotal =
    speakerPricing.amountInCents === null
      ? null
      : speakerPricing.amountInCents * speakerCount;
  const missingPrices = [];
  const knownAmounts = speakerTotal === null ? [] : [speakerTotal];
  planTitle.textContent = `${speakerCount} ${speakerName} speaker${speakerCount === 1 ? "" : "s"}`;
  planBreakdown.replaceChildren();

  const items = [
    [`${speakerCount} × ${speakerName}`, speakerTotal, speakerPricing.source],
    [fireTvOption.textContent, fireTvPricing.amountInCents, fireTvPricing.source],
  ];

  if (includeEeroCheckbox.checked) {
    const eeroModelName = eeroModelSelect.selectedOptions[0].textContent.split(" · ")[0];
    const eeroCount = Number(eeroCountSelect.value);
    items.push([
      `${eeroModelName} · ${eeroCount}-pack`,
      eeroPricing.amountInCents,
      eeroPricing.source,
    ]);
  }
  if (includeSubCheckbox.checked) {
    items.push(["Echo Sub", subPricing.amountInCents, subPricing.source]);
  }

  for (const [name, priceInCents, source] of items) {
    const item = document.createElement("li");
    const itemName = document.createElement("span");
    const itemSource = document.createElement("small");
    const itemPrice = document.createElement("b");
    itemName.textContent = name;
    itemSource.textContent = source;
    itemPrice.textContent =
      priceInCents === null ? "Price not provided" : money.format(priceInCents / 100);
    itemName.append(itemSource);
    item.append(itemName, itemPrice);
    planBreakdown.append(item);

    if (priceInCents === null) {
      missingPrices.push(name);
    } else if (!name.startsWith(`${speakerCount} × `)) {
      knownAmounts.push(priceInCents);
    }
  }

  const knownTotal = knownAmounts.reduce((sum, amount) => sum + amount, 0);
  planTotal.textContent = money.format(knownTotal / 100);
  planTotalLabel.textContent = missingPrices.length
    ? "Known subtotal"
    : "Estimated equipment subtotal";
  planPriceNote.textContent = missingPrices.length
    ? `Prices not provided and excluded: ${missingPrices.join("; ")}.`
    : "Each line identifies an Amazon offer or a supplied cart example.";

  eeroPicks.querySelectorAll("select").forEach((select) => {
    select.disabled = !includeEeroCheckbox.checked;
  });
  eeroPicks.hidden = !includeEeroCheckbox.checked;
  if (selectedEeroListing?.amountInCents !== null && selectedEeroListing?.amountInCents !== undefined) {
    eeroPriceHint.textContent =
      `${eeroPricing.source}: ${eeroCountSelect.value}-pack ${money.format(eeroPricing.amountInCents / 100)}${eeroPricing.previousAmountInCents === null ? "" : ` (previously ${money.format(eeroPricing.previousAmountInCents / 100)})`}. Offers can change.`;
  } else {
    eeroPriceHint.textContent = eeroPricing.source === "Price not provided"
      ? "No price is available for this model and set size; it will be excluded from the known subtotal."
      : `${eeroPricing.source}: ${money.format(eeroPricing.amountInCents / 100)} for this set.`;
  }
  renderBudgetComparisons();
}

for (const control of [
  fireTvSelect,
  speakerCountSelect,
  includeSubCheckbox,
  includeEeroCheckbox,
  eeroModelSelect,
  eeroCountSelect,
  ...speakerModelInputs,
]) {
  control.addEventListener("change", updatePlan);
}

updatePlan();
loadStaticPrices().then(loadLivePrices);
