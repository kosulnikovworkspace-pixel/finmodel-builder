const form = document.getElementById("finmodel-form");
const resultEl = document.getElementById("result");
const STORAGE_KEY = "finmodel-form-data";

function parseNumber(value) {
  return Number(value) || 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonths(value) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function getStatus(profit) {
  if (profit > 100000) {
    return "Устойчивая модель";
  }

  if (profit < 0) {
    return "Рискованная модель";
  }

  return "Умеренно рискованная";
}

function getWarnings(monthlyProfit, payroll, paybackMonths, horizon) {
  const warnings = [];

  if (monthlyProfit < 0) {
    warnings.push("Проект убыточный");
  } else if (monthlyProfit < 50000) {
    warnings.push("Низкая маржинальность");
  }

  if (payroll === 0) {
    warnings.push("Не учтены расходы на персонал");
  }

  if (paybackMonths !== null && paybackMonths > horizon) {
    warnings.push("Проект не окупается за заданный период");
  }

  return warnings;
}

function saveFormData() {
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());

  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function loadFormData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    return;
  }

  try {
    const values = JSON.parse(savedData);

    Object.entries(values).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);

      if (field && "value" in field) {
        field.value = value;
      }
    });
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  saveFormData();

  const formData = new FormData(form);
  const investments = parseNumber(formData.get("investments"));
  const monthlyRevenue = parseNumber(formData.get("monthlyRevenue"));
  const fixedCosts = parseNumber(formData.get("fixedCosts"));
  const variableCosts = parseNumber(formData.get("variableCosts"));
  const payroll = parseNumber(formData.get("payroll"));
  const taxes = parseNumber(formData.get("taxes"));
  const horizon = parseNumber(formData.get("horizon")) || 12;

  const monthlyProfit =
    monthlyRevenue - fixedCosts - variableCosts - payroll - taxes;
  const totalProfit = monthlyProfit * horizon;
  const paybackMonths = monthlyProfit > 0 ? investments / monthlyProfit : null;
  const paybackPeriod =
    paybackMonths !== null ? `${formatMonths(paybackMonths)} мес.` : "не окупается";
  const status = getStatus(monthlyProfit);
  const warnings = getWarnings(monthlyProfit, payroll, paybackMonths, horizon);

  const warningsMarkup = warnings.length
    ? `
      <div class="warnings-block">
        <h3 class="warnings-title">Предупреждения</h3>
        <ul class="warnings-list">
          ${warnings.map((warning) => `<li>${warning}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  resultEl.innerHTML = `
    <div class="result-grid">
      <div class="result-row">
        <span>Прибыль в месяц</span>
        <strong>${formatCurrency(monthlyProfit)} ₽</strong>
      </div>
      <div class="result-row">
        <span>Суммарная прибыль</span>
        <strong>${formatCurrency(totalProfit)} ₽</strong>
      </div>
      <div class="result-row">
        <span>Срок окупаемости</span>
        <strong>${paybackPeriod}</strong>
      </div>
      <div class="result-row result-status">
        <span>Статус модели</span>
        <strong>${status}</strong>
      </div>
    </div>
    ${warningsMarkup}
  `;
});

loadFormData();
