# Admin Suite (Multi-App) — Esqueleto

Este repositorio es un monorepo para una **web administrativa** que controla múltiples apps (TRABUNDA, rutas trabunda, futuras apps) en un mismo servidor.

Incluye:

- **gateway** (Express): login + JWT + valida acceso por app + proxy a cada API
- **trabunda-api** (Express): servicio demo (luego se conecta a tu backend real)
- **app2-api** (Express): servicio demo
- **admin-web**: placeholder (luego será React + Tailwind)
- **nginx**: sirve la web y enruta `/admin-api` al gateway

---

## 1) Requisitos

- Node.js 20+
- Docker + Docker Compose
- VS Code
  P

---

## 2) Paso a paso (orden recomendado)

### PASO 1 — Crear el archivo .env

1. Copia `.env.example` y renómbralo a `.env`
2. Edita `JWT_SECRET` y pon un secreto real.

### PASO 2 — Instalar dependencias (modo local)

En la raíz:

```bash
npm install
```
