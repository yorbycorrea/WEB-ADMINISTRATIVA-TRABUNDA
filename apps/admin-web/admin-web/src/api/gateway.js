// Cliente centralizado para todas las peticiones al Gateway.

function getToken() {
  return localStorage.getItem('admin_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
    return;
  }

  return res.json();
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export function apiGetServicesHealth() {
  return apiFetch('/services/health');
}

export function apiGetMe() {
  return apiFetch('/auth/me');
}

// Datos del backend real de Trabunda
export function apiGetTrabundaDashboard() {
  return apiFetch('/trabunda/dashboard');
}

// Datos del backend real de Rutas
export function apiGetRutasDashboard() {
  return apiFetch('/rutas/dashboard');
}
