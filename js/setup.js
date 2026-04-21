/* ============================================================
   setup.js — Pantalla de configuración de conexión MongoDB
   ============================================================ */

const API_BASE = 'http://localhost:8000';

// ── Particles ────────────────────────────────────────────────
(function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      bottom: ${Math.random() * 20}%;
      width: ${1 + Math.random() * 2.5}px;
      height: ${1 + Math.random() * 2.5}px;
      animation-duration: ${6 + Math.random() * 10}s;
      animation-delay: ${Math.random() * 8}s;
    `;
    container.appendChild(p);
  }
})();

// ── DOM ──────────────────────────────────────────────────────
const form      = document.getElementById('setupForm');
const btnConn   = document.getElementById('btnConnect');
const btnText   = btnConn.querySelector('.btn-text');
const btnSpinner = btnConn.querySelector('.btn-spinner');
const errorMsg  = document.getElementById('errorMsg');

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}
function hideError() { errorMsg.classList.remove('visible'); }

function setLoading(on) {
  btnConn.disabled = on;
  btnText.hidden   = on;
  btnSpinner.hidden = !on;
}

// ── Si ya hay config guardada, ir directo al login ────────────
if (sessionStorage.getItem('al_config')) {
  window.location.href = 'index.html';
}

// ── Submit ───────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const config = {
    mongo_uri:        document.getElementById('mongoUri').value.trim(),
    mongo_db:         document.getElementById('mongoDb').value.trim() || 'air_quality',
    users_collection: document.getElementById('usersColl').value.trim() || 'users',
    readings_collection: document.getElementById('readingsColl').value.trim() || 'readings',
    secret_key:       document.getElementById('secretKey').value.trim(),
  };

  if (!config.mongo_uri) {
    showError('La URI de MongoDB es obligatoria.');
    return;
  }
  if (!config.secret_key) {
    showError('Ingresa una clave JWT secreta.');
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (res.ok) {
      // Guardar config (sin URI completa por seguridad, solo indicador)
      sessionStorage.setItem('al_config', JSON.stringify({
        mongo_db: config.mongo_db,
        readings_collection: config.readings_collection,
        configured: true,
      }));
      window.location.href = 'index.html';
    } else {
      const err = await res.json().catch(() => ({}));
      showError(err.detail || 'No se pudo conectar a MongoDB. Verifica la URI y credenciales.');
      setLoading(false);
    }
  } catch {
    showError('No se pudo contactar al servidor. ¿Está corriendo la API?');
    setLoading(false);
  }
});