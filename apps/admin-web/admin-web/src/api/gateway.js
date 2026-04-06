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

// ─── Admin Trabunda (solo superadmin) ────────────────────────────────────────

// Lista todos los usuarios del backend de Trabunda (pickers con todos los roles)
export function apiGetUsuariosTrabunda() {
  return apiFetch('/dashboard/trabunda/admin/usuarios');
}

// Crea un usuario en el backend de Trabunda
// roles: 'ADMINISTRADOR' | 'PLANILLERO' | 'SANEAMIENTO'
export function apiCrearUsuarioTrabunda({ username, nombre, password, roles }) {
  return apiFetch('/dashboard/trabunda/admin/usuarios', {
    method: 'POST',
    body: JSON.stringify({ username, nombre, password, roles }),
  });
}

// ─── Admin Rutas (solo superadmin) ────────────────────────────────────────────

// Listar todas las rutas del sistema (con filtro opcional por activo: 0 | 1)
export function apiGetRutasAdminRutas(activo) {
  const qs = activo !== undefined ? `?activo=${activo}` : '';
  return apiFetch(`/dashboard/rutas/admin/rutas${qs}`);
}

// Crear nueva ruta
export function apiCreateRuta({ codigo, nombre, descripcion }) {
  return apiFetch('/dashboard/rutas/admin/rutas', {
    method: 'POST',
    body: JSON.stringify({ codigo, nombre, descripcion }),
  });
}

// Activar (activo=1) o desactivar (activo=0) una ruta
export function apiToggleRuta(id, activo) {
  return apiFetch(`/dashboard/rutas/admin/rutas/${id}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ activo }),
  });
}

// Trabajadores escaneados en la fecha dada pero sin id_area asignado
export function apiGetTrabajadoresSinArea({ fecha, id_ruta } = {}) {
  const params = new URLSearchParams();
  if (fecha)   params.set('fecha',   fecha);
  if (id_ruta) params.set('id_ruta', id_ruta);
  return apiFetch(`/dashboard/rutas/admin/trabajadores-sin-area?${params}`);
}

// Listar todas las áreas activas del sistema Rutas
export function apiGetRutasAreas() {
  return apiFetch('/dashboard/rutas/admin/areas');
}

// Asignar área a un trabajador individual por DNI
export function apiAsignarAreaTrabajador(dni, id_area) {
  return apiFetch(`/dashboard/rutas/admin/trabajadores/${dni}/area`, {
    method: 'PUT',
    body: JSON.stringify({ id_area }),
  });
}

// Asignar un área a múltiples trabajadores a la vez
export function apiAsignarAreaBulk(id_area, dnis) {
  return apiFetch('/dashboard/rutas/admin/trabajadores/area/bulk', {
    method: 'PUT',
    body: JSON.stringify({ id_area, dnis }),
  });
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
