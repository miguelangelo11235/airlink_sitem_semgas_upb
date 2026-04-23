/* ============================================================
   charts.js — Lógica principal del dashboard AirLink
   ============================================================ */

// ── Estado ────────────────────────────────────────────────────
let currentRange  = '24h';
let offsetUnits   = 0; // 0 = actual, 1 = anterior, 2 = ...
let pmChartInst   = null;
let thChartInst   = null;
let autoRefreshId = null;
let useLocalTime  = true; // Por defecto UTC-5
const REFRESH_MS  = 60_000; 

// Caché local de lecturas
let cachedData = [];
let minCachedDate = null;
let maxCachedDate = null;
let dbGlobalRange = { min: null, max: null }; // Rango total en la BD

// ── DOM refs ──────────────────────────────────────────────────
const statusDot   = document.querySelector('.status-dot');
const statusLabel = document.getElementById('statusLabel');
const navDevice   = document.getElementById('navDevice');
const lastUpdated = document.getElementById('lastUpdated');
const pmOverlay   = document.getElementById('pmOverlay');
const thOverlay   = document.getElementById('thOverlay');

// Resumen cards
const valTemp  = document.getElementById('valTemp'), minTemp  = document.getElementById('minTemp'), maxTemp  = document.getElementById('maxTemp');
const valHum   = document.getElementById('valHum'), minHum   = document.getElementById('minHum'), maxHum   = document.getElementById('maxHum');
const valPm1   = document.getElementById('valPm1'), minPm1   = document.getElementById('minPm1'), maxPm1   = document.getElementById('maxPm1');
const valPm25  = document.getElementById('valPm25'), minPm25  = document.getElementById('minPm25'), maxPm25  = document.getElementById('maxPm25');
const valPm10  = document.getElementById('valPm10'), minPm10  = document.getElementById('minPm10'), maxPm10  = document.getElementById('maxPm10');

// Toggles
const toggles = {
  temp: document.getElementById('toggleTemp'),
  hum: document.getElementById('toggleHum'),
  pm1: document.getElementById('togglePm1'),
  pm25: document.getElementById('togglePm25'),
  pm10: document.getElementById('togglePm10')
};

// Navegación
const btnPrevRange = document.getElementById('btnPrevRange');
const btnNextRange = document.getElementById('btnNextRange');
const paginationLabel = document.getElementById('paginationLabel');

function updatePaginationLabel(startDt, endDt) {
  if (!paginationLabel) return;
  const labels = { '2h': 'Mover 2H', '6h': 'Mover 6H', '12h': 'Mover 12H', '24h': 'Día Anterior/Sig.', '7d': 'Semana Anterior/Sig.' };
  let text = labels[currentRange] || `Desplazar ${currentRange.toUpperCase()}`;
  
  if (startDt && endDt) {
    if (currentRange === '7d') {
      const sStr = startDt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      const eStr = endDt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      text = `${sStr} al ${eStr}  •  ${text}`;
    } else {
      const dStr = startDt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      text = `${dStr}  •  ${text}`;
    }
  }
  paginationLabel.textContent = text;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(v, dec = 1) { return v != null ? Number(v).toFixed(dec) : '—'; }

function setOverlay(overlay, visible) {
  overlay.classList.toggle('visible', visible);
}

function setStatus(online) {
  statusDot.classList.toggle('online',  online);
  statusDot.classList.toggle('offline', !online);
  statusLabel.textContent = online ? 'En línea' : 'Sin conexión';
}

function timestampToLocal(ts) {
  if (!ts) return null;
  let d = (typeof ts === 'object' && ts.$date) ? new Date(ts.$date) : new Date(ts);
  if (useLocalTime) {
    d = new Date(d.getTime() - (5 * 60 * 60 * 1000));
  }
  return d;
}

// Obtiene los colores actuales del CSS
function getThemeColor(varName) {
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

function updateChartTheme() {
  Chart.defaults.color = getThemeColor('--text-2');
  Chart.defaults.borderColor = getThemeColor('--border-light');
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.plugins.legend.display = false;
  
  const applyTheme = (chart) => {
    if(!chart) return;
    chart.options.plugins.tooltip.backgroundColor = getThemeColor('--bg-card');
    chart.options.plugins.tooltip.titleColor = getThemeColor('--text-1');
    chart.options.plugins.tooltip.bodyColor = getThemeColor('--text-2');
    chart.options.plugins.tooltip.borderColor = getThemeColor('--border');
    chart.update();
  };
  applyTheme(pmChartInst);
  applyTheme(thChartInst);
}

// ── Fechas y Rangos (Alineados a días/semanas) ───────────────
function getWindowDates(range, offset) {
  const now = new Date();
  let start, end;
  
  if (range === '24h') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 23, 59, 59, 999);
  } else if (range === '7d') {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0);
    
    start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() - (offset * 7), 0, 0, 0);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  } else {
    const map = { '2h': 1, '6h': 6, '12h': 12 };
    const backHours = map[range] || 1;
    const shiftHours = (range === '12h') ? 12 : (range === '6h') ? 6 : 2;
    
    const baseHour = now.getHours();
    
    const windowEndHour = baseHour + 1 - (offset * shiftHours);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), windowEndHour, 0, 0);
    end = new Date(end.getTime() - 1); 
    
    const windowStartHour = baseHour - backHours - (offset * shiftHours);
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), windowStartHour, 0, 0);
  }
  
  return { start, end };
}

// ── Downsample para 7D (Horas exactas) ────────────────────────
function downsampleToHours(readings) {
  const map = new Map();
  for (const r of readings) {
    const d = timestampToLocal(r.timestamp);
    if (!d) continue;
    d.setMinutes(0, 0, 0);
    const key = d.getTime();
    if (!map.has(key)) {
      map.set(key, r);
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// ── Caché Local de Datos ──────────────────────────────────────
async function getCachedReadings(startDt, endDt) {
  const startMs = startDt.getTime();
  const endMs = endDt.getTime();
  
  if (minCachedDate && maxCachedDate && startMs >= minCachedDate && endMs <= maxCachedDate) {
    return cachedData.filter(r => {
      const t = timestampToLocal(r.timestamp).getTime();
      return t >= startMs && t <= endMs;
    });
  }

  const paddingDays = currentRange === '7d' ? 7 : 2;
  const fetchStartDt = new Date(startMs - paddingDays * 24 * 3600 * 1000); 
  const fetchEndDt = new Date(endMs + 1 * 24 * 3600 * 1000); 
  
  const toUTCISO = (localD) => {
    return new Date(localD.getTime() + (useLocalTime ? 5*3600*1000 : 0)).toISOString();
  };

  const freshData = await fetchReadings('custom', toUTCISO(fetchStartDt), toUTCISO(fetchEndDt));
  
  const mergeMap = new Map();
  cachedData.forEach(r => mergeMap.set(r.timestamp, r));
  (freshData || []).forEach(r => mergeMap.set(r.timestamp, r));
  
  cachedData = Array.from(mergeMap.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (cachedData.length > 0) {
    minCachedDate = timestampToLocal(cachedData[0].timestamp).getTime();
    maxCachedDate = timestampToLocal(cachedData[cachedData.length - 1].timestamp).getTime();
  }
  
  return cachedData.filter(r => {
    const t = timestampToLocal(r.timestamp).getTime();
    return t >= startMs && t <= endMs;
  });
}

// ── Construir datasets ────────────────────────────────────────
function buildDatasets(readings) {
  const labels = readings.map(r => timestampToLocal(r.timestamp));
  const pm1Data  = readings.map(r => r.metrics?.pm1  ?? null);
  const pm25Data = readings.map(r => r.metrics?.pm25  ?? null);
  const pm10Data = readings.map(r => r.metrics?.pm10  ?? null);
  const tempData = readings.map(r => r.metrics?.temperature_c ?? null);
  const humData  = readings.map(r => r.metrics?.humidity ?? null);
  return { labels, pm1Data, pm25Data, pm10Data, tempData, humData };
}

// ── Actualizar KPIs ───────────────────────────────────────────
function getMinMax(arr) {
  const valid = arr.filter(v => v !== null);
  if (valid.length === 0) return { min: '—', max: '—' };
  return { min: Math.min(...valid), max: Math.max(...valid) };
}

function updateCards(latestReading, datasets) {
  if (!latestReading) return;
  const m = latestReading.metrics || {};
  valTemp.textContent  = fmt(m.temperature_c); valHum.textContent   = fmt(m.humidity);
  valPm1.textContent   = fmt(m.pm1); valPm25.textContent  = fmt(m.pm25); valPm10.textContent  = fmt(m.pm10);

  const tm = getMinMax(datasets.tempData);
  minTemp.textContent = fmt(tm.min); maxTemp.textContent = fmt(tm.max);
  const hm = getMinMax(datasets.humData);
  minHum.textContent = fmt(hm.min); maxHum.textContent = fmt(hm.max);
  const p1m = getMinMax(datasets.pm1Data);
  minPm1.textContent = fmt(p1m.min); maxPm1.textContent = fmt(p1m.max);
  const p25m = getMinMax(datasets.pm25Data);
  minPm25.textContent = fmt(p25m.min); maxPm25.textContent = fmt(p25m.max);
  const p10m = getMinMax(datasets.pm10Data);
  minPm10.textContent = fmt(p10m.min); maxPm10.textContent = fmt(p10m.max);
}

// ── Opciones base del eje de tiempo ──────────────────────────
function timeScaleOptions(range, startDt, endDt) {
  let unit, stepSize;
  
  if (range === '2h') {
    unit = 'minute';
    stepSize = 10;
  } else if (range === '6h' || range === '12h' || range === '24h') {
    unit = 'hour';
    stepSize = (range === '24h') ? 3 : 1;
  } else {
    unit = 'day';
    stepSize = 1;
  }

  return {
    type: 'time',
    min: startDt,
    max: endDt,
    time: {
      unit: unit,
      stepSize: stepSize,
      displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd/MM' },
      tooltipFormat: 'dd/MM/yyyy HH:mm',
    },
    grid: { color: getThemeColor('--border-light') },
    ticks: { 
      color: getThemeColor('--text-2'), 
      maxRotation: 0,
      autoSkip: (range !== '2h') // Forza que no se oculten las marcas de 10 mins en 2H
    },
  };
}

// ── Crear / actualizar gráfica de PM ──────────────────────────
function renderPmChart(labels, pm1Data, pm25Data, pm10Data, range, startDt, endDt) {
  const ctx = document.getElementById('pmChart').getContext('2d');
  const commonDataset = (label, data, color) => ({
    label, data,
    borderColor: color,
    backgroundColor: color + '18',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 5,
    tension: 0.2,
    fill: false,
    spanGaps: false,
  });

  const datasets = [
    commonDataset('PM1.0', pm1Data,  getThemeColor('--pm1')),
    commonDataset('PM2.5', pm25Data, getThemeColor('--pm25')),
    commonDataset('PM10',  pm10Data, getThemeColor('--pm10')),
  ];

  if (pmChartInst) {
    pmChartInst.data.labels = labels;
    pmChartInst.data.datasets.forEach((ds, i) => { 
      ds.data = datasets[i].data; 
      ds.borderColor = datasets[i].borderColor;
      ds.pointRadius = 0; 
      ds.pointHoverRadius = 5;
    });
    pmChartInst.options.scales.x = timeScaleOptions(range, startDt, endDt);
    pmChartInst.update('none');
  } else {
    pmChartInst = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: getThemeColor('--text-1'), font: { family: "'Inter', sans-serif" } } },
          tooltip: {
            backgroundColor: getThemeColor('--bg-card'), titleColor: getThemeColor('--text-1'), bodyColor: getThemeColor('--text-2'),
            borderColor: getThemeColor('--border'), borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '—'} µg/m³` }
          }
        },
        scales: {
          x: timeScaleOptions(range, startDt, endDt),
          y: { title: { display: true, text: 'µg/m³', color: getThemeColor('--text-2'), font: { size: 10 } }, grid: { color: getThemeColor('--border-light') }, ticks: { color: getThemeColor('--text-2') }, beginAtZero: true },
        },
      },
    });
  }
  
  if(toggles.pm1) pmChartInst.setDatasetVisibility(0, toggles.pm1.checked);
  if(toggles.pm25) pmChartInst.setDatasetVisibility(1, toggles.pm25.checked);
  if(toggles.pm10) pmChartInst.setDatasetVisibility(2, toggles.pm10.checked);
  pmChartInst.update();
}

// ── Crear / actualizar gráfica de Temp + Humedad ──────────────
function renderThChart(labels, tempData, humData, range, startDt, endDt) {
  const ctx = document.getElementById('thChart').getContext('2d');
  const datasets = [
    {
      label: 'Temperatura', data: tempData,
      borderColor: getThemeColor('--temp'), backgroundColor: getThemeColor('--temp') + '10',
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
      tension: 0.2, fill: false, yAxisID: 'yTemp', spanGaps: false,
    },
    {
      label: 'Humedad', data: humData,
      borderColor: getThemeColor('--hum'), backgroundColor: getThemeColor('--hum') + '10',
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
      tension: 0.2, fill: false, yAxisID: 'yHum', spanGaps: false,
    },
  ];

  if (thChartInst) {
    thChartInst.data.labels = labels;
    thChartInst.data.datasets.forEach((ds, i) => { 
      ds.data = datasets[i].data; 
      ds.borderColor = datasets[i].borderColor; 
      ds.pointRadius = 0;
      ds.pointHoverRadius = 5;
    });
    thChartInst.options.scales.x = timeScaleOptions(range, startDt, endDt);
    thChartInst.update('none');
  } else {
    thChartInst = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: getThemeColor('--text-1'), font: { family: "'Inter', sans-serif" } } },
          tooltip: {
            backgroundColor: getThemeColor('--bg-card'), titleColor: getThemeColor('--text-1'), bodyColor: getThemeColor('--text-2'),
            borderColor: getThemeColor('--border'), borderWidth: 1,
            callbacks: { label: ctx => { const unit = ctx.datasetIndex === 0 ? '°C' : '%'; return ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '—'} ${unit}`; } }
          }
        },
        scales: {
          x: timeScaleOptions(range, startDt, endDt),
          yTemp: { type: 'linear', position: 'left', title: { display: true, text: '°C', color: getThemeColor('--temp'), font: { size: 10 } }, grid: { color: getThemeColor('--border-light') }, ticks: { color: getThemeColor('--temp') } },
          yHum: { type: 'linear', position: 'right', title: { display: true, text: '% HR', color: getThemeColor('--hum'), font: { size: 10 } }, grid: { drawOnChartArea: false }, ticks: { color: getThemeColor('--hum') }, min: 0, max: 100 },
        },
      },
    });
  }
  
  if(toggles.temp) thChartInst.setDatasetVisibility(0, toggles.temp.checked);
  if(toggles.hum) thChartInst.setDatasetVisibility(1, toggles.hum.checked);
  thChartInst.update();
}

// ── Carga principal ───────────────────────────────────────────
async function loadData() {
  setOverlay(pmOverlay, true);
  setOverlay(thOverlay, true);

  try {
    if (!dbGlobalRange.min) {
      const gRange = await fetchReadingsRange();
      if (gRange) {
        dbGlobalRange.min = timestampToLocal(gRange.min).getTime();
        dbGlobalRange.max = timestampToLocal(gRange.max).getTime();
      }
    }

    const { start, end } = getWindowDates(currentRange, offsetUnits);
    updatePaginationLabel(start, end);

    let readings = await getCachedReadings(start, end);
    const latest = await fetchLatest();

    btnNextRange.disabled = (offsetUnits === 0 || (dbGlobalRange.max && end.getTime() >= dbGlobalRange.max));
    btnPrevRange.disabled = (dbGlobalRange.min && start.getTime() <= dbGlobalRange.min);

    if (currentRange === '7d') {
      readings = downsampleToHours(readings);
    }

    const ds = buildDatasets(readings || []); 
    
    renderPmChart(ds.labels, ds.pm1Data, ds.pm25Data, ds.pm10Data, currentRange, start, end);
    renderThChart(ds.labels, ds.tempData, ds.humData, currentRange, start, end);

    if (readings && readings.length > 0) {
      const currentVal = offsetUnits === 0 ? latest : readings[readings.length - 1];
      updateCards(currentVal, ds);
    } else {
      updateCards(latest || {}, { tempData:[], humData:[], pm1Data:[], pm25Data:[], pm10Data:[] });
    }

    if (latest && latest.device_id) {
      navDevice.textContent = latest.device_id;
    }

    lastUpdated.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-ES')}`;
    setStatus(true);

  } catch (error) {
    console.error(error);
    setStatus(false);
  } finally {
    setOverlay(pmOverlay, false);
    setOverlay(thOverlay, false);
  }
}

// ── Event Listeners ───────────────────────────────────────────
updateChartTheme();

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    e.target.classList.add('active');
    e.target.setAttribute('aria-selected', 'true');
    
    currentRange = e.target.getAttribute('data-range');
    offsetUnits = 0; 
    btnNextRange.disabled = true;
    
    loadData();
  });
});

if (btnPrevRange) {
  btnPrevRange.addEventListener('click', () => {
    offsetUnits += 1;
    btnNextRange.disabled = false;
    loadData();
  });
}

if (btnNextRange) {
  btnNextRange.addEventListener('click', () => {
    offsetUnits = Math.max(0, offsetUnits - 1);
    if (offsetUnits === 0) btnNextRange.disabled = true;
    loadData();
  });
}

const btnGoPresent = document.getElementById('btnGoPresent');
if (btnGoPresent) {
  btnGoPresent.addEventListener('click', () => {
    if (currentRange === '24h' && offsetUnits === 0) return; // Ya estamos ahí
    
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      if (b.getAttribute('data-range') === '24h') {
        b.classList.add('active');
        b.setAttribute('aria-selected', 'true');
      }
    });

    currentRange = '24h';
    offsetUnits = 0;
    btnNextRange.disabled = true;
    
    loadData();
  });
}

document.getElementById('btnRefresh').addEventListener('click', () => {
  offsetUnits = 0;
  btnNextRange.disabled = true;
  loadData();
});

document.getElementById('btnLogout').addEventListener('click', logout);

const btnTimezone = document.getElementById('btnTimezone');
if (btnTimezone) {
  btnTimezone.addEventListener('click', () => {
    useLocalTime = !useLocalTime;
    btnTimezone.textContent = useLocalTime ? 'Hora: Local (UTC-5)' : 'Hora: UTC';
    cachedData = []; minCachedDate = null; maxCachedDate = null; dbGlobalRange = {min: null, max: null};
    loadData();
  });
}

const btnThemeToggle = document.getElementById('btnThemeToggle');
if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    updateChartTheme();
    loadData();
  });
}

const updateChartFromCheckboxes = () => {
  const { start, end } = getWindowDates(currentRange, offsetUnits);
  
  if (thChartInst) {
    thChartInst.setDatasetVisibility(0, toggles.temp.checked);
    thChartInst.setDatasetVisibility(1, toggles.hum.checked);
    thChartInst.options.scales.x = timeScaleOptions(currentRange, start, end);
    thChartInst.update('none');
  }
  if (pmChartInst) {
    pmChartInst.setDatasetVisibility(0, toggles.pm1.checked);
    pmChartInst.setDatasetVisibility(1, toggles.pm25.checked);
    pmChartInst.setDatasetVisibility(2, toggles.pm10.checked);
    pmChartInst.options.scales.x = timeScaleOptions(currentRange, start, end);
    pmChartInst.update('none');
  }
};

['temp', 'hum', 'pm1', 'pm25', 'pm10'].forEach(key => {
  if (toggles[key]) {
    toggles[key].addEventListener('change', updateChartFromCheckboxes);
  }
});

// ── Exportar CSV (Modal) ──────────────────────────────────────
const downloadModal = document.getElementById('downloadModal');
const btnDownloadModalOpen = document.getElementById('btnDownloadModalOpen');
const closeDownloadModal = document.getElementById('closeDownloadModal');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

if (btnDownloadModalOpen && downloadModal) {
  btnDownloadModalOpen.addEventListener('click', async () => {
    downloadModal.classList.add('visible');
    const range = await fetchReadingsRange();
    if (range && range.min && range.max) {
      const minD = new Date(range.min);
      const maxD = new Date(range.max);
      
      const toLocalISO = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
      };

      startDateInput.value = toLocalISO(minD);
      endDateInput.value = toLocalISO(maxD);
    }
  });

  closeDownloadModal.addEventListener('click', () => {
    downloadModal.classList.remove('visible');
  });

  document.getElementById('btnConfirmDownload').addEventListener('click', async () => {
    if (!startDateInput.value || !endDateInput.value) return;
    try {
      const startIso = new Date(startDateInput.value).toISOString();
      const endIso = new Date(endDateInput.value).toISOString();
      const data = await fetchReadings('custom', startIso, endIso);
      
      if (!data || data.length === 0) {
        alert("No hay datos en el rango seleccionado.");
        return;
      }

      const headers = ['Timestamp', 'Device_ID', 'Temp(C)', 'Hum(%)', 'PM1.0', 'PM2.5', 'PM10'];
      const rows = data.map(r => {
        const m = r.metrics || {};
        return [
          r.timestamp, r.device_id,
          fmt(m.temperature_c), fmt(m.humidity),
          fmt(m.pm1), fmt(m.pm25), fmt(m.pm10)
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `airlink_data_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      downloadModal.classList.remove('visible');
    } catch (e) {
      console.error("Error downloading custom range:", e);
      alert("Error al descargar los datos.");
    }
  });
}

// ── Iniciar auto-refresh ──────────────────────────────────────
function startAutoRefresh() {
  if (autoRefreshId) clearInterval(autoRefreshId);
  autoRefreshId = setInterval(() => {
    if (offsetUnits === 0) loadData(); // Solo autorefrescar si estamos viendo el "ahora"
  }, REFRESH_MS);
}

loadData();
startAutoRefresh();