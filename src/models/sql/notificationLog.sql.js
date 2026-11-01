// Registro de notificaciones enviadas (SQL nativo). La llave única (user_id, kind, ref) evita duplicados.
const { query } = require('../../config/database');

// Devuelve true solo la primera vez que se registra la notificación
async function markSent(userId, kind, ref) {
  const { rowCount } = await query(
    `INSERT INTO notification_log (user_id, kind, ref) VALUES ($1, $2, $3) ON CONFLICT (user_id, kind, ref) DO NOTHING`,
    [userId, kind, ref]
  );
  return rowCount > 0;
}

// Usuarios activos a los que se les puede escribir (para las tareas programadas)
async function activeUsers() {
  const { rows } = await query(
    `SELECT id, email, display_name AS "displayName" FROM users WHERE is_active ORDER BY created_at`
  );
  return rows;
}

async function findUser(userId) {
  const { rows } = await query('SELECT id, email, display_name AS "displayName" FROM users WHERE id = $1', [userId]);
  return rows[0] || null;
}

module.exports = { markSent, activeUsers, findUser };
