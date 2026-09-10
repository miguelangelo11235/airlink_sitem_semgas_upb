# Guía de Implementación de Cambios - AirLink SITEM SEMGAS

## 1️⃣ PREPARACIÓN

### 1.1 Hacer Backup
```bash
# En tu proyecto local
cp js/charts.js js/charts.js.backup
```

### 1.2 Identificar la Escala de Temperatura
**CRÍTICO:** Primero determinar si `temp` viene en escala normal o ×10.

#### Opción A: Revisar Documentación del Sensor
- Buscar datasheet del sensor AirLink
- Verificar: ¿qué rango envía? ¿°C directo o en decidegrees?

#### Opción B: Comparación en Vivo
```javascript
// Agregar console.log TEMPORAL en charts.js línea ~220:
function buildDatasets(readings) {
  const sample = readings[0]?.metrics;
  console.log('Sample temperature value:', sample?.temp);
  // Verificar si 100.4 es ~10°C (divide por 10) o realmente 100°C (algo está mal)
}
```

#### Opción C: Base de Datos
```bash
# Conectar a MongoDB y revisar un documento
db.raw_measurements.findOne({})
# Ver el campo metrics.temp directamente
```

**Luego de confirmar, descomentar en charts-fixed.js:**
```javascript
// Si temp viene ×10:
const tempData = readings.map(r => {
  const raw = r.metrics?.temp ?? null;
  return raw !== null ? raw / 10 : null;
});

// Si temp viene normal:
const tempData = readings.map(r => r.metrics?.temp ?? null);
```

---

## 2️⃣ REEMPLAZO DE ARCHIVOS

### 2.1 Reemplazar `js/charts.js`

**Opción 1: Copiar el archivo corregido**
```bash
# Copiar charts-fixed.js al proyecto
cp charts-fixed.js /ruta/a/tu/proyecto/js/charts.js
```

**Opción 2: Edición Manual (si prefieres hacer cambios gradualmente)**

Abre `js/charts.js` y busca estas funciones para reemplazar:

#### A. Reemplazar `buildDatasets()` (línea ~199)

**Busca:**
```javascript
function buildDatasets(readings) {
  const labels = readings.map(r => timestampToLocal(r.timestamp));
  const pm1Data  = readings.map(r => r.metrics?.pm1  ?? null);
  const pm25Data = readings.map(r => r.metrics?.pm25  ?? null);
  const pm10Data = readings.map(r => r.metrics?.pm10  ?? null);
  const tempData = readings.map(r => r.metrics?.temperature_c ?? null);
  const humData  = readings.map(r => r.metrics?.humidity ?? null);
  return { labels, pm1Data, pm25Data, pm10Data, tempData, humData };
}
```

**Reemplaza con:**
```javascript
function buildDatasets(readings) {
  const labels = readings.map(r => timestampToLocal(r.timestamp));
  
  // NUEVA ESTRUCTURA: Ajustar temp si es necesario (×10 o normal)
  const pm1Data  = readings.map(r => r.metrics?.pm_1 ?? null);
  const pm25Data = readings.map(r => r.metrics?.pm_2p5 ?? null);
  const pm10Data = readings.map(r => r.metrics?.pm_10 ?? null);
  const tempData = readings.map(r => r.metrics?.temp ?? null);
  const humData  = readings.map(r => r.metrics?.hum ?? null);
  
  return { labels, pm1Data, pm25Data, pm10Data, tempData, humData };
}
```

#### B. Reemplazar `updateCards()` (línea ~216)

**Busca:**
```javascript
function updateCards(latestReading, datasets) {
  if (!latestReading) return;
  const m = latestReading.metrics || {};
  valTemp.textContent  = fmt(m.temperature_c); 
  valHum.textContent   = fmt(m.humidity);
  // ... etc
```

**Reemplaza con:**
```javascript
function updateCards(latestReading, datasets) {
  if (!latestReading) return;
  const m = latestReading.metrics || {};
  
  // ACTUALIZADO: nuevos campos
  valTemp.textContent  = fmt(m.temp);
  minTemp.textContent  = fmt(getMinMax(datasets.tempData).min);
  maxTemp.textContent  = fmt(getMinMax(datasets.tempData).max);
  
  valHum.textContent   = fmt(m.hum);
  minHum.textContent   = fmt(getMinMax(datasets.humData).min);
  maxHum.textContent   = fmt(getMinMax(datasets.humData).max);
  
  valPm1.textContent   = fmt(m.pm_1);
  minPm1.textContent   = fmt(getMinMax(datasets.pm1Data).min);
  maxPm1.textContent   = fmt(getMinMax(datasets.pm1Data).max);
  
  valPm25.textContent  = fmt(m.pm_2p5);
  minPm25.textContent  = fmt(getMinMax(datasets.pm25Data).min);
  maxPm25.textContent  = fmt(getMinMax(datasets.pm25Data).max);
  
  valPm10.textContent  = fmt(m.pm_10);
  minPm10.textContent  = fmt(getMinMax(datasets.pm10Data).min);
  maxPm10.textContent  = fmt(getMinMax(datasets.pm10Data).max);
}
```

#### C. Actualizar `renderPmChart()` (línea ~290)

**Busca:**
```javascript
function renderPmChart(labels, pm1, pm25, pm10, range, start, end) {
  const ctx = document.getElementById('pmChart').getContext('2d');
  
  const datasets = [
    {
      label: 'PM 1.0',
      data: pm1,
      borderColor: getThemeColor('--pm1'),
      // ... NO contiene spanGaps: false
```

**Reemplaza agregando `spanGaps: false` a cada dataset:**
```javascript
function renderPmChart(labels, pm1, pm25, pm10, range, start, end) {
  const ctx = document.getElementById('pmChart').getContext('2d');
  
  const datasets = [
    {
      label: 'PM 1.0',
      data: pm1,
      borderColor: getThemeColor('--pm1'),
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: getThemeColor('--pm1'),
      pointBorderColor: getThemeColor('--bg-card'),
      pointBorderWidth: 1.5,
      tension: 0.35,
      spanGaps: false,  // ← AGREGAR
      hidden: !toggles.pm1.checked,
    },
    {
      label: 'PM 2.5',
      data: pm25,
      // ... resto de propiedades ...
      spanGaps: false,  // ← AGREGAR
    },
    {
      label: 'PM 10',
      data: pm10,
      // ... resto de propiedades ...
      spanGaps: false,  // ← AGREGAR
    },
  ];
  // ... resto del código
}
```

#### D. Actualizar `renderThChart()` (línea ~350)

**Misma acción:** Agregar `spanGaps: false` a datasets de Temperatura y Humedad.

```javascript
const datasets = [
  {
    label: 'Temperatura',
    data: temp,
    // ...
    spanGaps: false,  // ← AGREGAR
  },
  {
    label: 'Humedad',
    data: hum,
    // ...
    spanGaps: false,  // ← AGREGAR
  },
];
```

#### E. Actualizar Descarga CSV (línea ~578)

**Busca:**
```javascript
document.getElementById('btnConfirmDownload').addEventListener('click', async () => {
  // ...
  const headers = ['Timestamp', 'Device_ID', 'Temp(C)', 'Hum(%)', 'PM1.0', 'PM2.5', 'PM10'];
  const rows = data.map(r => {
    const m = r.metrics || {};
    return [
      r.timestamp, r.device_id,
      fmt(m.temperature_c), fmt(m.humidity),
      fmt(m.pm1), fmt(m.pm25), fmt(m.pm10)
    ].join(',');
  });
```

**Reemplaza con:**
```javascript
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

    // CSV MEJORADO: Todas las métricas disponibles
    const headers = [
      'Timestamp',
      'Device_ID',
      'Location',
      'Quality',
      'Temp(C)',
      'Humidity(%)',
      'Dew_Point(C)',
      'Wet_Bulb(C)',
      'Heat_Index(C)',
      'PM1.0(µg/m³)',
      'PM2.5(µg/m³)',
      'PM10(µg/m³)',
      'PM2.5_1h(µg/m³)',
      'PM2.5_3h(µg/m³)',
      'PM2.5_24h(µg/m³)',
      'PM10_1h(µg/m³)',
      'PM10_3h(µg/m³)',
      'PM10_24h(µg/m³)'
    ];

    const rows = data.map(r => {
      const m = r.metrics || {};
      return [
        r.timestamp || '',
        r.device_id || '',
        m.location || '',
        m.quality || '',
        fmt(m.temp),
        fmt(m.hum),
        fmt(m.dew_point),
        fmt(m.wet_bulb),
        fmt(m.heat_index),
        fmt(m.pm_1),
        fmt(m.pm_2p5),
        fmt(m.pm_10),
        fmt(m.pm_2p5_last_1_hour),
        fmt(m.pm_2p5_last_3_hours),
        fmt(m.pm_2p5_last_24_hours),
        fmt(m.pm_10_last_1_hour),
        fmt(m.pm_10_last_3_hours),
        fmt(m.pm_10_last_24_hours)
      ].map(v => {
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(',');
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
    URL.revokeObjectURL(url);
    
    downloadModal.classList.remove('visible');
  } catch (e) {
    console.error("Error downloading custom range:", e);
    alert("Error al descargar los datos.");
  }
});
```

---

## 3️⃣ VALIDACIÓN EN NAVEGADOR

### 3.1 Abrir DevTools (F12)
```
Console → verificar ausencia de errores
```

### 3.2 Probar Acciones Clave

**Prueba 1: Cargar Dashboard**
```
✅ KPI cards muestran valores (no "—")
✅ Líneas de gráficas visibles
✅ Status "En línea"
```

**Prueba 2: Cambiar Rango de Tiempo**
```
Haz clic en 2H → 6H → 24H → 7D
✅ Las gráficas se actualizan
✅ Las tarjetas KPI cambian según rango
```

**Prueba 3: Descargar CSV**
```
1. Click en botón Descargar (↓)
2. Seleccionar rango de fechas
3. Click en "Descargar CSV"
✅ Archivo descargado con 18 columnas
✅ Abrir en Excel/Sheets: valores correctos
```

**Prueba 4: Líneas Discontinuas**
```
Si hay datos faltantes en hora 14:00-15:00:
✅ Línea se interrumpe (no conecta con línea lejana)
```

**Prueba 5: Toggle de Datasets**
```
Desmarcar "Temp" → Temperatura desaparece
Marcar "PM1.0" → PM1.0 reaparece
✅ Gráficas actualizan sin recarga
```

### 3.3 Revisar Console para Errores

```javascript
// Debería estar vacío o solo logs informativos
// Si ves "Cannot read property 'temp' of undefined"
// → Revisar buildDatasets() de nuevo
```

---

## 4️⃣ VALIDACIÓN EN MONGODB (Opcional)

Si quieres confirmar la estructura de datos:

```bash
# Conectar a MongoDB Atlas
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/air_quality"

# Listar un documento
db.raw_measurements.findOne()

# Verificar campos disponibles
db.raw_measurements.findOne({}, { metrics: 1 })
```

**Salida esperada (nueva estructura):**
```json
{
  "_id": ObjectId("..."),
  "timestamp": ISODate("2026-08-21T11:24:11.000Z"),
  "device_id": "Airlink SITEM SEMGAS",
  "metrics": {
    "temp": 100.4,
    "hum": 53.6,
    "pm_1": 15.81,
    "pm_2p5": 19.01,
    "pm_10": 22.15,
    "dew_point": 80.5,
    "wet_bulb": 83.7,
    "heat_index": 123.4,
    "location": "Lab",
    "quality": "ok"
  }
}
```

---

## 5️⃣ RESOLUCIÓN DE PROBLEMAS

### ❌ Problema: "KPI cards muestran —"

**Causa más probable:** Campos mal mapeados

```javascript
// En charts.js línea ~215, agregar logs:
function updateCards(latestReading, datasets) {
  if (!latestReading) return;
  const m = latestReading.metrics || {};
  
  console.log('Latest reading:', latestReading);
  console.log('Metrics:', m);
  console.log('Temp value:', m.temp);
  console.log('PM2.5 value:', m.pm_2p5);
  
  // ... resto del código
}
```

**Solución:**
1. Abre dashboard en navegador
2. F12 → Console → busca los logs
3. Verifica si los valores existen
4. Si no existen, revisar nombre exacto de campos en MongoDB

### ❌ Problema: "Gráficas en blanco"

**Verificar:**
```javascript
// En console:
Chart.defaults.plugins.legend.display = false; // ✅ Debe estar false
pmChartInst.data.labels.length // ✅ Debe ser > 0
pmChartInst.data.datasets[0].data // ✅ Debe contener números o null
```

### ❌ Problema: "CSV descargado pero con errores"

**Verificar en archivo descargado:**
```bash
# Abrir CSV en editor de texto
# Línea 1 (headers): ¿18 columnas?
# Línea 2 (datos): ¿valores o "—"?
```

Si aparecen comillas mal colocadas:
```javascript
// La función de escape está correcta, revisar:
// 1. ¿El servidor retorna strings con comas?
// 2. ¿Los nombres de location contienen comas?
```

### ❌ Problema: "401 Unauthorized al descargar"

**Causa:** Token JWT expirado

```javascript
// api.js ya maneja esto (llamará logout())
// Solución manual: Recargar página y login de nuevo
```

---

## 6️⃣ CHECKLIST DE CIERRE

- [ ] Backup de `js/charts.js` creado
- [ ] Escala de temperatura validada
- [ ] Archivo `charts.js` reemplazado/actualizado
- [ ] Dashboard abre sin errores en console
- [ ] KPI cards muestran valores correctos
- [ ] Gráficas actualizan al cambiar rangos
- [ ] Líneas discontinuas funcionan
- [ ] CSV descargado contiene 18 columnas
- [ ] Valores en CSV son correctos
- [ ] Toggling de datasets funciona
- [ ] Cambio de tema (claro/oscuro) no rompe nada
- [ ] Logout funciona
- [ ] Prueba en diferentes navegadores (Chrome, Firefox, Safari)

---

## 7️⃣ SIGUIENTES PASOS

### Fase 2 (Seguridad - api.py)

```python
# 1. Revisar CORS en api.py línea ~38
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tudominio.com"],  # ← Cambiar
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Validar SECRET_KEY línea ~45
import os
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY must be set in environment")

# 3. Agregar rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
```

### Fase 3 (Mejoras - charts.js)

```javascript
// Agregar AQI indicator
function calculateAQI(pm25) {
  if (pm25 <= 12)   return { value: 50,  label: 'Bueno',      color: '#66bb6a' };
  if (pm25 <= 35.4) return { value: 100, label: 'Moderado',   color: '#f9a825' };
  // ... etc
}
```

---

## 📞 SOPORTE

Si encuentras problemas:

1. Revisar console (F12)
2. Comparar estructura en MongoDB vs código
3. Verificar valores en Network tab (F12 → Network → /readings)
4. Probar en incognito/private mode (sin caché)

---

**Última actualización:** 21 Agosto 2026  
**Versión:** 1.0
