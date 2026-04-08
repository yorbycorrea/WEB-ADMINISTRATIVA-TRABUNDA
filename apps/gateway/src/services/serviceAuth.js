// ─────────────────────────────────────────────────────────────────────────────
//  serviceAuth.js
//  Gestiona los tokens JWT para autenticarse contra los backends reales
//  (Trabunda y Rutas). Cachea el token para no hacer login en cada request.
// ─────────────────────────────────────────────────────────────────────────────

// Map en memoria: { nombre -> { token, expiresAt } }
const tokenCache = new Map();

/**
 * Obtiene un token para un servicio. Si el cache es válido lo reutiliza,
 * si no, hace login y guarda el nuevo token.
 */
async function getServiceToken(name, loginUrl, username, password, usernameField = "username") {
  const cached = tokenCache.get(name);

  // Verificamos que el token no venza en los próximos 5 minutos
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  // Si no hay cache o está por vencer, hacemos login
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [usernameField]: username, password }),
  });

  if (!res.ok) {
    throw new Error(`Login fallido en ${name}: HTTP ${res.status}`);
  }

  const data = await res.json();

  if (!data.token) {
    throw new Error(`${name} no devolvió token. Respuesta: ${JSON.stringify(data)}`);
  }

  // Guardamos el token con expiración de 7 horas (conservador vs las 12h del backend)
  tokenCache.set(name, {
    token: data.token,
    expiresAt: Date.now() + 7 * 60 * 60 * 1000,
  });

  console.log(`[serviceAuth] Token renovado para "${name}"`);
  return data.token;
}

// ─── Exportamos funciones específicas por servicio ───────────────────────────

export async function getTrabundaToken() {
  return getServiceToken(
    "trabunda",
    `${process.env.TRABUNDA_BACKEND_URL}/auth/login`,
    process.env.TRABUNDA_ADMIN_USER,
    process.env.TRABUNDA_ADMIN_PASS
  );
}

export async function getRutasToken() {
  return getServiceToken(
    "rutas",
    `${process.env.RUTAS_BACKEND_URL}/auth/login`,
    process.env.RUTAS_ADMIN_USER,
    process.env.RUTAS_ADMIN_PASS
  );
}

export async function getCalidadToken() {
  return getServiceToken(
    "calidad",
    `${process.env.CALIDAD_BACKEND_URL}/auth/login`,
    process.env.CALIDAD_ADMIN_USER,
    process.env.CALIDAD_ADMIN_PASS,
    "usuario"
  );
}

/**
 * Invalida el cache de un servicio (útil si el token fue rechazado con 401)
 */
export function invalidateToken(name) {
  tokenCache.delete(name);
  console.log(`[serviceAuth] Cache invalidado para "${name}"`);
}
