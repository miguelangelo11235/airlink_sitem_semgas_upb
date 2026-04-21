/* ============================================================
   api.js — Capa de comunicación con el backend FastAPI
   ============================================================ */

const API_BASE = 'https://airlink-sitem-semgas-upb.onrender.com'; // Ajustar según despliegue

// ── Auth guard: si no hay token, redirigir al login ───────────
const _token = sessionStorage.getItem('al_token');
if (!_token) {
  window.location.href = 'index.html';
}

// ── Headers comunes ───────────────────────────────────────────
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${_token}`,
  };
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  sessionStorage.removeItem('al_token');
  sessionStorage.removeItem('al_user');
  window.location.href = 'index.html';
}

// ── Obtener lecturas ──────────────────────────────────────────
/**
 * Obtiene lecturas del backend.
 * @param {string} range — '1h' | '6h' | '24h' | '7d'
 * @returns {Promise<Array>} Array de documentos con timestamp + metrics
 */
async function fetchReadings(range = '24h') {
  const res = await fetch(`${API_BASE}/readings?range=${range}`, {
    headers: authHeaders(),
  });

  if (res.status === 401) {
    logout();
    return [];
  }

  if (!res.ok) {
    throw new Error(`Error al obtener lecturas: ${res.status}`);
  }

  return res.json();
}

// ── Obtener última lectura ────────────────────────────────────
async function fetchLatest() {
  const res = await fetch(`${API_BASE}/latest`, {
    headers: authHeaders(),
  });

  if (res.status === 401) {
    logout();
    return null;
  }

  if (!res.ok) return null;
  return res.json();
}