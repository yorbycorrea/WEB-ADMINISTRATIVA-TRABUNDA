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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export function apiGetMe() {
  return apiFetch('/auth/me');
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export function apiGetServicesHealth() {
  return apiFetch('/services/health');
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

// Rutas actualizadas a /dashboard/trabunda y /dashboard/rutas
export function apiGetTrabundaDashboard() {
  return apiFetch('/dashboard/trabunda');
}

// Reportes de Trabunda con filtros opcionales
// El backend usa paginación por "page" y devuelve los datos en "items"
export function apiGetTrabundaReportes({ fecha, tipo, turno, q, area_id, page = 1, limit = 25 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (fecha)   params.set('fecha',   fecha);
  if (tipo)    params.set('tipo',    tipo);
  if (turno)   params.set('turno',   turno);
  if (q)       params.set('q',       q);
  if (area_id) params.set('area_id', area_id);
  return apiFetch(`/dashboard/trabunda/reportes?${params}`);
}

export function apiGetRutasDashboard() {
  return apiFetch('/dashboard/rutas');
}

// Detalle completo de un reporte (cabecera + contenido interno)
export function apiGetTrabundaReporteDetalle(id) {
  return apiFetch(`/dashboard/trabunda/reportes/${id}/detalle`);
}

// ─── Gestión de usuarios (solo superadmin) ────────────────────────────────────

export function apiGetUsers() {
  return apiFetch('/admin/users');
}

export function apiCreateUser(data) {
  return apiFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiUpdateUser(id, data) {
  return apiFetch(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function apiDeleteUser(id) {
  return apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
}
