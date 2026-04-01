// ─────────────────────────────────────────────────────────────────────────────
//  db/index.js
//  Conexión a PostgreSQL usando un Pool de conexiones.
//
//  Un Pool mantiene varias conexiones abiertas y las reutiliza.
//  Así evitamos abrir y cerrar una conexión por cada query (muy costoso).
// ─────────────────────────────────────────────────────────────────────────────

import pg from "pg";

const { Pool } = pg;

// El Pool lee DATABASE_URL del entorno.
// Formato: postgresql://usuario:password@host:puerto/base_de_datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Notificamos si hay un error de conexión inesperado en una conexión idle
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", err.message);
});

/**
 * Ejecuta una query SQL.
 * @param {string} text    - La query con placeholders: SELECT * FROM users WHERE id = $1
 * @param {Array}  params  - Los valores para los placeholders: [userId]
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    // Siempre liberamos el cliente de vuelta al pool, incluso si hay error
    client.release();
  }
}

/**
 * Inicializa la base de datos creando las tablas si no existen.
 * Se llama una vez al arrancar el gateway.
 * "IF NOT EXISTS" hace que sea seguro correrlo en cada inicio.
 */
export async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id           VARCHAR(20)  PRIMARY KEY,
      username     VARCHAR(100) UNIQUE NOT NULL,
      password     VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      permissions  TEXT[]       DEFAULT '{}',
      created_at   TIMESTAMPTZ  DEFAULT NOW()
    )
  `);

  console.log("✅ Base de datos lista (tabla users verificada)");
}
