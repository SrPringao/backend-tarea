// Reportes: consultas analíticas con SQL nativo (CTE, generate_series, agregados)
const { query } = require('../../config/database');

const monthRange = (column) =>
  `${column} >= TO_DATE($2, 'YYYY-MM') AND ${column} < TO_DATE($2, 'YYYY-MM') + INTERVAL '1 month'`;

async function dashboard(userId, month) {
  const params = [userId, month];
  const [spent, previous, byCategory, byAccount, recent, fixed] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count FROM expenses WHERE user_id = $1 AND ${monthRange('date')}`, params),
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE user_id = $1
         AND date >= TO_DATE($2, 'YYYY-MM') - INTERVAL '1 month'
         AND date <  TO_DATE($2, 'YYYY-MM')`,
      params
    ),
    query(
      `SELECT COALESCE(c.name, 'Sin categoría') AS name, c.color, SUM(e.amount) AS total
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = $1 AND ${monthRange('e.date')}
       GROUP BY c.name, c.color ORDER BY total DESC LIMIT 5`,
      params
    ),
    query(
      `SELECT a.id, a.name, a.type, SUM(e.amount) AS total
       FROM expenses e JOIN accounts a ON a.id = e.account_id
       WHERE e.user_id = $1 AND ${monthRange('e.date')}
       GROUP BY a.id, a.name, a.type ORDER BY total DESC`,
      params
    ),
    query(
      `SELECT e.id, e.amount, e.date, e.description, c.name AS "categoryName", a.name AS "accountName"
       FROM expenses e
       JOIN accounts a ON a.id = e.account_id
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = $1
       ORDER BY e.date DESC, e.id DESC LIMIT 5`,
      [userId]
    ),
    query(
      `SELECT COALESCE(SUM(f.amount), 0) AS total,
              COALESCE(SUM(f.amount) FILTER (WHERE p.id IS NULL), 0) AS pending,
              COUNT(*) FILTER (WHERE p.id IS NULL)::int AS "pendingCount"
       FROM fixed_expenses f
       LEFT JOIN fixed_expense_payments p ON p.fixed_expense_id = f.id AND p.month = $2
       WHERE f.user_id = $1`,
      params
    ),
  ]);

  return {
    spent: spent.rows[0],
    previousMonthSpent: previous.rows[0].total,
    topCategories: byCategory.rows,
    byAccount: byAccount.rows,
    recentExpenses: recent.rows,
    fixedExpenses: fixed.rows[0],
  };
}

// Serie de los últimos N meses (incluye meses sin gastos gracias a generate_series)
async function monthlyTrend(userId, months) {
  const { rows } = await query(
    `WITH series AS (
       SELECT TO_CHAR(d, 'YYYY-MM') AS month, d::date AS start, (d + INTERVAL '1 month')::date AS finish
       FROM GENERATE_SERIES(
         DATE_TRUNC('month', CURRENT_DATE) - ($2::int - 1) * INTERVAL '1 month',
         DATE_TRUNC('month', CURRENT_DATE),
         INTERVAL '1 month'
       ) d
     )
     SELECT s.month,
            COALESCE(SUM(e.amount), 0) AS spent,
            COUNT(e.id)::int AS count,
            b.amount AS budget
     FROM series s
     LEFT JOIN expenses e ON e.user_id = $1 AND e.date >= s.start AND e.date < s.finish
     LEFT JOIN monthly_budgets b ON b.user_id = $1 AND b.month = s.month
     GROUP BY s.month, b.amount
     ORDER BY s.month`,
    [userId, months]
  );
  return rows;
}

module.exports = { dashboard, monthlyTrend };
