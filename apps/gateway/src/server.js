import express from "express";
import cors from "cors";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { getTrabundaToken, getRutasToken, invalidateToken } from "./services/serviceAuth.js";

const app = express();
const PORT       = process.env.GATEWAY_PORT       || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(morgan("dev"));
app.use(express.json());

// ─── Middleware JWT del Admin Suite ───────────────────────────────────────────
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Acceso denegado: no se envió token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

// ─── Helper: llamada autenticada a un backend externo ────────────────────────
// Centraliza el fetch con manejo de errores y re-intento si el token venció
async function fetchService(getToken, invalidateName, url, options = {}) {
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Si el backend rechazó el token, lo invalidamos y lanzamos error descriptivo
  if (res.status === 401 || res.status === 403) {
    invalidateToken(invalidateName);
    throw new Error(`Backend rechazó el token del Admin Suite (${res.status})`);
  }

  return res.json();
}

// ─── Rutas públicas ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "ok", port: PORT });
});

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    const token = jwt.sign(
      { username, role: "superadmin" },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    return res.json({ message: "Login exitoso", token, user: { username, role: "superadmin" } });
  }
  return res.status(401).json({ error: "Credenciales incorrectas" });
});

// ─── Rutas protegidas: Admin Suite ───────────────────────────────────────────
app.get("/auth/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Estado de los servicios internos del Admin Suite
app.get("/services/health", verifyToken, async (_req, res) => {
  // En dev: TRABUNDA_API_URL=http://localhost:3001
  // En Docker: TRABUNDA_API_URL=http://trabunda-api:3001
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

// ─── Dashboard de TRABUNDA ───────────────────────────────────────────────────
// Reúne toda la información relevante del backend real de Trabunda en una sola llamada.
// El frontend no necesita saber nada sobre el backend de Trabunda — solo llama aquí.
app.get("/trabunda/dashboard", verifyToken, async (_req, res) => {
  const base = process.env.TRABUNDA_BACKEND_URL;

  // Si no está configurado el backend, avisamos en lugar de fallar
  if (!base || !process.env.TRABUNDA_ADMIN_USER) {
    return res.status(503).json({
      configured: false,
      error: "Backend de Trabunda no configurado en .env",
    });
  }

  try {
    const call = (path, opts) => fetchService(getTrabundaToken, "trabunda", `${base}${path}`, opts);
    const hoy  = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Pedimos datos en paralelo para minimizar el tiempo de respuesta
    const [health, healthWorkers, areas, reportesHoy, usuarios] = await Promise.allSettled([
      fetch(`${base}/health`).then(r => r.json()),
      fetch(`${base}/health/workers`).then(r => r.json()),
      call("/areas"),
      call(`/reportes?fecha=${hoy}&limit=200`),
      call("/users/pickers?roles=PLANILLERO,ADMINISTRADOR,SANEAMIENTO"),
    ]);

    // Contamos reportes de hoy por tipo
    const todosReportes = reportesHoy.value?.reportes ?? reportesHoy.value?.data ?? [];
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
      reportesHoy: {
        total: todosReportes.length,
        porTipo: reportesPorTipo,
        items: todosReportes.slice(0, 10), // últimos 10 para preview
      },
      usuarios: usuarios.status === "fulfilled" ? usuarios.value : null,
    });
  } catch (err) {
    res.status(502).json({
      configured: true,
      error: "No se pudo conectar con el backend de Trabunda",
      detail: err.message,
    });
  }
});

// ─── Dashboard de RUTAS ───────────────────────────────────────────────────────
app.get("/rutas/dashboard", verifyToken, async (_req, res) => {
  const base = process.env.RUTAS_BACKEND_URL;

  if (!base || !process.env.RUTAS_ADMIN_USER) {
    return res.status(503).json({
      configured: false,
      error: "Backend de Rutas no configurado en .env",
    });
  }

  try {
    const call = (path, opts) => fetchService(getRutasToken, "rutas", `${base}${path}`, opts);

    const [health, empresas] = await Promise.allSettled([
      fetch(`${base}/health`).then(r => r.json()).catch(() => ({ status: "unknown" })),
      call("/empresas_transporte"),
    ]);

    // Para cada empresa activa, obtenemos sus transportistas
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
      health: health.status === "fulfilled" ? health.value : null,
      empresas: empresasConTransportistas.map(r => r.value ?? r.reason),
      totalEmpresas:       empresasData.length,
      totalEmpresasActivas: empresasData.filter(e => e.activo).length,
    });
  } catch (err) {
    res.status(502).json({
      configured: true,
      error: "No se pudo conectar con el backend de Rutas",
      detail: err.message,
    });
  }
});

// ─── Proxies internos del Admin Suite ────────────────────────────────────────
app.use("/api/trabunda", verifyToken,
  createProxyMiddleware({
    target: `http://localhost:${process.env.TRABUNDA_API_PORT || 3001}`,
    changeOrigin: true,
    pathRewrite: { "^/api/trabunda": "" },
  })
);

app.use("/api/rutas", verifyToken,
  createProxyMiddleware({
    target: `http://localhost:${process.env.RUTAS_API_PORT || 3002}`,
    changeOrigin: true,
    pathRewrite: { "^/api/rutas": "" },
  })
);

// ─── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡️  Gateway corriendo en http://localhost:${PORT}`);
  console.log(`   POST  /auth/login         → obtener token`);
  console.log(`   GET   /services/health    → estado servicios internos`);
  console.log(`   GET   /trabunda/dashboard → datos del backend Trabunda`);
  console.log(`   GET   /rutas/dashboard    → datos del backend Rutas\n`);
});
