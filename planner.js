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

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const pricesInCents = {
  dotMax: 7999,
  studio: 17999,
  fireTvCube: 8999,
  echoSub: 12999,
  eeroPro6eTwoPack: 25999,
};

function getEeroPrice() {
  if (eeroModelSelect.value === "pro-6e" && eeroCountSelect.value === "2") {
    return pricesInCents.eeroPro6eTwoPack;
  }
  return null;
}

function updatePlan() {
  const fireTvOption = fireTvSelect.selectedOptions[0];
  const speakerModel = document.querySelector('input[name="speaker-model"]:checked');
  const speakerOption = speakerModel.closest(".choice-option");
  const speakerName = speakerOption.querySelector("b").textContent;
  const speakerUnitPrice = Number(speakerModel.dataset.price);
  const speakerCount = Number(speakerCountSelect.value);
  const fireTvPrice = fireTvOption.dataset.price
    ? Math.round(Number(fireTvOption.dataset.price) * 100)
    : null;
  const eeroPrice = includeEeroCheckbox.checked ? getEeroPrice() : null;
  const subPrice = includeSubCheckbox.checked ? pricesInCents.echoSub : null;
  const speakerTotal = Math.round(speakerUnitPrice * 100) * speakerCount;
  const missingPrices = [];
  const knownAmounts = [speakerTotal];

  planTitle.textContent = `${speakerCount} ${speakerName} speaker${speakerCount === 1 ? "" : "s"}`;
  planTv.textContent = fireTvOption.textContent;
  planBreakdown.replaceChildren();

  const items = [
    [`${speakerCount} × ${speakerName}`, speakerTotal],
    [fireTvOption.textContent, fireTvPrice],
  ];

  if (includeEeroCheckbox.checked) {
    const eeroModelName = eeroModelSelect.selectedOptions[0].textContent.split(" · ")[0];
    const eeroCount = Number(eeroCountSelect.value);
    items.push([`${eeroModelName} · ${eeroCount}-unit set`, eeroPrice]);
  }
  if (includeSubCheckbox.checked) {
    items.push(["Echo Sub", subPrice]);
  }

  for (const [name, priceInCents] of items) {
    const item = document.createElement("li");
    const itemName = document.createElement("span");
    const itemPrice = document.createElement("b");
    itemName.textContent = name;
    itemPrice.textContent =
      priceInCents === null ? "Price not provided" : money.format(priceInCents / 100);
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
    : "Includes all selected items with supplied example prices.";

  eeroPicks.querySelectorAll("select").forEach((select) => {
    select.disabled = !includeEeroCheckbox.checked;
  });
  eeroPriceHint.textContent =
    eeroModelSelect.value === "pro-6e" && eeroCountSelect.value === "2"
      ? "Supplied cart screenshot: Pro 6E 2-pack at $259.99. Other prices have not been provided."
      : "No price was supplied for this model and set size; it will be excluded from the known subtotal.";
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
