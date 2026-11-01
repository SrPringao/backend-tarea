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

// ----- Etapa 2 (GraphQL) -----

// Gasto por día del mes con acumulado (incluye días sin gastos; función ventana para el acumulado)
async function dailySpending(userId, month) {
  const { rows } = await query(
    `WITH days AS (
       SELECT d::date AS day
       FROM GENERATE_SERIES(TO_DATE($2, 'YYYY-MM'), TO_DATE($2, 'YYYY-MM') + INTERVAL '1 month' - INTERVAL '1 day', INTERVAL '1 day') d
     ), totals AS (
       SELECT d.day, COALESCE(SUM(e.amount), 0) AS total, COUNT(e.id)::int AS count
       FROM days d
       LEFT JOIN expenses e ON e.user_id = $1 AND e.date = d.day
       GROUP BY d.day
     )
     SELECT TO_CHAR(day, 'YYYY-MM-DD') AS date, total, count,
            SUM(total) OVER (ORDER BY day) AS cumulative
     FROM totals ORDER BY day`,
    [userId, month]
  );
  return rows;
}

// Gasto por categoría en dos meses con agregación condicional (FILTER): una sola pasada sobre los gastos
// e incluye las categorías que solo aparecen en uno de los dos meses
async function categoryComparison(userId, monthA, monthB) {
  const { rows } = await query(
    `WITH per_category AS (
       SELECT e.category_id,
              COALESCE(SUM(e.amount) FILTER (WHERE TO_CHAR(e.date, 'YYYY-MM') = $2), 0) AS total_a,
              COALESCE(SUM(e.amount) FILTER (WHERE TO_CHAR(e.date, 'YYYY-MM') = $3), 0) AS total_b
       FROM expenses e
       WHERE e.user_id = $1
         AND e.date >= LEAST(TO_DATE($2, 'YYYY-MM'), TO_DATE($3, 'YYYY-MM'))
         AND e.date <  GREATEST(TO_DATE($2, 'YYYY-MM'), TO_DATE($3, 'YYYY-MM')) + INTERVAL '1 month'
       GROUP BY e.category_id
     )
     SELECT p.category_id AS "categoryId",
            COALESCE(c.name, 'Sin categoría') AS "categoryName",
            c.color AS "categoryColor",
            p.total_a AS "totalA",
            p.total_b AS "totalB",
            p.total_b - p.total_a AS difference,
            CASE WHEN p.total_a = 0 THEN NULL ELSE ROUND((p.total_b - p.total_a) * 100.0 / p.total_a, 2) END AS "percentChange"
     FROM per_category p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.total_a > 0 OR p.total_b > 0
     ORDER BY GREATEST(p.total_a, p.total_b) DESC`,
    [userId, monthA, monthB]
  );
  return rows;
}

module.exports = { dashboard, monthlyTrend, dailySpending, categoryComparison };
