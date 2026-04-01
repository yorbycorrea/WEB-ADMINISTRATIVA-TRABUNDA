# ─────────────────────────────────────────────
#  Dockerfile — Gateway
# ─────────────────────────────────────────────
#  Usamos la imagen oficial de Node en su
#  variante "alpine" (mucho más liviana: ~50MB
#  vs ~300MB de la imagen estándar)
# ─────────────────────────────────────────────

FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero solo los archivos de dependencias.
# Docker cachea cada instrucción como una "capa".
# Si solo cambias código fuente (no package.json),
# Docker reutiliza la capa de npm install → builds más rápidos.
COPY package.json package-lock.json ./

# Instalamos solo dependencias de producción (sin devDependencies)
RUN npm ci --omit=dev

# Ahora copiamos el código fuente
COPY src/ ./src/

# Puerto que expone este contenedor (documentativo, no lo publica hacia afuera)
EXPOSE 3000

# Comando de arranque
CMD ["node", "src/server.js"]
