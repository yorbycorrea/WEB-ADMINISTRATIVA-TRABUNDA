import express from "express";
import "dotenv/config";

const app = express();
const PORT = process.env.RUTAS_API_PORT || 3002;

app.use(express.json());

const stats = {
  totalRequests: 0,
  startTime: Date.now(),
};

app.use((req, res, next) => {
  stats.totalRequests++;
  next();
});

app.get("/health", (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - stats.startTime) / 1000);
  const uptimeDays    = Math.floor(uptimeSeconds / 86400);
  const uptimeHours   = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMins    = Math.floor((uptimeSeconds % 3600) / 60);

  res.json({
    service:  "rutas-api",
    status:   "online",
    port:     PORT,
    uptime:   `${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`,
    requests: stats.totalRequests,
    cpu:      `${(Math.random() * 20 + 5).toFixed(1)}%`,
    memory:   `${(Math.random() * 150 + 80).toFixed(0)} MB`,
  });
});

app.get("/rutas", (req, res) => {
  res.json({
    total: 15,
    activas: 12,
    data: [
      { id: 1, nombre: "Ruta Norte",   paradas: 8,  activa: true  },
      { id: 2, nombre: "Ruta Sur",     paradas: 12, activa: true  },
      { id: 3, nombre: "Ruta Central", paradas: 5,  activa: false },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`🗺️  Rutas API corriendo en http://localhost:${PORT}`);
});
