const form = document.getElementById("finmodel-form");
const resultEl = document.getElementById("result");
const scenariosEl = document.getElementById("scenarios");
const scenarioChartEl = document.getElementById("scenario-chart");
const downloadPdfBtn = document.getElementById("download-pdf");
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
  }).format(value).replace(/\s/g, " ");
}

function formatReportDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function getProjectInfo() {
  const formData = new FormData(form);

  return {
    projectName: String(formData.get("projectName") || "").trim(),
    businessType: String(formData.get("businessType") || "").trim(),
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

function buildScenarios(baseValues) {
  return [
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
  ].map((scenario) => ({
    ...scenario,
    metrics: calculateModel(scenario.values),
  }));
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

function renderScenarios(scenarios) {
  scenariosEl.innerHTML = `
    <div class="scenario-grid">
      ${scenarios
        .map((scenario) => {
          return `
            <article class="scenario-card scenario-card--${scenario.key}">
              <h3>${scenario.title}</h3>
              <p class="scenario-description">${scenario.description}</p>
              <div class="scenario-metrics">
                <div class="scenario-row">
                  <span>Прибыль в месяц</span>
                  <strong>${formatCurrency(scenario.metrics.monthlyProfit)} ₽</strong>
                </div>
                <div class="scenario-row">
                  <span>Срок окупаемости</span>
                  <strong>${scenario.metrics.paybackPeriod}</strong>
                </div>
                <div class="scenario-row">
                  <span>Статус модели</span>
                  <strong>${scenario.metrics.status}</strong>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderScenarioChart(scenarios) {
  const profits = scenarios.map((scenario) => scenario.metrics.monthlyProfit);
  const minProfit = Math.min(0, ...profits);
  const maxProfit = Math.max(0, ...profits);
  const range = maxProfit - minProfit || 1;
  const zeroPosition = Math.abs(minProfit / range) * 100;

  scenarioChartEl.innerHTML = `
    <div class="chart-bars" style="--zero-position: ${zeroPosition}%;">
      ${scenarios
        .map((scenario) => {
          const profit = scenario.metrics.monthlyProfit;
          const barWidth = Math.abs(profit / range) * 100;
          const barStart = profit < 0 ? zeroPosition - barWidth : zeroPosition;
          const signClass = profit < 0 ? "chart-bar-fill--negative" : "chart-bar-fill--positive";

          return `
            <div class="chart-row">
              <div class="chart-label">${scenario.title}</div>
              <div class="chart-track">
                <span
                  class="chart-bar-fill ${signClass} chart-bar-fill--${scenario.key}"
                  style="left: ${barStart}%; width: ${barWidth}%; min-width: ${profit === 0 ? 0 : 4}px;"
                ></span>
              </div>
              <div class="chart-value">${formatCurrency(profit)} ₽</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildReportData(values, metrics, scenarios) {
  return {
    createdAt: formatReportDate(new Date()),
    project: getProjectInfo(),
    values,
    metrics,
    scenarios,
  };
}

function renderReportRows(rows) {
  return rows
    .map(
      ([label, value]) => `
        <div class="pdf-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderPdfReport(reportData) {
  const { project, values, metrics, scenarios } = reportData;
  const warningsMarkup = metrics.warnings.length
    ? `
      <section class="pdf-section pdf-warning">
        <h2>Предупреждения</h2>
        <ul>
          ${metrics.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      </section>
    `
    : "";

  return `
    <article class="pdf-report">
      <header class="pdf-header">
        <h1>FinModel Builder</h1>
        <p>PDF-отчет финансовой модели</p>
        <span>Дата создания: ${escapeHtml(reportData.createdAt)}</span>
      </header>

      <section class="pdf-section">
        <h2>Данные проекта</h2>
        <div class="pdf-grid">
          ${renderReportRows([
            ["Название проекта", project.projectName || "—"],
            ["Тип бизнеса", project.businessType || "—"],
            ["Инвестиции", `${formatCurrency(values.investments)} ₽`],
            ["Средняя выручка в месяц", `${formatCurrency(values.monthlyRevenue)} ₽`],
            ["Постоянные расходы в месяц", `${formatCurrency(values.fixedCosts)} ₽`],
            ["Переменные расходы в месяц", `${formatCurrency(values.variableCosts)} ₽`],
            ["ФОТ", `${formatCurrency(values.payroll)} ₽`],
            ["Налоги", `${formatCurrency(values.taxes)} ₽`],
            ["Горизонт планирования", `${values.horizon} мес.`],
          ])}
        </div>
      </section>

      <section class="pdf-section">
        <h2>Результаты</h2>
        <div class="pdf-grid">
          ${renderReportRows([
            ["Прибыль в месяц", `${formatCurrency(metrics.monthlyProfit)} ₽`],
            ["Суммарная прибыль", `${formatCurrency(metrics.totalProfit)} ₽`],
            ["Срок окупаемости", metrics.paybackPeriod],
            ["Статус модели", metrics.status],
          ])}
        </div>
      </section>

      ${warningsMarkup}

      <section class="pdf-section">
        <h2>Сценарии модели</h2>
        <div class="pdf-scenarios">
          ${scenarios
            .map(
              (scenario) => `
                <div class="pdf-scenario">
                  <h3>${escapeHtml(scenario.title)}</h3>
                  ${renderReportRows([
                    ["Прибыль в месяц", `${formatCurrency(scenario.metrics.monthlyProfit)} ₽`],
                    ["Срок окупаемости", scenario.metrics.paybackPeriod],
                    ["Статус", scenario.metrics.status],
                  ])}
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    </article>
  `;
}

function calculateAndRenderModel() {
  saveFormData();

  const values = getFormValues();
  const metrics = calculateModel(values);
  const scenarios = buildScenarios(values);

  renderMainResult(metrics);
  renderScenarios(scenarios);
  renderScenarioChart(scenarios);

  return buildReportData(values, metrics, scenarios);
}

function downloadPdfReport(reportData) {
  if (typeof html2pdf === "undefined") {
    alert("Не удалось загрузить библиотеку для PDF. Проверьте подключение к интернету и попробуйте снова.");
    return;
  }

  const reportWrapper = document.createElement("div");
  reportWrapper.className = "pdf-render-host";
  reportWrapper.innerHTML = renderPdfReport(reportData);
  document.body.appendChild(reportWrapper);

  const options = {
    margin: 10,
    filename: "finmodel-report.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  html2pdf()
    .set(options)
    .from(reportWrapper.firstElementChild)
    .save()
    .then(() => {
      reportWrapper.remove();
    })
    .catch(() => {
      reportWrapper.remove();
      alert("Не удалось сформировать PDF. Попробуйте еще раз.");
    });
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

  calculateAndRenderModel();
});

downloadPdfBtn.addEventListener("click", () => {
  if (!form.reportValidity()) {
    return;
  }

  const reportData = calculateAndRenderModel();
  downloadPdfReport(reportData);
});

setupMoneyFields();
loadFormData();
