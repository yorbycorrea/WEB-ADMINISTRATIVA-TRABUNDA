import express from "express";
import cors from "cors";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { initDB } from "./db/index.js";
import { getTrabundaToken, getRutasToken, invalidateToken } from "./services/serviceAuth.js";
import { getAllUsers, verifyUser, createUser, updateUser, deleteUser } from "./services/userStore.js";

const app        = express();
const PORT       = process.env.GATEWAY_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(morgan("dev"));
app.use(express.json());


// ─── Middleware: verifica JWT ─────────────────────────────────────────────────
// Se aplica a todas las rutas protegidas.
function verifyToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Acceso denegado: no se envió token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

// ─── Middleware: solo superadmin ──────────────────────────────────────────────
// Para endpoints de gestión de usuarios que nadie más puede tocar.
function requireSuperadmin(req, res, next) {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ error: "Solo el superadmin puede realizar esta acción" });
  }
  next();
}

// ─── Middleware: verifica permiso específico ──────────────────────────────────
// Recibe el nombre de la app ("trabunda", "rutas", "overview").
// El superadmin siempre pasa — solo los usuarios normales son limitados.
function requirePermission(appName) {
  return (req, res, next) => {
    if (req.user?.role === "superadmin") return next(); // superadmin todo permitido
    if (!req.user?.permissions?.includes(appName)) {
      return res.status(403).json({ error: `Sin acceso a "${appName}"` });
    }
    next();
  };
}

// ─── Helper: llamada autenticada a un backend externo ────────────────────────
async function fetchService(getToken, invalidateName, url, options = {}) {
  const token = await getToken();
  const res   = await fetch(url, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    invalidateToken(invalidateName);
    throw new Error(`Backend rechazó el token del Admin Suite (${res.status})`);
  }

  // Para respuestas no-OK (ej: 400, 404, 500) intentamos parsear el body
  // y re-lanzamos con el detalle real del backend.
  if (!res.ok) {
    const text = await res.text();
    let detail;
    try   { detail = JSON.parse(text); }
    catch { detail = text; }
    const err = new Error(`Backend devolvió HTTP ${res.status} en ${url}`);
    err.backendStatus = res.status;
    err.backendDetail = detail;
    throw err;
  }

  return res.json();
}


// ─── RUTAS PÚBLICAS ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "ok", port: PORT });
});

// LOGIN — el único endpoint completamente público
// Ahora verifica superadmin (.env) O usuario en users.json
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  // 1. ¿Es el superadmin?
  if (username === process.env.SUPERADMIN_USER && password === process.env.SUPERADMIN_PASS) {
    const token = jwt.sign(
      { username, role: "superadmin", permissions: ["overview", "trabunda", "rutas", "users"] },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    return res.json({ token, user: { username, role: "superadmin", displayName: "Super Admin",
      permissions: ["overview", "trabunda", "rutas", "users"] } });
  }

  // 2. ¿Es un usuario registrado en users.json?
  try {
    const user = await verifyUser(username, password);
    if (!user) return res.status(401).json({ error: "Credenciales incorrectas" });

    const token = jwt.sign(
      { username: user.username, role: "operator", permissions: user.permissions, id: user.id },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    return res.json({ token, user: { ...user, role: "operator" } });
  } catch (err) {
    return res.status(500).json({ error: "Error interno al verificar credenciales" });
  }
});


// ─── RUTAS PROTEGIDAS: perfil y servicios ────────────────────────────────────

app.get("/auth/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

app.get("/services/health", verifyToken, async (_req, res) => {
  const services = [
    { name: "trabunda-api", url: `${process.env.TRABUNDA_API_URL || "http://localhost:3001"}/health` },
    { name: "rutas-api",    url: `${process.env.RUTAS_API_URL    || "http://localhost:3002"}/health` },
  ];
  const results = await Promise.allSettled(
    services.map(({ name, url }) =>
      fetch(url)
        .then(r => r.json())
        .then(data => ({ name, status: "online", data }))
        .catch(() => ({ name, status: "offline", data: null }))
    )
  );
  res.json({ gateway: "ok", services: results.map(r => r.value) });
});


// ─── GESTIÓN DE USUARIOS (solo superadmin) ────────────────────────────────────
// Estos endpoints permiten al superadmin crear y administrar usuarios
// con permisos limitados a ciertas apps del Admin Suite.

// Listar todos los usuarios
app.get("/admin/users", verifyToken, requireSuperadmin, async (_req, res) => {
  const users = await getAllUsers();
  res.json({ users });
});

// Crear usuario
// Body: { username, password, displayName, permissions: ["trabunda", "rutas", "overview"] }
app.post("/admin/users", verifyToken, requireSuperadmin, async (req, res) => {
  const { username, password, displayName, permissions } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username y password son requeridos" });
  }

  // Validamos que los permisos sean valores conocidos
  const VALID_PERMISSIONS = ["overview", "trabunda", "rutas"];
  const invalid = (permissions || []).filter(p => !VALID_PERMISSIONS.includes(p));
  if (invalid.length) {
    return res.status(400).json({ error: `Permisos inválidos: ${invalid.join(", ")}` });
  }

  try {
    const user = await createUser({ username, password, displayName, permissions });
    res.status(201).json({ user });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// Editar usuario (puede cambiar displayName, permissions o contraseña)
app.put("/admin/users/:id", verifyToken, requireSuperadmin, async (req, res) => {
  const { displayName, password, permissions } = req.body;
  try {
    const user = await updateUser(req.params.id, { displayName, password, permissions });
    res.json({ user });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Eliminar usuario
app.delete("/admin/users/:id", verifyToken, requireSuperadmin, async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});


// ─── ADMIN TRABUNDA: Listar usuarios del backend de Trabunda (solo superadmin) ──
// Usa el endpoint /users/pickers con todos los roles para obtener la lista completa.
// Devuelve: [{ id, nombre, role }]
app.get("/dashboard/trabunda/admin/usuarios", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.TRABUNDA_BACKEND_URL;
  if (!base || !process.env.TRABUNDA_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Trabunda no configurado en .env" });
  }
  try {
    const data = await fetchService(
      getTrabundaToken, "trabunda",
      `${base}/users/pickers?roles=PLANILLERO,ADMINISTRADOR,SANEAMIENTO`
    );
    res.json({ usuarios: Array.isArray(data) ? data : [] });
  } catch (err) {
    console.error(`[Trabunda] Error listando usuarios:`, err.message, err.backendDetail ?? "");
    if (err.backendStatus) {
      return res.status(err.backendStatus).json({ ok: false, error: "Error al listar usuarios", detail: err.backendDetail ?? err.message });
    }
    res.status(502).json({ ok: false, error: "No se pudo obtener usuarios de Trabunda", detail: err.message });
  }
});

// ─── ADMIN TRABUNDA: Crear usuario en el backend de Trabunda (solo superadmin) ─
// Body esperado: { username, password, nombre, roles }
// Roles válidos: ADMINISTRADOR | PLANILLERO | SANEAMIENTO
app.post("/dashboard/trabunda/admin/usuarios", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.TRABUNDA_BACKEND_URL;
  if (!base || !process.env.TRABUNDA_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Trabunda no configurado en .env" });
  }
  try {
    const { username, password, nombre, roles } = req.body;

    // El backend de Trabunda espera roles como array: ["PLANILLERO"]
    const rolesPayload = Array.isArray(roles) ? roles : [roles];

    console.log(`[Trabunda] Creando usuario "${username}" con rol "${rolesPayload}" → POST ${base}/auth/register`);

    const data = await fetchService(getTrabundaToken, "trabunda", `${base}/auth/register`, {
      method: "POST",
      body: JSON.stringify({ username, password, nombre, roles: rolesPayload }),
    });

    console.log(`[Trabunda] Usuario creado:`, JSON.stringify(data));
    res.status(201).json(data);
  } catch (err) {
    console.error(`[Trabunda] Error al crear usuario:`, err.message, err.backendDetail ?? "");
    // Si el backend rechazó (4xx), reenviar el código y detalle real
    if (err.backendStatus) {
      return res.status(err.backendStatus).json({
        ok: false,
        error: "El backend de Trabunda rechazó la petición",
        detail: err.backendDetail ?? err.message,
      });
    }
    res.status(502).json({ ok: false, error: "No se pudo crear el usuario en Trabunda", detail: err.message });
  }
});


// ─── DASHBOARD DE TRABUNDA (requiere permiso "trabunda") ─────────────────────
app.get("/dashboard/trabunda", verifyToken, requirePermission("trabunda"), async (_req, res) => {
  const base = process.env.TRABUNDA_BACKEND_URL;
  if (!base || !process.env.TRABUNDA_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Trabunda no configurado en .env" });
  }
  try {
    const call = (path) => fetchService(getTrabundaToken, "trabunda", `${base}${path}`);
    const hoy  = new Date().toISOString().split("T")[0];

    const safeJson = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };

    const [health, healthWorkers, areas, reportesHoy, usuarios] = await Promise.allSettled([
      safeJson(`${base}/health`),
      safeJson(`${base}/health/workers`),
      call("/areas"),
      call(`/reportes?fecha=${hoy}&limit=200`),
      call("/users/pickers?roles=PLANILLERO,ADMINISTRADOR,SANEAMIENTO"),
    ]);

    const todosReportes  = reportesHoy.value?.reportes ?? reportesHoy.value?.data ?? [];
    const reportesPorTipo = todosReportes.reduce((acc, r) => {
      const tipo = r.tipo_reporte ?? r.tipo ?? "OTRO";
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});

    res.json({
      configured: true,
      health:        health.status        === "fulfilled" ? health.value        : null,
      healthWorkers: healthWorkers.status === "fulfilled" ? healthWorkers.value : null,
      areas:         areas.status         === "fulfilled" ? areas.value         : null,
      reportesHoy:   { total: todosReportes.length, porTipo: reportesPorTipo, items: todosReportes.slice(0, 10) },
      usuarios:      usuarios.status === "fulfilled" ? usuarios.value : null,
    });
  } catch (err) {
    res.status(502).json({ configured: true, error: "No se pudo conectar con Trabunda", detail: err.message });
  }
});


// ─── REPORTES DE TRABUNDA (requiere permiso "trabunda") ──────────────────────
// El backend de Trabunda usa paginación por "page" (no offset).
// El array de reportes viene en el campo "items".
// Parámetros soportados: fecha, tipo, turno, q, page, limit, desde, hasta, area_id
app.get("/dashboard/trabunda/reportes", verifyToken, requirePermission("trabunda"), async (req, res) => {
  const base = process.env.TRABUNDA_BACKEND_URL;
  if (!base || !process.env.TRABUNDA_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Trabunda no configurado en .env" });
  }
  try {
    const fecha   = req.query.fecha    || new Date().toISOString().split("T")[0];
    const tipo    = req.query.tipo     || "";
    const turno   = req.query.turno    || "";
    const q       = req.query.q        || "";
    const area_id = req.query.area_id  || "";
    const desde   = req.query.desde    || "";
    const hasta   = req.query.hasta    || "";
    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 25;

    // Construimos la URL con todos los filtros que vengan
    const params = new URLSearchParams({ fecha, page, limit });
    if (tipo)    params.set("tipo",    tipo);
    if (turno)   params.set("turno",   turno);
    if (q)       params.set("q",       q);
    if (area_id) params.set("area_id", area_id);
    if (desde)   params.set("desde",   desde);
    if (hasta)   params.set("hasta",   hasta);

    const data = await fetchService(getTrabundaToken, "trabunda", `${base}/reportes?${params}`);

    // El backend de Trabunda devuelve los registros en el campo "items"
    const reportes   = data?.items ?? [];
    const total      = data?.total      ?? reportes.length;
    const totalPages = data?.total_pages ?? 1;
    const currentPage = data?.page      ?? page;

    res.json({ reportes, total, totalPages, page: currentPage, fecha, tipo });
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener reportes de Trabunda", detail: err.message });
  }
});


// ─── DETALLE COMPLETO DE UN REPORTE (requiere permiso "trabunda") ────────────
// Obtiene cabecera + contenido interno según el tipo de reporte.
// Cada tipo tiene su propio endpoint en el backend de Trabunda.
app.get("/dashboard/trabunda/reportes/:id/detalle", verifyToken, requirePermission("trabunda"), async (req, res) => {
  const base = process.env.TRABUNDA_BACKEND_URL;
  if (!base || !process.env.TRABUNDA_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const { id } = req.params;

    // 1. Cabecera — igual para todos los tipos
    const cabecera = await fetchService(getTrabundaToken, "trabunda", `${base}/reportes/${id}`);
    const tipo = cabecera.tipo_reporte;

    // 2. Contenido — cada tipo tiene su propio endpoint y estructura
    let contenido = null;
    if (tipo === "APOYO_HORAS" || tipo === "SANEAMIENTO") {
      contenido = await fetchService(getTrabundaToken, "trabunda", `${base}/reportes/${id}/lineas`);
    } else if (tipo === "TRABAJO_AVANCE") {
      contenido = await fetchService(getTrabundaToken, "trabunda", `${base}/reportes/trabajo-avance/${id}/resumen`);
    } else if (tipo === "CONTEO_RAPIDO") {
      contenido = await fetchService(getTrabundaToken, "trabunda", `${base}/reportes/conteo-rapido/${id}`);
    }

    res.json({ cabecera, contenido, tipo });
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener el detalle del reporte", detail: err.message });
  }
});


// ─── DASHBOARD DE RUTAS (requiere permiso "rutas") ────────────────────────────
app.get("/dashboard/rutas", verifyToken, requirePermission("rutas"), async (_req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Rutas no configurado en .env" });
  }
  try {
    const call = (path) => fetchService(getRutasToken, "rutas", `${base}${path}`);

    const [health, empresas] = await Promise.allSettled([
      fetch(`${base}/health`).then(r => r.json()).catch(() => null),
      call("/empresas_transporte"),
    ]);

    const empresasData = empresas.value?.items ?? [];
    const empresasConTransportistas = await Promise.allSettled(
      empresasData.map(async (emp) => {
        try {
          const data = await call(`/empresas_transporte/${emp.id_empresa_transporte}/transportistas`);
          return { ...emp, transportistas: data.items ?? [] };
        } catch {
          return { ...emp, transportistas: [] };
        }
      })
    );

    res.json({
      configured: true,
      health:               health.status === "fulfilled" ? health.value : null,
      empresas:             empresasConTransportistas.map(r => r.value ?? r.reason),
      totalEmpresas:        empresasData.length,
      totalEmpresasActivas: empresasData.filter(e => e.activo).length,
    });
  } catch (err) {
    res.status(502).json({ configured: true, error: "No se pudo conectar con Rutas", detail: err.message });
  }
});


// ─── ADMIN RUTAS: Listar rutas (solo superadmin) ─────────────────────────────
app.get("/dashboard/rutas/admin/rutas", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Rutas no configurado en .env" });
  }
  try {
    const params = req.query.activo !== undefined ? `?activo=${req.query.activo}` : "";
    const data = await fetchService(getRutasToken, "rutas", `${base}/rutas${params}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener las rutas", detail: err.message });
  }
});

// ─── ADMIN RUTAS: Crear ruta (solo superadmin) ────────────────────────────────
app.post("/dashboard/rutas/admin/rutas", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/rutas`, {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    res.status(data.ok === false ? 409 : 201).json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo crear la ruta", detail: err.message });
  }
});

// ─── ADMIN RUTAS: Activar/Desactivar ruta (solo superadmin) ──────────────────
app.put("/dashboard/rutas/admin/rutas/:id/toggle", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/rutas/${req.params.id}/toggle-activo`, {
      method: "PUT",
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo actualizar la ruta", detail: err.message });
  }
});

// ─── ADMIN RUTAS: Listar áreas activas (solo superadmin) ─────────────────────
app.get("/dashboard/rutas/admin/areas", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/areas?activo=1&limit=100`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener las áreas", detail: err.message });
  }
});

// ─── ADMIN RUTAS: Asignar área a un trabajador por DNI (solo superadmin) ──────
app.put("/dashboard/rutas/admin/trabajadores/:dni/area", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/trabajadores/${req.params.dni}/area`, {
      method: "PUT",
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (err) {
    if (err.backendStatus) {
      return res.status(err.backendStatus).json({ ok: false, error: err.backendDetail ?? err.message });
    }
    res.status(502).json({ ok: false, error: "Error al asignar área", detail: err.message });
  }
});

// ─── ADMIN RUTAS: Asignación masiva de área a múltiples DNIs (solo superadmin) ─
// Body: { id_area, dnis: ["12345678", ...] }
app.put("/dashboard/rutas/admin/trabajadores/area/bulk", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/trabajadores/area/bulk`, {
      method: "PUT",
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (err) {
    if (err.backendStatus) {
      return res.status(err.backendStatus).json({ ok: false, error: err.backendDetail ?? err.message });
    }
    res.status(502).json({ ok: false, error: "Error en asignación masiva", detail: err.message });
  }
});

// ─── ADMIN RUTAS: Trabajadores escaneados sin área asignada (solo superadmin) ─
app.get("/dashboard/rutas/admin/trabajadores-sin-area", verifyToken, requireSuperadmin, async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const params = new URLSearchParams();
    if (req.query.fecha)   params.set("fecha",   req.query.fecha);
    if (req.query.id_ruta) params.set("id_ruta", req.query.id_ruta);
    const data = await fetchService(getRutasToken, "rutas", `${base}/admin/trabajadores-sin-area?${params}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener trabajadores sin área", detail: err.message });
  }
});


// ─── REPORTES DE RUTAS: lista de jornadas ────────────────────────────────────
// Filtros: fecha (requerido), id_turno, id_ruta, placa, estado, limit, offset
app.get("/dashboard/rutas/reportes", verifyToken, requirePermission("rutas"), async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false, error: "Backend de Rutas no configurado en .env" });
  }
  try {
    const fecha = req.query.fecha || new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({ fecha });
    if (req.query.id_turno) params.set("id_turno", req.query.id_turno);
    if (req.query.id_ruta)  params.set("id_ruta",  req.query.id_ruta);
    if (req.query.placa)    params.set("placa",     String(req.query.placa).toUpperCase());
    if (req.query.estado)   params.set("estado",    req.query.estado);
    params.set("limit",  req.query.limit  ?? "100");
    params.set("offset", req.query.offset ?? "0");

    const data = await fetchService(getRutasToken, "rutas", `${base}/reportes/jornadas?${params}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener reportes de Rutas", detail: err.message });
  }
});

// ─── REPORTES DE RUTAS: resumen de una jornada ───────────────────────────────
app.get("/dashboard/rutas/reportes/:id/resumen", verifyToken, requirePermission("rutas"), async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/reportes/jornada/${req.params.id}/resumen`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener el resumen de la jornada", detail: err.message });
  }
});

// ─── REPORTES DE RUTAS: trabajadores de una jornada ──────────────────────────
app.get("/dashboard/rutas/reportes/:id/detalle", verifyToken, requirePermission("rutas"), async (req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;
  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({ configured: false });
  }
  try {
    const data = await fetchService(getRutasToken, "rutas", `${base}/reportes/jornada/${req.params.id}/detalle`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener el detalle de la jornada", detail: err.message });
  }
});


// ─── PROXIES INTERNOS (implementación manual con fetch) ──────────────────────
// Reenvía la petición al servicio interno quitando el prefijo del path.
// Usamos fetch directamente en lugar de http-proxy-middleware para evitar
// conflictos con el enrutador de Express 5.
async function proxyTo(baseUrl, prefixToRemove, req, res) {
  const subPath     = req.path.replace(new RegExp(`^${prefixToRemove}`), "") || "/";
  const queryString = Object.keys(req.query).length
    ? "?" + new URLSearchParams(req.query).toString()
    : "";
  const targetUrl   = `${baseUrl}${subPath}${queryString}`;

  const hasBody = !["GET", "HEAD"].includes(req.method) && req.body;
  const upstream = await fetch(targetUrl, {
    method:  req.method,
    headers: { "Content-Type": "application/json" },
    body:    hasBody ? JSON.stringify(req.body) : undefined,
  });

  res.status(upstream.status);
  const text = await upstream.text();
  try {
    res.json(JSON.parse(text));
  } catch {
    res.send(text);
  }
}

// app.use con prefijo de ruta — Express lo maneja correctamente
// sin path-to-regexp, evitando el conflicto con Express 5
app.use("/api/trabunda", verifyToken, (req, res) =>
  proxyTo(`http://localhost:${process.env.TRABUNDA_API_PORT || 3001}`, "/api/trabunda", req, res)
);

app.use("/api/rutas", verifyToken, (req, res) =>
  proxyTo(`http://localhost:${process.env.RUTAS_API_PORT || 3002}`, "/api/rutas", req, res)
);


// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
// Primero inicializamos la BD (crea las tablas si no existen),
// luego arrancamos el servidor HTTP.
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🛡️  Gateway corriendo en http://localhost:${PORT}`);
      console.log(`   POST /auth/login           → login (superadmin + usuarios)`);
      console.log(`   GET  /admin/users          → listar usuarios (superadmin)`);
      console.log(`   POST /admin/users          → crear usuario (superadmin)`);
      console.log(`   GET  /dashboard/trabunda   → datos Trabunda`);
      console.log(`   GET  /dashboard/rutas      → datos Rutas\n`);
    });
  })
  .catch((err) => {
    console.error("❌ No se pudo conectar a la base de datos:", err.message);
    process.exit(1); // si no hay BD, no tiene sentido arrancar el gateway
  });
