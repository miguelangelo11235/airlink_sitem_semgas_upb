# 📜 Historial y Evolución del Proyecto - AirLink SITEM SEMGAS

Este documento describe el desarrollo y la evolución de la interfaz web del sistema de monitoreo ambiental **AirLink SITEM-SEMGAS UPB Montería**.

---

## 🏛️ Evolución de Fases

### 1. Fase 1 - Dashboard (Inicial)
- **Objetivo**: Prototipo inicial de visualización de datos de calidad de aire en tiempo real.
- **Estructura de Datos**:
  - `metrics.temperature_c`
  - `metrics.humidity`
  - `metrics.pm1`, `metrics.pm25`, `metrics.pm10`
- **Características**:
  - Autenticación básica de usuarios con MongoDB/Flask.
  - Tarjetas de resumen KPI sencillas.
  - Gráficas de líneas continuas en Chart.js.
  - Descarga básica de CSV con 7 columnas.

---

### 2. Fase 2 - Dashboard (Mejoras y Estabilización)
- **Objetivo**: Incorporación de seguridad JWT, optimización de diseño Power BI style y soporte para servidor estático/Render.
- **Estructura de Datos**:
  - Transición a campos estandarizados de estación AirLink (`temp`, `hum`, `pm_1`, `pm_2p5`, `pm_10`).
- **Características**:
  - Tema claro/oscuro dinámico.
  - Píldora de estado de conexión en vivo (online/offline).
  - Manejo de token de sesión y expiración.
  - Preparación de scripts para administración de usuarios (`create_user_app.py`, `mongo_users_setup.js`).

---

### 3. Fase 3 - Dashboard Unificado y Avanzado (Versión Actual en Raíz)
- **Objetivo**: Soporte total a la nueva estructura de MongoDB, histórico completo, tabla interactiva, filtros por fecha y descarga de CSV de 18 columnas.
- **Estructura de Datos**:
  - `metrics.temp` (Soporte automático Fahrenheit °F a Celsius °C si `temp > 45`).
  - `metrics.hum`
  - `metrics.dew_point`, `metrics.wet_bulb`, `metrics.heat_index` (Índices de confort térmico).
  - Promedios móviles: `pm_2p5_last_1_hour`, `pm_2p5_last_3_hours`, `pm_2p5_last_24_hours`, `pm_10_last_1_hour`, `pm_10_last_3_hours`, `pm_10_last_24_hours`.
  - Atributos raíz: `location` y `quality`.
- **Novedades en Interfaz**:
  - **Filtro Temporal Completo**: Selector rápido (24h, 7d, 30d) + Filtro de fecha y hora personalizada (`start`/`end`).
  - **Gráficas Discontinuas**: Configuración `spanGaps: false` para evitar unir puntos con falta de datos.
  - **Tabla de Datos Históricos**: Consulta paginada/interactiva de registros del sensor.
  - **Exportación CSV de 18 Columnas**: Descarga de datos estandarizada compatible con software estadístico (R, Excel, Python).

---

## 📁 Archivos de Resguardo Legados

Las versiones anteriores se mantienen organizadas en la carpeta `legacy/`:
- `legacy/Fase 1 - Dashboard/`
- `legacy/Fase 2 - Dashboard/`
