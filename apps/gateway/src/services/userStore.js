// ─────────────────────────────────────────────────────────────────────────────
//  userStore.js
//  Todas las operaciones de usuarios contra PostgreSQL.
//  Reemplaza la versión anterior que usaba un archivo JSON.
//
//  Diferencias clave con el JSON:
//  - Las operaciones son async (PostgreSQL es I/O de red, no de disco local)
//  - Las contraseñas siguen hasheadas con bcrypt — eso no cambia
//  - La columna "display_name" en SQL = "displayName" en JS (snake_case → camelCase)
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";
import { query } from "../db/index.js";

// Convierte una fila de PostgreSQL (snake_case) al formato que espera el frontend
function toUser(row) {
  return {
    id:          row.id,
    username:    row.username,
    displayName: row.display_name,
    permissions: row.permissions ?? [],
    createdAt:   row.created_at,
  };
}

// ─── Operaciones públicas ─────────────────────────────────────────────────────

/**
 * Devuelve todos los usuarios sin el campo password.
 */
export async function getAllUsers() {
  const { rows } = await query(
    "SELECT id, username, display_name, permissions, created_at FROM users ORDER BY created_at ASC"
  );
  return rows.map(toUser);
}

/**
 * Verifica credenciales. Devuelve el usuario (sin password) o null.
 */
export async function verifyUser(username, password) {
  const { rows } = await query(
    "SELECT * FROM users WHERE username = $1",
    [username]
  );
  if (!rows.length) return null;

  const ok = await bcrypt.compare(password, rows[0].password);
  if (!ok) return null;

  return toUser(rows[0]);
}

/**
 * Crea un nuevo usuario con contraseña hasheada.
 */
export async function createUser({ username, password, displayName, permissions }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = Date.now().toString();

  try {
    const { rows } = await query(
      `INSERT INTO users (id, username, password, display_name, permissions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, display_name, permissions, created_at`,
      [id, username, hashedPassword, displayName || username, permissions ?? []]
    );
    return toUser(rows[0]);
  } catch (err) {
    // Código 23505 = violación de UNIQUE constraint (username ya existe)
    if (err.code === "23505") throw new Error(`El usuario "${username}" ya existe`);
    throw err;
  }
}

/**
 * Actualiza displayName, permissions y/o contraseña de un usuario.
 * Solo actualiza los campos que se pasan — los demás quedan igual.
 */
export async function updateUser(id, { displayName, password, permissions }) {
  // Construimos la query dinámicamente según qué campos se envían
  const sets   = [];
  const values = [];
  let   idx    = 1;

  if (displayName !== undefined) { sets.push(`display_name = $${idx++}`); values.push(displayName); }
  if (permissions !== undefined) { sets.push(`permissions  = $${idx++}`); values.push(permissions); }
  if (password)                  { sets.push(`password     = $${idx++}`); values.push(await bcrypt.hash(password, 10)); }

  if (!sets.length) throw new Error("Nada que actualizar");

  values.push(id); // el último parámetro es siempre el id para el WHERE

  const { rows } = await query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}
     RETURNING id, username, display_name, permissions, created_at`,
    values
  );

  if (!rows.length) throw new Error("Usuario no encontrado");
  return toUser(rows[0]);
}

/**
 * Elimina un usuario por ID.
 */
export async function deleteUser(id) {
  const { rowCount } = await query("DELETE FROM users WHERE id = $1", [id]);
  if (!rowCount) throw new Error("Usuario no encontrado");
}
