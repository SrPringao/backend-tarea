// Presupuestos mensuales: acceso a datos con SQL nativo
const { query } = require('../../config/database');

// Inserta o actualiza el presupuesto del mes. xmax = 0 indica que la fila es nueva.
async function upsert(userId, month, amount) {
  const { rows } = await query(
    `INSERT INTO monthly_budgets (user_id, month, amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, month)
     DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
     RETURNING id, month, amount, created_at AS "createdAt", updated_at AS "updatedAt", (xmax = 0) AS inserted`,
    [userId, month, amount]
  );
  const { inserted, ...budget } = rows[0];
  return { budget, inserted };
}

// Presupuestos con lo gastado en cada mes (LEFT JOIN LATERAL)
async function findAll(userId, year) {
  const params = [userId];
  let yearFilter = '';
  if (year) {
    params.push(`${year}-%`);
    yearFilter = 'AND b.month LIKE $2';
  }
  const { rows } = await query(
    `SELECT b.id, b.month, b.amount, s.spent,
            b.amount - s.spent AS remaining,
            ROUND(s.spent * 100.0 / b.amount, 2) AS "percentUsed"
     FROM monthly_budgets b
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(e.amount), 0) AS spent
       FROM expenses e
       WHERE e.user_id = b.user_id
         AND e.date >= TO_DATE(b.month, 'YYYY-MM')
         AND e.date <  TO_DATE(b.month, 'YYYY-MM') + INTERVAL '1 month'
     ) s ON TRUE
     WHERE b.user_id = $1 ${yearFilter}
     ORDER BY b.month DESC`,
    params
  );
  return rows;
}

// Estado del mes: presupuesto propio o, si no hay, el presupuesto por defecto de preferencias
async function status(userId, month) {
  const { rows } = await query(
    `WITH spent AS (
       SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
       FROM expenses
       WHERE user_id = $1
         AND date >= TO_DATE($2, 'YYYY-MM')
         AND date <  TO_DATE($2, 'YYYY-MM') + INTERVAL '1 month'
     )
     SELECT COALESCE(b.amount, p.default_budget) AS budget,
            CASE WHEN b.id IS NOT NULL THEN 'month'
                 WHEN p.default_budget IS NOT NULL THEN 'default'
                 ELSE 'none' END AS source,
            spent.total AS spent,
            spent.count AS "expenseCount"
     FROM spent
     LEFT JOIN monthly_budgets b ON b.user_id = $1 AND b.month = $2
     LEFT JOIN user_preferences p ON p.user_id = $1`,
    [userId, month]
  );
  return rows[0];
}

async function remove(userId, month) {
  const { rowCount } = await query('DELETE FROM monthly_budgets WHERE user_id = $1 AND month = $2', [userId, month]);
  return rowCount > 0;
}

module.exports = { upsert, findAll, status, remove };
