import express from "express";
import "dotenv/config";

const app = express();
const PORT = process.env.TRABUNDA_API_PORT || 3001;

app.use(express.json());

// Simulamos una base de datos en memoria para que el dashboard tenga algo real
// En producción esto vendría de PostgreSQL, MongoDB, etc.
const stats = {
  totalRequests: 0,
  startTime: Date.now(),
};

// Middleware que cuenta cada request que llega
app.use((req, res, next) => {
  stats.totalRequests++;
  next();
});

// Health check — lo consulta el Gateway para saber si estamos vivos
app.get("/health", (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - stats.startTime) / 1000);
  const uptimeDays    = Math.floor(uptimeSeconds / 86400);
  const uptimeHours   = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMins    = Math.floor((uptimeSeconds % 3600) / 60);

  res.json({
    service:  "trabunda-api",
    status:   "online",
    port:     PORT,
    uptime:   `${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`,
    requests: stats.totalRequests,
    cpu:      `${(Math.random() * 30 + 10).toFixed(1)}%`, // simulado
    memory:   `${(Math.random() * 200 + 100).toFixed(0)} MB`,
  });
});

// Endpoints de ejemplo del negocio
app.get("/trabajadores", (req, res) => {
  res.json({
    total: 42,
    activos: 38,
    data: [
      { id: 1, nombre: "Carlos López",    turno: "mañana",  activo: true },
      { id: 2, nombre: "María Rodríguez", turno: "tarde",   activo: true },
      { id: 3, nombre: "Pedro García",    turno: "noche",   activo: false },
    ],
  });
});

app.get("/trabajadores/:id", (req, res) => {
  res.json({ id: req.params.id, nombre: "Carlos López", turno: "mañana", activo: true });
});

app.listen(PORT, () => {
  console.log(`⚙️  Trabunda API corriendo en http://localhost:${PORT}`);
});
