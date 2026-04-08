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

// Listar trabajadores con área asignada (y ruta del último scan)
// Endpoint real del backend: GET /trabajadores/con-area
// Respuesta: { ok, total, items: [{ dni, nombres, apellidos, cargo, id_area, area_codigo, area_nombre, id_ruta, ruta_codigo, ruta_nombre, hora_scan }] }
// hoy: '1' = ruta del scan de HOY (default) | '0' = último scan histórico
export function apiGetRutasTrabajadores({ id_area, id_ruta, con_ruta, hoy = '1' } = {}) {
  const params = new URLSearchParams({ hoy });
  if (id_area)  params.set('id_area',  id_area);
  if (id_ruta)  params.set('id_ruta',  id_ruta);
  if (con_ruta) params.set('con_ruta', con_ruta);
  return apiFetch(`/dashboard/rutas/admin/trabajadores?${params}`);
}

// ─── Calidad ──────────────────────────────────────────────────────────────────
export function apiGetCalidadDashboard() { return apiFetch('/dashboard/calidad'); }

export function apiGetCalidadReportesPesos({ page=1, limit=25, fecha, q } = {}) {
  const p = new URLSearchParams({ page, limit });
  if (fecha) p.set('fecha', fecha);
  if (q)     p.set('q', q);
  return apiFetch(`/dashboard/calidad/reportes/pesos?${p}`);
}
export function apiGetCalidadPesoDetalle(id) { return apiFetch(`/dashboard/calidad/reportes/pesos/${id}`); }

export function apiGetCalidadReportesTemperatura({ page=1, limit=25, fecha } = {}) {
  const p = new URLSearchParams({ page, limit });
  if (fecha) p.set('fecha', fecha);
  return apiFetch(`/dashboard/calidad/reportes/temperatura?${p}`);
}
export function apiGetCalidadTemperaturaDetalle(id) { return apiFetch(`/dashboard/calidad/reportes/temperatura/${id}`); }

export function apiGetCalidadReportesOrganoletica({ page=1, limit=25, fecha } = {}) {
  const p = new URLSearchParams({ page, limit });
  if (fecha) p.set('fecha', fecha);
  return apiFetch(`/dashboard/calidad/reportes/organoletica?${p}`);
}
export function apiGetCalidadOrganoleticaDetalle(id) { return apiFetch(`/dashboard/calidad/reportes/organoletica/${id}`); }

export function apiGetCalidadOcrEstado() { return apiFetch('/dashboard/calidad/ocr/estado'); }

// Admin
export function apiGetCalidadProductos() { return apiFetch('/dashboard/calidad/admin/productos'); }
export function apiCreateCalidadProducto(data) { return apiFetch('/dashboard/calidad/admin/productos', { method:'POST', body: JSON.stringify(data) }); }
export function apiUpdateCalidadProducto(id, data) { return apiFetch(`/dashboard/calidad/admin/productos/${id}`, { method:'PUT', body: JSON.stringify(data) }); }
export function apiToggleCalidadProducto(id, activo) { return apiFetch(`/dashboard/calidad/admin/productos/${id}/activo`, { method:'PATCH', body: JSON.stringify({ activo }) }); }
export function apiGetCalidadSupervisores() { return apiFetch('/dashboard/calidad/admin/supervisores'); }
export function apiGetCalidadOrugas() { return apiFetch('/dashboard/calidad/admin/orugas'); }
export function apiUpdateCalidadPeso(id, data) { return apiFetch(`/dashboard/calidad/admin/pesos/${id}`, { method:'PUT', body: JSON.stringify(data) }); }
export function apiDeleteCalidadPeso(id) { return apiFetch(`/dashboard/calidad/admin/pesos/${id}`, { method:'DELETE' }); }
export function apiUpdateCalidadTemperatura(id, data) { return apiFetch(`/dashboard/calidad/admin/temperatura/${id}`, { method:'PUT', body: JSON.stringify(data) }); }
export function apiDeleteCalidadTemperatura(id) { return apiFetch(`/dashboard/calidad/admin/temperatura/${id}`, { method:'DELETE' }); }
export function apiUpdateCalidadOrganoletica(id, data) { return apiFetch(`/dashboard/calidad/admin/organoletica/${id}`, { method:'PUT', body: JSON.stringify(data) }); }
export function apiDeleteCalidadOrganoletica(id) { return apiFetch(`/dashboard/calidad/admin/organoletica/${id}`, { method:'DELETE' }); }

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
