// ─────────────────────────────────────────────────────────────────────────────
//  planilleroSession.js
//  Cachea, por nombre de usuario de Trabunda, el token REAL que el planillero
//  obtuvo al loguearse con sus propias credenciales (no la cuenta de servicio
//  TRABUNDA_ADMIN_USER). En memoria: si el Gateway se reinicia, el planillero
//  simplemente tiene que volver a loguearse — igual que el tokenCache de
//  serviceAuth.js para la cuenta de servicio.
// ─────────────────────────────────────────────────────────────────────────────

const sesiones = new Map(); // key: username de Trabunda -> { token, trabundaUser, expiresAt }

export function guardarSesionPlanillero(username, token, trabundaUser, expiresInMs) {
  sesiones.set(username, {
    token,
    trabundaUser,
    expiresAt: Date.now() + Math.max(expiresInMs, 60 * 1000),
  });
}

export function obtenerTokenPlanillero(username) {
  const sesion = sesiones.get(username);
  if (!sesion) return null;
  if (sesion.expiresAt <= Date.now()) {
    sesiones.delete(username);
    return null;
  }
  return sesion.token;
}

export function invalidarSesionPlanillero(username) {
  sesiones.delete(username);
}
