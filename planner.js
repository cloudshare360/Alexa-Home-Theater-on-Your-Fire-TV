const fireTvSelect = document.querySelector("#fire-tv-choice");
const speakerCountSelect = document.querySelector("#speaker-count");
const includeSubCheckbox = document.querySelector("#include-sub");
const speakerModelInputs = document.querySelectorAll('input[name="speaker-model"]');
const includeEeroCheckbox = document.querySelector("#include-eero");
const eeroPicks = document.querySelector("#eero-picks");
const eeroModelSelect = document.querySelector("#eero-model");
const eeroCountSelect = document.querySelector("#eero-count");
const eeroPriceHint = document.querySelector("#eero-price-hint");
const planTitle = document.querySelector("#plan-title");
const planTv = document.querySelector("#plan-tv");
const planBreakdown = document.querySelector("#plan-breakdown");
const planTotalLabel = document.querySelector("#plan-total-label");
const planTotal = document.querySelector("#plan-total");
const planPriceNote = document.querySelector("#plan-price-note");
const livePriceStatus = document.querySelector("#live-price-status");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const examplePricesInCents = {
  dotMax: 7999,
  studio: 17999,
  fireTvCube: 8999,
  echoSub: 12999,
};

const eeroListingPrices = {
  "pro-6e": {
    1: { current: 14999, previous: 19999 },
    2: { current: 25999, previous: 34999 },
    3: { current: 37499, previous: 49999 },
  },
  "pro-7": {
    1: { current: 22499, previous: 29999 },
    2: { current: 39999, previous: 54999 },
    3: { current: 59999, previous: 79999 },
  },
};

const offerCacheStorageKey = "home-theater-amazon-offer-cache";
const offerCacheMaxAgeMs = 60 * 60 * 1000;
let offerCacheApiUrl = "";
const productKeys = new Set([
  "fire-tv-cube-3rd-gen",
  "fire-tv-stick-4k-max-2nd-gen",
  "fire-tv-stick-4k-2nd-gen",
  "fire-tv-stick-4k-plus",
  "echo-dot-max",
  "echo-studio-2025",
  "echo-sub",
  "eero-pro-6e-1-unit",
  "eero-pro-6e-2-unit",
  "eero-pro-6e-3-unit",
  "eero-pro-7-1-unit",
  "eero-pro-7-2-unit",
  "eero-pro-7-3-unit",
]);
let livePrices = new Map();

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
    return `eero-${value}-${eeroCount}-unit`;
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
    const offers = parsed && typeof parsed === "object" ? parsed.prices : null;
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

function formatOfferStatus(prices, fallbackMessage) {
  const offers = [...prices.values()];
  if (!offers.length) return fallbackMessage;
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
    livePriceStatus.textContent =
      "Live pricing is not connected. Supplied cart examples are shown where available.";
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
    livePriceStatus.textContent =
      refreshedCount > 0
        ? formatOfferStatus(livePrices, "No current approved offers were returned.")
        : formatOfferStatus(
            livePrices,
            "The price service returned no current approved offers.",
          );
    if (!cacheStored) {
      livePriceStatus.textContent += " This browser could not save the temporary fallback.";
    }
  } catch {
    livePriceStatus.textContent = livePrices.size
      ? `Price refresh failed. ${formatOfferStatus(livePrices, "")}`
      : "Live prices are temporarily unavailable. Supplied cart examples remain identified as examples.";
  }

  updatePlan();
}

function getPrice(productKey, examplePriceInCents) {
  const offer = productKey ? livePrices.get(productKey) : null;
  if (offer) {
    return {
      amountInCents: offer.amountInCents,
      source: `${offer.cached ? "Cached Amazon offer" : "Amazon offer"} · last retrieved ${formatRetrievedAt(offer.retrievedAt)}`,
    };
  }
  return examplePriceInCents === null
    ? { amountInCents: null, source: "Price not provided" }
    : { amountInCents: examplePriceInCents, source: "Supplied cart example" };
}

function updatePlan() {
  const fireTvOption = fireTvSelect.selectedOptions[0];
  const speakerModel = document.querySelector('input[name="speaker-model"]:checked');
  const speakerOption = speakerModel.closest(".choice-option");
  const speakerName = speakerOption.querySelector("b").textContent;
  const speakerPricing = getPrice(
    getProductKey(speakerModel.value),
    Math.round(Number(speakerModel.dataset.price) * 100),
  );
  const speakerCount = Number(speakerCountSelect.value);
  const fireTvExamplePrice = fireTvOption.dataset.price
    ? Math.round(Number(fireTvOption.dataset.price) * 100)
    : null;
  const fireTvPricing = getPrice(getProductKey(fireTvOption.value), fireTvExamplePrice);
  const eeroProductKey = getProductKey(eeroModelSelect.value, eeroCountSelect.value);
  const selectedEeroListing = eeroListingPrices[eeroModelSelect.value]?.[eeroCountSelect.value];
  const eeroExamplePrice = selectedEeroListing?.current ?? null;
  const eeroPricing = includeEeroCheckbox.checked
    ? getPrice(eeroProductKey, eeroExamplePrice)
    : null;
  if (eeroPricing && selectedEeroListing && eeroPricing.source === "Supplied cart example") {
    eeroPricing.source = "Supplied Amazon listing";
  }
  const subPricing = includeSubCheckbox.checked
    ? getPrice(getProductKey("sub"), examplePricesInCents.echoSub)
    : null;
  const speakerTotal =
    speakerPricing.amountInCents === null
      ? null
      : speakerPricing.amountInCents * speakerCount;
  const missingPrices = [];
  const knownAmounts = speakerTotal === null ? [] : [speakerTotal];

  planTitle.textContent = `${speakerCount} ${speakerName} speaker${speakerCount === 1 ? "" : "s"}`;
  planTv.textContent = fireTvOption.textContent;
  planBreakdown.replaceChildren();

  const items = [
    [`${speakerCount} × ${speakerName}`, speakerTotal, speakerPricing.source],
    [fireTvOption.textContent, fireTvPricing.amountInCents, fireTvPricing.source],
  ];

  if (includeEeroCheckbox.checked) {
    const eeroModelName = eeroModelSelect.selectedOptions[0].textContent.split(" · ")[0];
    const eeroCount = Number(eeroCountSelect.value);
    items.push([
      `${eeroModelName} · ${eeroCount}-unit set`,
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
  if (selectedEeroListing) {
    eeroPriceHint.textContent =
      `Supplied Amazon listing: ${eeroCountSelect.value}-pack ${money.format(selectedEeroListing.current / 100)} (previously ${money.format(selectedEeroListing.previous / 100)}). Offers can change.`;
  } else {
    eeroPriceHint.textContent = eeroPricing
      ? eeroPricing.source === "Price not provided"
        ? "No price is available for this model and set size; it will be excluded from the known subtotal."
        : `${eeroPricing.source}: ${money.format(eeroPricing.amountInCents / 100)} for this set.`
      : "No price is available for this model and set size.";
  }
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
loadLivePrices();
