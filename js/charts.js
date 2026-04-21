/* ============================================================
   charts.js — Lógica principal del dashboard AirLink
   Dependencias: Chart.js 4 + chartjs-adapter-date-fns (CDN)
   ============================================================ */

// ── Estado ────────────────────────────────────────────────────
let currentRange  = '24h';
let pmChartInst   = null;
let thChartInst   = null;
let autoRefreshId = null;
let currentReadings = []; // Para descargar CSV
const REFRESH_MS  = 60_000; // Auto-refresh cada 60 segundos

// ── DOM refs ──────────────────────────────────────────────────
const statusDot   = document.querySelector('.status-dot');
const statusLabel = document.getElementById('statusLabel');
const navDevice   = document.getElementById('navDevice');
const lastUpdated = document.getElementById('lastUpdated');
const pmOverlay   = document.getElementById('pmOverlay');
const thOverlay   = document.getElementById('thOverlay');

// Resumen cards
const valTemp  = document.getElementById('valTemp');
const valHum   = document.getElementById('valHum');
const valPm1   = document.getElementById('valPm1');
const valPm25  = document.getElementById('valPm25');
const valPm10  = document.getElementById('valPm10');

// ── Chart.js defaults ─────────────────────────────────────────
Chart.defaults.color         = '#7a8499';
Chart.defaults.borderColor   = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family   = "'Barlow', sans-serif";
Chart.defaults.font.size     = 11;
Chart.defaults.plugins.legend.display = false;

// ── Helpers ───────────────────────────────────────────────────
function fmt(v, dec = 1) {
  return v != null ? Number(v).toFixed(dec) : '—';
}

function setOverlay(overlay, visible) {
  overlay.classList.toggle('visible', visible);
}

function setStatus(online) {
  statusDot.classList.toggle('online',  online);
  statusDot.classList.toggle('offline', !online);
  statusLabel.textContent = online ? 'En línea' : 'Sin conexión';
}

function timestampToLocal(ts) {
  // ts puede ser string ISO o un objeto con $date (MongoDB extended JSON)
  if (!ts) return null;
  if (typeof ts === 'object' && ts.$date) return new Date(ts.$date);
  return new Date(ts);
}

// ── Construir datasets de Chart.js desde lecturas ─────────────
function buildDatasets(readings) {
  const labels = readings.map(r => timestampToLocal(r.timestamp));

  const pm1Data  = readings.map(r => r.metrics?.pm1  ?? null);
  const pm25Data = readings.map(r => r.metrics?.pm25  ?? null);
  const pm10Data = readings.map(r => r.metrics?.pm10  ?? null);
  const tempData = readings.map(r => r.metrics?.temperature_c ?? null);
  const humData  = readings.map(r => r.metrics?.humidity ?? null);

  return { labels, pm1Data, pm25Data, pm10Data, tempData, humData };
}

// ── Opciones base del eje de tiempo ──────────────────────────
function timeScaleOptions(range) {
  const unitMap = { '1h': 'minute', '6h': 'hour', '24h': 'hour', '7d': 'day' };
  const stepMap = { '1h': 10, '6h': 1, '24h': 2, '7d': 1 };
  return {
    type: 'time',
    time: {
      unit: unitMap[range] || 'hour',
      stepSize: stepMap[range] || 1,
      displayFormats: {
        minute: 'HH:mm',
        hour:   'HH:mm',
        day:    'dd/MM',
      },
      tooltipFormat: 'dd/MM/yyyy HH:mm',
    },
    grid: { color: 'rgba(255,255,255,0.05)' },
    ticks: { color: '#4a5568', maxRotation: 0 },
  };
}

// ── Crear / actualizar gráfica de PM ──────────────────────────
function renderPmChart(labels, pm1Data, pm25Data, pm10Data, range) {
  const ctx = document.getElementById('pmChart').getContext('2d');

  const commonDataset = (label, data, color) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color + '18',
    borderWidth: 2,
    pointRadius: data.length > 120 ? 0 : 3,
    pointHoverRadius: 5,
    tension: 0.35,
    fill: false,
    spanGaps: true,
  });

  const datasets = [
    commonDataset('PM1',   pm1Data,  '#00bcd4'),
    commonDataset('PM2.5', pm25Data, '#f9a825'),
    commonDataset('PM10',  pm10Data, '#ef5350'),
  ];

  if (pmChartInst) {
    pmChartInst.data.labels   = labels;
    pmChartInst.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
    pmChartInst.options.scales.x = timeScaleOptions(range);
    pmChartInst.update('active');
    return;
  }

  pmChartInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          backgroundColor: '#111620',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#7a8499',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '—'} µg/m³`,
          },
        },
      },
      scales: {
        x: timeScaleOptions(range),
        y: {
          title: { display: true, text: 'µg/m³', color: '#4a5568', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#4a5568' },
          beginAtZero: true,
        },
      },
    },
  });
}

// ── Crear / actualizar gráfica de Temp + Humedad ──────────────
function renderThChart(labels, tempData, humData, range) {
  const ctx = document.getElementById('thChart').getContext('2d');

  const datasets = [
    {
      label: 'Temperatura',
      data: tempData,
      borderColor: '#ff7043',
      backgroundColor: 'rgba(255,112,67,0.10)',
      borderWidth: 2.2,
      pointRadius: tempData.length > 120 ? 0 : 3,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: false,
      yAxisID: 'yTemp',
      spanGaps: true,
    },
    {
      label: 'Humedad',
      data: humData,
      borderColor: '#42a5f5',
      backgroundColor: 'rgba(66,165,245,0.08)',
      borderWidth: 2,
      pointRadius: humData.length > 120 ? 0 : 3,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: false,
      yAxisID: 'yHum',
      spanGaps: true,
    },
  ];

  if (thChartInst) {
    thChartInst.data.labels   = labels;
    thChartInst.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
    thChartInst.options.scales.x = timeScaleOptions(range);
    thChartInst.update('active');
    return;
  }

  thChartInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          backgroundColor: '#111620',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#7a8499',
          padding: 10,
          callbacks: {
            label: ctx => {
              const unit = ctx.datasetIndex === 0 ? '°C' : '%';
              return ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '—'} ${unit}`;
            },
          },
        },
      },
      scales: {
        x: timeScaleOptions(range),
        yTemp: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '°C', color: '#ff7043', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#ff7043' },
        },
        yHum: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: '% HR', color: '#42a5f5', font: { size: 10 } },
          grid:  { drawOnChartArea: false },
          ticks: { color: '#42a5f5' },
          min: 0,
          max: 100,
        },
      },
    },
  });
}

// ── Actualizar resumen cards ───────────────────────────────────
function updateSummaryCards(latest) {
  if (!latest) return;
  const m = latest.metrics || {};
  valTemp.textContent = fmt(m.temperature_c);
  valHum.textContent  = fmt(m.humidity, 0);
  valPm1.textContent  = fmt(m.pm1);
  valPm25.textContent = fmt(m.pm25);
  valPm10.textContent = fmt(m.pm10);

  if (latest.device_id) {
    navDevice.textContent = latest.device_id;
  }
}

// ── Carga principal ───────────────────────────────────────────
async function loadDashboard(range = currentRange) {
  setOverlay(pmOverlay, true);
  setOverlay(thOverlay, true);

  try {
    const [readings, latest] = await Promise.all([
      fetchReadings(range),
      fetchLatest(),
    ]);

    if (!readings || readings.length === 0) {
      setStatus(false);
      setOverlay(pmOverlay, false);
      setOverlay(thOverlay, false);
      currentReadings = [];
      return;
    }

    currentReadings = readings;
    setStatus(true);
    updateSummaryCards(latest || readings[readings.length - 1]);

    const { labels, pm1Data, pm25Data, pm10Data, tempData, humData } = buildDatasets(readings);
    renderPmChart(labels, pm1Data, pm25Data, pm10Data, range);
    renderThChart(labels, tempData, humData, range);

    lastUpdated.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch (err) {
    console.error('Error cargando dashboard:', err);
    setStatus(false);
  } finally {
    setOverlay(pmOverlay, false);
    setOverlay(thOverlay, false);
  }
}

// ── Auto refresh ──────────────────────────────────────────────
function startAutoRefresh() {
  if (autoRefreshId) clearInterval(autoRefreshId);
  autoRefreshId = setInterval(() => loadDashboard(currentRange), REFRESH_MS);
}

// ── Eventos ───────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    currentRange = btn.dataset.range;
    loadDashboard(currentRange);
    startAutoRefresh();
  });
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  const btn = document.getElementById('btnRefresh');
  btn.style.transform = 'rotate(360deg)';
  btn.style.transition = 'transform 0.5s ease';
  setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 500);
  loadDashboard(currentRange);
});

document.getElementById('btnLogout').addEventListener('click', logout);

// ── Exportar CSV ──────────────────────────────────────────────
document.getElementById('btnDownload').addEventListener('click', () => {
  if (!currentReadings || currentReadings.length === 0) {
    alert('No hay datos para descargar.');
    return;
  }
  
  // Crear cabecera
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Timestamp,Dispositivo,Temp (C),Humedad (%),PM1,PM2.5,PM10\n";
  
  // Agregar filas
  currentReadings.forEach(r => {
    const ts = r.timestamp || '';
    const dev = r.device_id || '';
    const m = r.metrics || {};
    const row = [
      ts,
      dev,
      m.temperature_c ?? '',
      m.humidity ?? '',
      m.pm1 ?? '',
      m.pm25 ?? '',
      m.pm10 ?? ''
    ].join(",");
    csvContent += row + "\n";
  });
  
  // Descargar archivo
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `airlink_data_${currentRange}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// ── Init ──────────────────────────────────────────────────────
loadDashboard(currentRange);
startAutoRefresh();