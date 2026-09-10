# 🌿 AirLink SITEM-SEMGAS — Monitoreo Ambiental UPB Montería

Plataforma web de monitoreo ambiental en tiempo real y visualización de datos históricos de la estación **Davis AirLink SITEM-SEMGAS**, desplegada en el campus de la Universidad Pontificia Bolivariana (UPB) Seccional Montería.

---

## 🚀 Características Principales

- **Visualización en Tiempo Real**: Tarjetas KPI e indicadores de calidad de aire (PM1.0, PM2.5, PM10, Temperatura, Humedad).
- **Gráficas Interactivas con Chart.js**:
  - Filtros de tiempo por 2H, 6H, 12H, 24H y 7D.
  - Soporte de horario local (UTC-5).
  - Política de líneas discontinuas en vacíos de datos superiores a 2 horas.
- **Exportación de Datos CSV**: Descarga de históricos completos con 18 columnas estandarizadas de la base de datos de calidad del aire.
- **Tema Claro / Oscuro**: Diseño moderno adaptativo de alto contraste.

---

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3 vanilla (Power BI design style), JavaScript (ES6+).
- **Visualización**: Chart.js 4.4 + `chartjs-adapter-date-fns`.
- **Backend API**: FastAPI / Render (`https://airlink-sitem-semgas-upb.onrender.com`).

---

## 🌐 Despliegue en GitHub Pages

Para publicar esta plataforma en GitHub Pages:

1. Ir a **Settings** ⚙️ $\rightarrow$ **Pages** en el repositorio de GitHub.
2. En **Build and deployment**, seleccionar `Deploy from a branch`.
3. Elegir la rama `main` y la carpeta `/(root)`.
4. Guardar los cambios.