const FRESHNESS_LIMIT_MS = 5 * 60 * 1000;
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SVG_NS = "http://www.w3.org/2000/svg";
const TOKEN_STORAGE_KEY = "token";
const CLIMATE_REFRESH_INTERVAL_MS = 15 * 1000;
const DEFAULT_CLIMATE_COLOR = "#9e9e9e";
const CLIMATE_ACTION_LABELS = {
  arrefecer: "A arrefecer",
  aquecer: "A aquecer",
  neutro: "Em repouso",
  suprimida: "Automação suspensa",
  "sem dados": "Sem dados"
};

const loginSection = document.querySelector("#login-section");
const loginForm = document.querySelector("#token-form");
const tokenInput = document.querySelector("#token-input");
const loginStatus = document.querySelector("#login-status");
const dashboardContent = document.querySelector("#dashboard-content");
const authenticatedUser = document.querySelector("#authenticated-user");
const logoutButton = document.querySelector("#logout-button");
const valueElement = document.querySelector("#latest-value");
const timestampElement = document.querySelector("#latest-timestamp");
const staleWarning = document.querySelector("#stale-warning");
const statusElement = document.querySelector("#data-status");
const retryButton = document.querySelector("#retry-button");
const chartContainer = document.querySelector("#chart-container");
const chart = document.querySelector("#readings-chart");
const climateCard = document.querySelector("#climate-card");
const climateAction = document.querySelector("#climate-action");
const climateReason = document.querySelector("#climate-reason");
const climateTimestamp = document.querySelector("#climate-timestamp");
const climateError = document.querySelector("#climate-error");
let latestTimestamp = null;
let currentReadings = [];
let currentRequest = 0;
let currentClimateRequest = 0;
let climateRefreshInterval = null;
let hasClimateState = false;

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function isValidReading(reading) {
  return reading !== null
    && typeof reading === "object"
    && typeof reading.nome === "string"
    && Number.isFinite(reading.ts)
    && Number.isFinite(new Date(reading.ts).getTime())
    && Number.isFinite(reading.valor);
}

function setStatus(message, isError = false, canRetry = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-error", isError);
  retryButton.hidden = !canRetry;
}

function showLogin(message = "", token = "") {
  stopClimatePolling();
  loginSection.hidden = false;
  dashboardContent.hidden = true;
  authenticatedUser.hidden = true;
  logoutButton.hidden = true;
  tokenInput.value = token;
  loginStatus.textContent = message;
  loginStatus.classList.toggle("is-error", Boolean(message));
  setStatus("");
}

function showDashboard() {
  loginSection.hidden = true;
  dashboardContent.hidden = false;
  authenticatedUser.hidden = false;
  logoutButton.hidden = false;
  loginStatus.textContent = "";
}

function stopClimatePolling() {
  currentClimateRequest += 1;
  if (climateRefreshInterval !== null) {
    window.clearInterval(climateRefreshInterval);
    climateRefreshInterval = null;
  }
}

function renderClimateState(data) {
  const hasKnownAction = data !== null
    && typeof data === "object"
    && Object.hasOwn(CLIMATE_ACTION_LABELS, data.acao);
  const hasValidColor = typeof data?.cor === "string"
    && /^#[\da-f]{6}$/i.test(data.cor);
  const action = hasKnownAction && hasValidColor ? data.acao : "sem dados";
  const color = action === "sem dados" ? DEFAULT_CLIMATE_COLOR : data.cor;
  const timestamp = typeof data?.instante === "string"
    && Number.isFinite(Date.parse(data.instante))
    ? `Estado atualizado a ${formatTimestamp(data.instante)}`
    : "Instante indisponível";

  climateCard.style.setProperty("--estado-cor", color);
  climateCard.classList.remove("is-stale");
  climateAction.textContent = CLIMATE_ACTION_LABELS[action];
  climateReason.textContent = typeof data?.motivo === "string" && data.motivo !== ""
    ? data.motivo
    : action === "sem dados" ? "Ainda não há registos." : "Sem motivo indicado.";
  climateTimestamp.textContent = timestamp;
  climateError.textContent = "";
  climateError.hidden = true;
  hasClimateState = true;
}

function showClimateError() {
  climateError.textContent = "Não foi possível obter o estado.";
  climateError.hidden = false;
  climateCard.classList.toggle("is-stale", hasClimateState);
}

async function loadClimateState(token) {
  const requestId = ++currentClimateRequest;
  const sessionRequestId = currentRequest;
  try {
    const response = await fetch("/api/privado/estado", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (requestId !== currentClimateRequest || sessionRequestId !== currentRequest) {
      return;
    }

    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      currentRequest += 1;
      showLogin("A sessão expirou. Introduza novamente o token.", token);
      return;
    }

    if (!response.ok) {
      showClimateError();
      return;
    }

    const data = await response.json();
    if (requestId !== currentClimateRequest || sessionRequestId !== currentRequest) {
      return;
    }

    renderClimateState(data);
  } catch (error) {
    if (requestId !== currentClimateRequest || sessionRequestId !== currentRequest) {
      return;
    }
    console.error("Não foi possível obter o estado da climatização.", error);
    showClimateError();
  }
}

function startClimatePolling(token) {
  stopClimatePolling();
  loadClimateState(token);
  climateRefreshInterval = window.setInterval(
    () => loadClimateState(token),
    CLIMATE_REFRESH_INTERVAL_MS
  );
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }
  return element;
}

function addText(parent, x, y, text, anchor = "middle") {
  const element = createSvgElement("text", {
    x,
    y,
    "text-anchor": anchor
  });
  element.textContent = text;
  parent.append(element);
}

function renderChart(readings, now) {
  const start = now - HISTORY_WINDOW_MS;
  const recentReadings = readings.filter((reading) => {
    const timestamp = reading.ts;
    return timestamp >= start && timestamp <= now;
  });

  chart.replaceChildren();
  if (recentReadings.length === 0) {
    chartContainer.hidden = true;
    return;
  }

  const sectionStyles = getComputedStyle(chartContainer.parentElement);
  const horizontalPadding = Number.parseFloat(sectionStyles.paddingLeft)
    + Number.parseFloat(sectionStyles.paddingRight);
  const width = Math.max(280, Math.min(900, chartContainer.parentElement.clientWidth - horizontalPadding));
  const height = width < 420 ? 280 : 330;
  const padding = { top: 20, right: 24, bottom: 48, left: 66 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const reading of recentReadings) {
    minValue = Math.min(minValue, reading.valor);
    maxValue = Math.max(maxValue, reading.valor);
  }
  const valueRange = maxValue - minValue || 1;
  minValue -= valueRange * 0.1;
  maxValue += valueRange * 0.1;

  const xPosition = (timestamp) => (
    padding.left + ((timestamp - start) / HISTORY_WINDOW_MS) * plotWidth
  );
  const yPosition = (value) => (
    padding.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight
  );
  const numberFormat = new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 2
  });
  chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  chart.setAttribute("preserveAspectRatio", "xMidYMid meet");

  for (let index = 0; index <= 4; index += 1) {
    const value = maxValue - ((maxValue - minValue) * index) / 4;
    const y = yPosition(value);
    chart.append(createSvgElement("line", {
      x1: padding.left,
      y1: y,
      x2: width - padding.right,
      y2: y,
      class: "chart-gridline"
    }));
    addText(chart, padding.left - 12, y + 4, numberFormat.format(value), "end");
  }

  for (let index = 0; index <= 4; index += 1) {
    const timestamp = start + (HISTORY_WINDOW_MS * index) / 4;
    const x = xPosition(timestamp);
    chart.append(createSvgElement("line", {
      x1: x,
      y1: padding.top,
      x2: x,
      y2: height - padding.bottom,
      class: "chart-gridline chart-gridline-vertical"
    }));
    const anchor = index === 0 ? "start" : index === 4 ? "end" : "middle";
    const hoursAgo = ((4 - index) * 24) / 4;
    const label = index === 4 ? "Agora" : `−${numberFormat.format(hoursAgo)} h`;
    addText(chart, x, height - 16, label, anchor);
  }

  const pathData = recentReadings.map((reading, index) => {
    const x = xPosition(reading.ts);
    const y = yPosition(reading.valor);
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  chart.append(createSvgElement("path", {
    d: pathData,
    class: "chart-line"
  }));

  for (const reading of recentReadings) {
    chart.append(createSvgElement("circle", {
      cx: xPosition(reading.ts),
      cy: yPosition(reading.valor),
      r: 4,
      class: "chart-point"
    }));
  }

  chartContainer.hidden = false;
}

function renderReadings(readings) {
  if (readings.length === 0) {
    latestTimestamp = null;
    currentReadings = [];
    valueElement.textContent = "--";
    timestampElement.textContent = "Sem leituras disponíveis";
    staleWarning.hidden = true;
    chart.replaceChildren();
    chartContainer.hidden = true;
    authenticatedUser.textContent = "Sessão autenticada";
    setStatus("Sem leituras para este utilizador.");
    return;
  }

  const orderedReadings = [...readings].sort(
    (first, second) => second.ts - first.ts
  );
  const latestReading = orderedReadings[0];
  latestTimestamp = latestReading.ts;
  currentReadings = orderedReadings;
  authenticatedUser.textContent = latestReading.nome;

  valueElement.textContent = new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 2
  }).format(latestReading.valor);
  timestampElement.textContent = `Leitura registada a ${formatTimestamp(latestTimestamp)}`;
  updateStaleWarning();

  renderChart(currentReadings, Date.now());
  setStatus(
    chartContainer.hidden
      ? "Não há leituras nas últimas 24 horas."
      : `${currentReadings.length} ${currentReadings.length === 1 ? "leitura" : "leituras"} carregadas.`
  );
}

function updateStaleWarning() {
  staleWarning.hidden = latestTimestamp === null
    || Date.now() - latestTimestamp <= FRESHNESS_LIMIT_MS;
}

async function loadReadings(token) {
  const requestId = ++currentRequest;
  showDashboard();
  setStatus("A carregar dados…");
  let response;
  try {
    response = await fetch("/api/privado/leituras", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    if (requestId !== currentRequest) {
      return;
    }
    console.error("Não foi possível contactar a API.", error);
    setStatus("Sem ligação ao servidor. Verifique a ligação e tente novamente.", true, true);
    return;
  }

  if (requestId !== currentRequest) {
    return;
  }

  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    showLogin("Token inválido ou expirado. Corrija o token e tente novamente.", token);
    return;
  }

  if (!response.ok) {
    setStatus(`Erro do servidor (HTTP ${response.status}). Tente novamente.`, true, true);
    return;
  }

  let readings;
  try {
    readings = await response.json();
  } catch (error) {
    if (requestId !== currentRequest) {
      return;
    }
    console.error("A resposta da API não pôde ser interpretada.", error);
    setStatus("Resposta inválida do servidor. Tente novamente.", true, true);
    return;
  }

  if (requestId !== currentRequest) {
    return;
  }

  if (!Array.isArray(readings) || !readings.every(isValidReading)) {
    setStatus("Resposta inválida do servidor. Tente novamente.", true, true);
    return;
  }

  renderReadings(readings);
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (token === "") {
    loginStatus.textContent = "Introduza um token para entrar.";
    loginStatus.classList.add("is-error");
    return;
  }
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  loadReadings(token);
  startClimatePolling(token);
});

logoutButton.addEventListener("click", () => {
  currentRequest += 1;
  stopClimatePolling();
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  currentReadings = [];
  latestTimestamp = null;
  valueElement.textContent = "--";
  timestampElement.textContent = "A aguardar dados";
  staleWarning.hidden = true;
  chart.replaceChildren();
  chartContainer.hidden = true;
  showLogin();
});

retryButton.addEventListener("click", () => {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    loadReadings(token);
  } else {
    showLogin();
  }
});

const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
if (savedToken) {
  tokenInput.value = savedToken;
  loadReadings(savedToken);
  startClimatePolling(savedToken);
} else {
  showLogin();
}

window.setInterval(updateStaleWarning, 30 * 1000);
window.addEventListener("resize", () => {
  if (currentReadings.length > 0) {
    renderChart(currentReadings, Date.now());
  }
});
