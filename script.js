const form = document.getElementById("finmodel-form");
const resultEl = document.getElementById("result");
const scenariosEl = document.getElementById("scenarios");
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

function getFormValues() {
  const formData = new FormData(form);

  return {
    investments: parseNumber(formData.get("investments")),
    monthlyRevenue: parseNumber(formData.get("monthlyRevenue")),
    fixedCosts: parseNumber(formData.get("fixedCosts")),
    variableCosts: parseNumber(formData.get("variableCosts")),
    payroll: parseNumber(formData.get("payroll")),
    taxes: parseNumber(formData.get("taxes")),
    horizon: parseNumber(formData.get("horizon")) || 12,
  };
}

function calculateModel(values) {
  const monthlyProfit =
    values.monthlyRevenue -
    values.fixedCosts -
    values.variableCosts -
    values.payroll -
    values.taxes;
  const totalProfit = monthlyProfit * values.horizon;
  const paybackMonths = monthlyProfit > 0 ? values.investments / monthlyProfit : null;

  return {
    monthlyProfit,
    totalProfit,
    paybackMonths,
    paybackPeriod:
      paybackMonths !== null ? `${formatMonths(paybackMonths)} мес.` : "не окупается",
    status: getStatus(monthlyProfit),
    warnings: getWarnings(monthlyProfit, values.payroll, paybackMonths, values.horizon),
  };
}

function buildScenarioValues(baseValues, scenarioType) {
  if (scenarioType === "optimistic") {
    return {
      ...baseValues,
      monthlyRevenue: baseValues.monthlyRevenue * 1.2,
    };
  }

  if (scenarioType === "pessimistic") {
    return {
      ...baseValues,
      monthlyRevenue: baseValues.monthlyRevenue * 0.8,
      fixedCosts: baseValues.fixedCosts * 1.1,
      variableCosts: baseValues.variableCosts * 1.1,
    };
  }

  return { ...baseValues };
}

function renderMainResult(metrics) {
  const warningsMarkup = metrics.warnings.length
    ? `
      <div class="warnings-block">
        <h3 class="warnings-title">Предупреждения</h3>
        <ul class="warnings-list">
          ${metrics.warnings.map((warning) => `<li>${warning}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  resultEl.innerHTML = `
    <div class="result-grid">
      <div class="result-row">
        <span>Прибыль в месяц</span>
        <strong>${formatCurrency(metrics.monthlyProfit)} ₽</strong>
      </div>
      <div class="result-row">
        <span>Суммарная прибыль</span>
        <strong>${formatCurrency(metrics.totalProfit)} ₽</strong>
      </div>
      <div class="result-row">
        <span>Срок окупаемости</span>
        <strong>${metrics.paybackPeriod}</strong>
      </div>
      <div class="result-row result-status">
        <span>Статус модели</span>
        <strong>${metrics.status}</strong>
      </div>
    </div>
    ${warningsMarkup}
  `;
}

function renderScenarios(baseValues) {
  const scenarios = [
    {
      key: "base",
      title: "Базовый",
      values: buildScenarioValues(baseValues, "base"),
    },
    {
      key: "optimistic",
      title: "Оптимистичный",
      values: buildScenarioValues(baseValues, "optimistic"),
    },
    {
      key: "pessimistic",
      title: "Пессимистичный",
      values: buildScenarioValues(baseValues, "pessimistic"),
    },
  ];

  scenariosEl.innerHTML = `
    <div class="scenario-grid">
      ${scenarios
        .map((scenario) => {
          const metrics = calculateModel(scenario.values);

          return `
            <article class="scenario-card scenario-card--${scenario.key}">
              <h3>${scenario.title}</h3>
              <div class="scenario-metrics">
                <div class="scenario-row">
                  <span>Прибыль в месяц</span>
                  <strong>${formatCurrency(metrics.monthlyProfit)} ₽</strong>
                </div>
                <div class="scenario-row">
                  <span>Срок окупаемости</span>
                  <strong>${metrics.paybackPeriod}</strong>
                </div>
                <div class="scenario-row">
                  <span>Статус модели</span>
                  <strong>${metrics.status}</strong>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  saveFormData();

  const values = getFormValues();
  const metrics = calculateModel(values);

  renderMainResult(metrics);
  renderScenarios(values);
});

loadFormData();
