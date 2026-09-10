# AirLink SITEM SEMGAS - Análisis de Cambios y Mejoras

## 📋 CAMBIOS REALIZADOS

### 1. **Adaptación a Nueva Estructura de Datos**

#### Problema
Los datos en MongoDB han cambiado su estructura interna:

**Estructura Anterior (Inferida):**
```
metrics:
  - temperature_c
  - humidity
  - pm1, pm25, pm10
```

**Nueva Estructura:**
```
metrics:
  - temp (°C, requiere validar si está ×10)
  - hum (%)
  - pm_1, pm_2p5, pm_10 (principales)
  - pm_1_last, pm_2p5_last, pm_10_last
  - pm_2p5_last_1_hour, pm_2p5_last_3_hours, pm_2p5_last_24_hours
  - pm_2p5_nowcast
  - pm_10_last_1_hour, pm_10_last_3_hours, pm_10_last_24_hours
  - pm_10_nowcast
  - dew_point, wet_bulb, heat_index
  - pct_pm_data_last_1_hour, pct_pm_data_last_3_hours, pct_pm_data_nowcast, pct_pm_data_last_24_hours
  - location, quality
```

#### Solución en `charts-fixed.js`

**Cambios en `buildDatasets()`:**
```javascript
// Antes:
const tempData = readings.map(r => r.metrics?.temperature_c ?? null);
const humData  = readings.map(r => r.metrics?.humidity ?? null);
const pm1Data  = readings.map(r => r.metrics?.pm1  ?? null);

// Ahora:
const tempData = readings.map(r => r.metrics?.temp ?? null);
const humData  = readings.map(r => r.metrics?.hum ?? null);
const pm1Data  = readings.map(r => r.metrics?.pm_1 ?? null);
const pm25Data = readings.map(r => r.metrics?.pm_2p5 ?? null);
const pm10Data = readings.map(r => r.metrics?.pm_10 ?? null);
```

**Cambios en `updateCards()`:**
```javascript
// Actualización de valores mostrados en tarjetas KPI
valTemp.textContent  = fmt(m.temp);        // Antes: m.temperature_c
valHum.textContent   = fmt(m.hum);         // Antes: m.humidity
valPm1.textContent   = fmt(m.pm_1);        // Antes: m.pm1
valPm25.textContent  = fmt(m.pm_2p5);      // Antes: m.pm25
valPm10.textContent  = fmt(m.pm_10);       // Antes: m.pm10
```

### 2. **Líneas Discontinuas para Datos Faltantes**

#### Problema
Cuando falta un dato en una hora específica, las gráficas conectaban puntos lejanos, distorsionando la visualización.

#### Solución
Se agregó la propiedad `spanGaps: false` en todos los datasets de Chart.js:

```javascript
{
  label: 'PM 1.0',
  data: pm1,
  spanGaps: false,  // ← CLAVE: no conecta puntos con datos faltantes
  borderWidth: 2.5,
  tension: 0.35,
  // ... otras propiedades
}
```

**Efecto:** Si en la hora 14:00 no hay dato, la línea se interrumpe. Se resume en hora 15:00 si hay dato.

### 3. **CSV Mejorado con Todas las Métricas**

#### Cambio en Descarga CSV

**Antes (7 columnas):**
```csv
Timestamp,Device_ID,Temp(C),Hum(%),PM1.0,PM2.5,PM10
2026-08-21T11:24:11.000+00:00,Airlink SITEM SEMGAS,10.0,53.6,15.81,19.01,22.15
```

**Ahora (18 columnas):**
```csv
Timestamp,Device_ID,Location,Quality,Temp(C),Humidity(%),Dew_Point(C),Wet_Bulb(C),Heat_Index(C),PM1.0(µg/m³),PM2.5(µg/m³),PM10(µg/m³),PM2.5_1h(µg/m³),PM2.5_3h(µg/m³),PM2.5_24h(µg/m³),PM10_1h(µg/m³),PM10_3h(µg/m³),PM10_24h(µg/m³)
2026-08-21T11:24:11.000+00:00,Airlink SITEM SEMGAS,Lab,ok,10.0,53.6,8.5,12.3,12.4,15.81,19.01,22.15,21.58,21.58,21.58,24.54,24.54,24.54
```

**Ventajas:**
- Análisis histórico: promedios de 1h, 3h, 24h
- Parámetros derivados: punto de rocío, índice de calor
- Validación: porcentaje de datos (pct_pm_data)
- Escalabilidad: fácil agregar más campos en el futuro

#### Código de Descarga (mejorado):
```javascript
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
    // Escapar comillas en valores que contengan comas
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
  }).join(',');
});
```

---

## 🎯 OBSERVACIONES Y MEJORAS RECOMENDADAS

### A. **CRÍTICAS (Alta Prioridad)**

#### 1. **Validar Escala de Temperatura**
**Problema:** Los datos muestran `temp: 100.4` cuando el ejemplo describe ~10°C.

**Investigación necesaria:**
```javascript
// En charts-fixed.js línea ~205:
const tempData = readings.map(r => {
  // ¿Necesita dividir por 10?
  const raw = r.metrics?.temp ?? null;
  return raw ? raw / 10 : null;
});
```

**Acción recomendada:**
1. Revisar la fuente de datos (sensor AirLink)
2. Verificar con un valor conocido en el momento del test
3. Si confirma: descomenta la división en el código

#### 2. **Manejo de Tokens Expirados**
**Problema:** Si el JWT expira durante una sesión larga, `fetchReadings()` retorna 401 pero solo llama `logout()` en algunos casos.

**Solución:**
```javascript
// En api.js, agregar middleware de recaptura:
async function fetchReadings(range = '24h', start = null, end = null) {
  let url = `${API_BASE}/readings?range=${range}`;
  if (start && end) {
    url = `${API_BASE}/readings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  }
  
  const res = await fetch(url, { headers: authHeaders() });

  if (res.status === 401) {
    // Token expirado: limpiar y redirigir
    logout();
    return [];
  }
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}
```

### B. **IMPORTANTES (Mejora Significativa)**

#### 3. **Agregar Indicador de Calidad del Aire (AQI)**
**Beneficio:** Contexto inmediato sobre si los valores son "buenos" o "malos".

**Implementación sugerida:**
```javascript
// Nueva función en charts-fixed.js:
function calculateAQI(pm25) {
  // EPA AQI estándar (1990)
  if (pm25 <= 12)   return { value: 50,  label: 'Bueno',      color: '#66bb6a' };
  if (pm25 <= 35.4) return { value: 100, label: 'Moderado',   color: '#f9a825' };
  if (pm25 <= 55.4) return { value: 150, label: 'Sensibles',  color: '#ff7043' };
  if (pm25 <= 150.4)return { value: 200, label: 'Insalubre',  color: '#ef5350' };
  if (pm25 <= 250.4)return { value: 300, label: 'Muy Insalubre', color: '#8e0000' };
  return { value: 500, label: 'Peligroso',  color: '#6a0572' };
}

// Agregar tarjeta AQI en dashboard.html
// <div class="summary-card" id="cardAQI">
//   <span class="card-value" id="valAQI">—</span>
//   <span class="card-label" id="labelAQI">—</span>
// </div>

// En updateCards():
const aqi = calculateAQI(m.pm_2p5);
valAQI.textContent = aqi.value;
labelAQI.textContent = aqi.label;
document.getElementById('cardAQI').style.borderColor = aqi.color;
```

**En HTML (agregar a summary-row):**
```html
<div class="summary-card" id="cardAQI">
  <div class="card-header">
    <span class="card-label">Índice AQI</span>
    <div class="card-icon" id="aqi-icon" style="background: rgba(0,0,0,0.1);">
      📊
    </div>
  </div>
  <div class="card-body">
    <span class="card-value" id="valAQI">—</span>
  </div>
  <div class="card-footer" id="labelAQI">—</div>
</div>
```

#### 4. **Compresión y Caché Inteligente**
**Problema:** Cada cambio de rango vuelve a cargar datos del servidor.

**Mejora:**
```javascript
// En getCachedReadings():
const CACHE_DURATION = {
  '2h': 2 * 60 * 1000,      // 2 minutos
  '6h': 5 * 60 * 1000,      // 5 minutos
  '12h': 10 * 60 * 1000,    // 10 minutos
  '24h': 30 * 60 * 1000,    // 30 minutos
  '7d': 60 * 60 * 1000,     // 1 hora
};

let cacheTimestamp = null;

if (cachedData.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION[currentRange]) {
  return cachedData.filter(...); // Reutilizar sin fetch
}
// Si no, hacer fetch nuevo...
```

#### 5. **Auditoría de Seguridad - API**
**Riesgos identificados en `api.py`:**

```python
# ⚠️ PROBLEMA 1: CORS muy permisivo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← PELIGRO: cualquiera puede acceder
    allow_credentials=True,
)

# ✅ SOLUCIÓN:
ALLOWED_ORIGINS = ["https://tudominio.com", "https://app.tudominio.com"]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, ...)

# ⚠️ PROBLEMA 2: SECRET_KEY por defecto
SECRET_KEY = os.getenv("SECRET_KEY", "default-secret-key-for-local-dev")

# ✅ SOLUCIÓN:
if not os.getenv("SECRET_KEY"):
    raise ValueError("SECRET_KEY must be set in environment variables")
SECRET_KEY = os.getenv("SECRET_KEY")

# ⚠️ PROBLEMA 3: No hay rate limiting
# ✅ SOLUCIÓN: Agregar slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/readings")
@limiter.limit("100/minute")
def get_readings(...):
    pass
```

### C. **OPTIMIZACIONES (Nice-to-have)**

#### 6. **Paginación Infinita en Gráficas**
En lugar de botones "Anterior/Siguiente", mostrar scroll horizontal con auto-carga:

```javascript
// Detector de scroll en el canvas
const chartContainer = document.querySelector('.chart-area');
chartContainer.addEventListener('scroll', (e) => {
  if (e.target.scrollLeft < 100 && offsetUnits < maxOffset) {
    offsetUnits += 1;
    loadData();
  }
});
```

#### 7. **Alertas Inteligentes**
```javascript
// Notificar si PM2.5 > 55.4 (nivel "Sensibles")
function checkThresholds(reading) {
  const m = reading.metrics || {};
  
  if (m.pm_2p5 > 55.4) {
    showNotification('⚠️ PM2.5 en nivel SENSIBLES', 'warning');
  }
  if (m.temp > 35) {
    showNotification('🌡️ Temperatura crítica', 'error');
  }
}
```

#### 8. **Exportar a Formatos Adicionales**
```javascript
// Agregar botones en modal descarga:
// "Descargar CSV" | "Descargar Excel (XLSX)" | "Descargar JSON"

async function exportToExcel(data) {
  // Usar sheetjs (SheetJS) librería
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "AirLink");
  XLSX.writeFile(wb, `airlink_${Date.now()}.xlsx`);
}
```

#### 9. **Gráficas Adicionales**
- **Heatmap:** PM2.5 por hora del día (eje Y) × días (eje X)
- **Correlación:** Temperatura vs Humedad
- **Tendencia:** Línea de regresión PM2.5 semanal
- **Distribución:** Histograma de frecuencias de PM10

#### 10. **Dashboard Comparativo Multi-Dispositivo**
Si hay múltiples sensores AirLink (campus):
```javascript
// Selector en navbar:
// <select id="deviceSelector">
//   <option value="Airlink SITEM SEMGAS">Lab SEMGAS</option>
//   <option value="Airlink Campus">Entrada Principal</option>
// </select>

// Filtrar lecturas por device_id
const readings = cachedData.filter(r => r.device_id === selectedDevice);
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1 (Inmediato)
- [ ] Reemplazar `js/charts.js` con `charts-fixed.js`
- [ ] Validar escala de temperatura
- [ ] Probar descarga CSV con datos reales
- [ ] Confirmar que líneas discontinuas funcionan

### Fase 2 (Esta semana)
- [ ] Revisar CORS en `api.py` 
- [ ] Agregar validación de SECRET_KEY
- [ ] Implementar rate limiting
- [ ] Pruebas de expiración de JWT

### Fase 3 (Próximas semanas)
- [ ] Agregar indicador AQI
- [ ] Caché inteligente por rango
- [ ] Notificaciones de alertas
- [ ] Exportación a Excel

### Fase 4 (Futuro)
- [ ] Gráficas adicionales (heatmap, etc.)
- [ ] Comparación multi-dispositivo
- [ ] App móvil nativa (Flutter)
- [ ] Predicción/Forecasting (ML)

---

## 🔄 NOTAS DE COMPATIBILIDAD

| Elemento | Antes | Después | Acción |
|----------|-------|---------|--------|
| `metrics.temperature_c` | ✅ | ❌ | Usar `metrics.temp` |
| `metrics.humidity` | ✅ | ❌ | Usar `metrics.hum` |
| `metrics.pm1/pm25/pm10` | ✅ | ❌ | Usar `metrics.pm_1/pm_2p5/pm_10` |
| Líneas continuas | Sí | No | Agregar `spanGaps: false` |
| CSV limitado | 7 cols | 18 cols | Más info disponible |

---

## 🧪 TESTING RECOMENDADO

### Unit Tests
```javascript
// Validar buildDatasets()
const mock = { metrics: { temp: 100.4, hum: 53.6, pm_1: 15.81 } };
const ds = buildDatasets([mock]);
assert(ds.tempData[0] === 100.4); // O 10.04 si divide por 10
```

### Integration Tests
- [ ] Login → Dashboard → Cargar datos → Descargar CSV (flujo completo)
- [ ] Cambiar rango horario sin errores
- [ ] Toggle de datasets actualiza gráficas
- [ ] Cambio de tema no rompe colores

### Load Tests
```bash
# Con Apache Bench o k6:
ab -n 1000 -c 10 "https://api.example.com/readings?range=24h"
```

---

## 📚 REFERENCIAS

- [Chart.js - Line Charts](https://www.chartjs.org/docs/latest/charts/line.html)
- [EPA AQI Breakpoints](https://www.epa.gov/air-quality-aqi/aqi-basics)
- [OAuth 2.0 JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [CORS Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Documento generado:** 21 Agosto 2026  
**Versión:** 1.0  
**Autor:** Claude (Análisis)  
**Estado:** Listo para revisión
