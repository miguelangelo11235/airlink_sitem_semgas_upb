# 🚀 Guía de Git y Despliegue en GitHub Pages - AirLink SITEM SEMGAS

Esta guía explica de forma clara y paso a paso cómo gestionar el control de versiones con Git, actualizar el repositorio en GitHub y desplegar la aplicación web en **GitHub Pages**.

---

## 📌 1. Verificación del Estado del Repositorio (`git status`)

Antes de realizar cualquier cambio o confirmación, revisa el estado actual del repositorio corriendo:

```bash
git status
```

**¿Qué muestra este comando?**
- **Rama actual**: `On branch main`.
- **Archivos modificados** (en rojo): Archivos existentes que han cambiado (ej: `css/dashboard.css`, `js/charts.js`).
- **Archivos no seguidos / Untracked** (en rojo): Nuevos archivos agregados al proyecto.
- **Archivos ignorados**: Archivos definidos en `.gitignore` (como `air_quality.raw_measurements.json` y la carpeta `legacy/`), los cuales no se subirán a GitHub para mantener el repositorio liviano y rápido.

---

## 🔄 2. Flujo Completo para Guardar y Subir Cambios a GitHub (`push`)

Cuando hayas realizado mejoras o correcciones en el código, sigue estos 3 pasos:

### Paso 1: Preparar los archivos (`git add`)
Agrega los archivos modificados y nuevos al área de preparación (stage):

```bash
# Agregar todos los archivos relevantes (respetando .gitignore)
git add .

# O agregar archivos específicos:
git add js/charts.js css/dashboard.css .gitignore HISTORIAL_VERSIONES.md
```

### Paso 2: Crear una confirmación / Commit (`git commit`)
Crea un punto de guardado en la historia del proyecto con un mensaje descriptivo:

```bash
git commit -m "feat: actualización de dashboard a v2, hora local, discontinuidad de datos y mejora de contraste"
```

### Paso 3: Subir los cambios a GitHub (`git push`)
Envía los commits de tu equipo local hacia el servidor remoto de GitHub:

```bash
git push origin main
```

---

## ⬇️ 3. Obtener Cambios desde GitHub (`git pull`)

Si trabajas desde otra computadora o se han realizado cambios en GitHub, sincroniza tu código local ejecutando:

```bash
git pull origin main
```

---

## 🌐 4. Despliegue en GitHub Pages (Servidor Web Gratuito)

Como este proyecto está construido con **HTML5, CSS3 y JavaScript vanilla** (sin necesidad de compilación previa), puedes activarlo gratuitamente en **GitHub Pages**:

### Pasos en GitHub:
1. Ve a tu repositorio en el navegador: [https://github.com/miguelangelo11235/airlink_sitem_semgas_upb](https://github.com/miguelangelo11235/airlink_sitem_semgas_upb)
2. Haz clic en **Settings** (Configuración) ⚙️.
3. En el menú lateral izquierdo, selecciona **Pages**.
4. En la sección **Build and deployment**:
   - **Source**: Selecciona `Deploy from a branch`.
   - **Branch**: Selecciona `main` / `/(root)`.
5. Haz clic en **Save** (Guardar).

En 1 o 2 minutos, GitHub generará tu enlace público (ej: `https://miguelangelo11235.github.io/airlink_sitem_semgas_upb/`).

---

## 💡 Resumen de Comandos Frecuentes

| Comando | Descripción |
|---|---|
| `git status` | Muestra qué archivos han cambiado o faltan por guardar. |
| `git diff` | Muestra exactamente las líneas de código modificadas. |
| `git add .` | Prepara todos los cambios del directorio para el commit. |
| `git commit -m "mensaje"` | Registra los cambios localmente. |
| `git push origin main` | Sube los cambios confirmados a GitHub. |
| `git pull origin main` | Descarga e integra la última versión de GitHub. |
| `git log -n 5` | Muestra los últimos 5 commits realizados. |
