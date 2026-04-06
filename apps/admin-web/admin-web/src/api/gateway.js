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

// Reportes de Rutas: lista de jornadas con filtros opcionales
export function apiGetRutasReportes({ fecha, id_turno, id_ruta, placa, estado, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (fecha)    params.set('fecha',    fecha);
  if (id_turno) params.set('id_turno', id_turno);
  if (id_ruta)  params.set('id_ruta',  id_ruta);
  if (placa)    params.set('placa',    placa);
  if (estado)   params.set('estado',   estado);
  return apiFetch(`/dashboard/rutas/reportes?${params}`);
}

// Resumen estadístico de una jornada (marcados, asignados, faltantes)
export function apiGetRutasJornadaResumen(id) {
  return apiFetch(`/dashboard/rutas/reportes/${id}/resumen`);
}

// Lista de trabajadores marcados en una jornada
export function apiGetRutasJornadaDetalle(id) {
  return apiFetch(`/dashboard/rutas/reportes/${id}/detalle`);
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
