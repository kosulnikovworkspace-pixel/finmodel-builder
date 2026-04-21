const form = document.getElementById("finmodel-form");
const resultEl = document.getElementById("result");
const scenariosEl = document.getElementById("scenarios");
const STORAGE_KEY = "finmodel-form-data";
const MONEY_FIELD_NAMES = [
  "investments",
  "monthlyRevenue",
  "fixedCosts",
  "variableCosts",
  "payroll",
  "taxes",
];

function parseNumber(value) {
  return Number(value) || 0;
}

function cleanMoneyValue(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function parseMoney(value) {
  return Number(cleanMoneyValue(value)) || 0;
}

function formatMoneyInput(value) {
  const cleanValue = cleanMoneyValue(value);

  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonths(value) {
  if (value < 1) {
    return "менее 1 месяца";
  }

  if (Math.abs(value - Math.round(value)) < 0.0000001) {
    return `${Math.round(value)} мес.`;
  }

  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} мес.`;
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

  MONEY_FIELD_NAMES.forEach((name) => {
    values[name] = cleanMoneyValue(values[name]);
  });

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
        field.value = MONEY_FIELD_NAMES.includes(name) ? formatMoneyInput(value) : value;
      }
    });
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getFormValues() {
  const formData = new FormData(form);

  return {
    investments: parseMoney(formData.get("investments")),
    monthlyRevenue: parseMoney(formData.get("monthlyRevenue")),
    fixedCosts: parseMoney(formData.get("fixedCosts")),
    variableCosts: parseMoney(formData.get("variableCosts")),
    payroll: parseMoney(formData.get("payroll")),
    taxes: parseMoney(formData.get("taxes")),
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
    paybackPeriod: paybackMonths !== null ? formatMonths(paybackMonths) : "не окупается",
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
      description: "Исходные данные пользователя без изменений",
      values: buildScenarioValues(baseValues, "base"),
    },
    {
      key: "optimistic",
      title: "Оптимистичный",
      description: "Выручка +20%, расходы без изменений",
      values: buildScenarioValues(baseValues, "optimistic"),
    },
    {
      key: "pessimistic",
      title: "Пессимистичный",
      description: "Выручка -20%, постоянные и переменные расходы +10%",
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
              <p class="scenario-description">${scenario.description}</p>
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

function formatMoneyField(field) {
  const selectionStart = field.selectionStart ?? field.value.length;
  const digitsBeforeCursor = cleanMoneyValue(field.value.slice(0, selectionStart)).length;
  field.value = formatMoneyInput(field.value);

  if (digitsBeforeCursor === 0) {
    field.setSelectionRange(0, 0);
    return;
  }

  let cursorPosition = field.value.length;
  let digitsSeen = 0;

  for (let index = 0; index < field.value.length; index += 1) {
    if (/\d/.test(field.value[index])) {
      digitsSeen += 1;
    }

    if (digitsSeen >= digitsBeforeCursor) {
      cursorPosition = index + 1;
      break;
    }
  }

  field.setSelectionRange(cursorPosition, cursorPosition);
}

function setupMoneyFields() {
  MONEY_FIELD_NAMES.forEach((name) => {
    const field = form.elements.namedItem(name);

    if (!field || !("value" in field)) {
      return;
    }

    field.addEventListener("input", () => {
      formatMoneyField(field);
    });
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  saveFormData();

  const values = getFormValues();
  const metrics = calculateModel(values);

  renderMainResult(metrics);
  renderScenarios(values);
});

setupMoneyFields();
loadFormData();
