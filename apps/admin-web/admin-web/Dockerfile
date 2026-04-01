# ─────────────────────────────────────────────
#  Etapa 1: BUILD
#  Node compila el proyecto React con Vite.
#  Esta etapa solo existe durante el build —
#  no entra en la imagen final.
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Compilamos el proyecto. Vite genera los archivos
# estáticos en la carpeta /app/dist
RUN npm run build


# ─────────────────────────────────────────────
#  Etapa 2: PRODUCCIÓN
#  Nginx sirve los archivos estáticos.
#  Solo copiamos /app/dist de la etapa anterior.
# ─────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copiamos los archivos compilados al directorio
# que Nginx sirve por defecto
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiamos nuestra configuración de Nginx
# (la crearemos en infra/nginx/default.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
