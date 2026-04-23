/* ============================================================
   auth.js — Lógica de autenticación (login page)
   ============================================================ */

//const API_BASE = 'https://airlink-sitem-semgas-upb.onrender.com'; // Ajustar según despliegue
const API_BASE = 'http://localhost:8000';

// ── Particles animation ──────────────────────────────────────
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

// ── DOM refs ─────────────────────────────────────────────────
const form = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');
const btnText = btnLogin.querySelector('.btn-text');
const btnSpinner = btnLogin.querySelector('.btn-spinner');
const errorMsg = document.getElementById('errorMsg');
const togglePwd = document.getElementById('togglePwd');
const pwdInput = document.getElementById('password');

// ── Toggle password visibility ───────────────────────────────
togglePwd.addEventListener('click', () => {
  const isText = pwdInput.type === 'text';
  pwdInput.type = isText ? 'password' : 'text';
  togglePwd.setAttribute('aria-label', isText ? 'Mostrar contraseña' : 'Ocultar contraseña');
});

// ── Show / hide error ─────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}
function hideError() {
  errorMsg.classList.remove('visible');
}

// ── Loading state ─────────────────────────────────────────────
function setLoading(loading) {
  btnLogin.disabled = loading;
  btnText.hidden = loading;
  btnSpinner.hidden = !loading;
}

// ── Submit handler ────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById('username').value.trim();
  const password = pwdInput.value;

  if (!username || !password) {
    showError('Por favor ingresa usuario y contraseña.');
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      // Guardar token y usuario en sessionStorage
      sessionStorage.setItem('al_token', data.token);
      sessionStorage.setItem('al_user', username);
      // Redirigir al dashboard
      window.location.href = 'dashboard.html';
    } else {
      const err = await res.json().catch(() => ({}));
      showError(err.detail || 'Credenciales incorrectas. Inténtalo de nuevo.');
      setLoading(false);
    }
  } catch (err) {
    showError('No se pudo conectar al servidor. Verifica que la API esté activa.');
    setLoading(false);
  }
});

// ── Guards de navegación ──────────────────────────────────────
// Si ya hay sesión activa, ir directo al dashboard
if (sessionStorage.getItem('al_token')) {
  window.location.href = 'dashboard.html';
}