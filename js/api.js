/* ============================================================
   api.js — Capa de comunicación con el backend FastAPI
   ============================================================ */

// const API_BASE = 'https://airlink-sitem-semgas-upb.onrender.com'; // Ajustar según despliegue
const API_BASE = 'http://localhost:8000';

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
 * @param {string} range — '1h' | '6h' | '12h' | '24h' | '7d'
 * @param {string} start — ISO string para fecha de inicio
 * @param {string} end — ISO string para fecha de fin
 * @returns {Promise<Array>} Array de documentos con timestamp + metrics
 */
async function fetchReadings(range = '24h', start = null, end = null) {
  let url = `${API_BASE}/readings?range=${range}`;
  if (start && end) {
    url = `${API_BASE}/readings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  }
  const res = await fetch(url, {
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

// ── Rango de Fechas Totales ──────────────────────────────────
async function fetchReadingsRange() {
  const res = await fetch(`${API_BASE}/readings/range`, {
    headers: authHeaders(),
  });

  if (res.status === 401) {
    logout();
    return null;
  }

  if (!res.ok) return null;
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