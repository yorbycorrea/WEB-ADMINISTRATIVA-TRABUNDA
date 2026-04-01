// ─────────────────────────────────────────────────────────────────────────────
//  userStore.js
//  Gestiona los usuarios del Admin Suite.
//  Los guarda en un archivo JSON local (no necesita base de datos propia).
//  Las contraseñas NUNCA se guardan en texto plano — siempre como hash bcrypt.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";

// Resolvemos la ruta absoluta al archivo users.json
// __dirname no existe en ES Modules, por eso usamos este patrón
const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const USERS_FILE = join(__dir, "../data/users.json");

// ─── Lectura y escritura del archivo ─────────────────────────────────────────

function readUsers() {
  try {
    return JSON.parse(readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

// ─── Operaciones públicas ─────────────────────────────────────────────────────

/**
 * Devuelve todos los usuarios sin el campo password.
 * Nunca exponemos el hash al frontend.
 */
export function getAllUsers() {
  return readUsers().map(({ password: _p, ...rest }) => rest);
}

/**
 * Busca un usuario por username y verifica su contraseña.
 * Devuelve el usuario (sin password) si es correcto, null si no.
 */
export async function verifyUser(username, password) {
  const users = readUsers();
  const user  = users.find(u => u.username === username);
  if (!user) return null;

  // bcrypt.compare compara el texto plano con el hash guardado
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;

  const { password: _p, ...safeUser } = user;
  return safeUser;
}

/**
 * Crea un nuevo usuario.
 * Valida que el username no exista y hashea la contraseña.
 *
 * permissions: array de strings — qué páginas puede ver.
 * Valores posibles: "overview", "trabunda", "rutas"
 */
export async function createUser({ username, password, displayName, permissions }) {
  const users = readUsers();

  if (users.find(u => u.username === username)) {
    throw new Error(`El usuario "${username}" ya existe`);
  }

  // bcrypt.hash convierte la contraseña en un hash seguro.
  // El "10" es el número de rondas de hashing (más alto = más seguro pero más lento)
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id:          Date.now().toString(), // ID simple basado en timestamp
    username,
    password:    hashedPassword,
    displayName: displayName || username,
    permissions: permissions || [],    // ej: ["trabunda", "rutas"]
    createdAt:   new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  const { password: _p, ...safeUser } = newUser;
  return safeUser;
}

/**
 * Edita un usuario existente.
 * Si se pasa una nueva contraseña, la hashea. Si no, mantiene la anterior.
 */
export async function updateUser(id, { displayName, password, permissions }) {
  const users = readUsers();
  const idx   = users.findIndex(u => u.id === id);

  if (idx === -1) throw new Error("Usuario no encontrado");

  if (displayName !== undefined) users[idx].displayName = displayName;
  if (permissions !== undefined) users[idx].permissions = permissions;
  if (password)                  users[idx].password    = await bcrypt.hash(password, 10);

  writeUsers(users);

  const { password: _p, ...safeUser } = users[idx];
  return safeUser;
}

/**
 * Elimina un usuario por ID.
 */
export function deleteUser(id) {
  const users    = readUsers();
  const filtered = users.filter(u => u.id !== id);

  if (filtered.length === users.length) throw new Error("Usuario no encontrado");

  writeUsers(filtered);
}
