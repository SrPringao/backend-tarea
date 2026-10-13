// Gastos: acceso a datos con SQL nativo (consultas parametrizadas con pg)
const { query } = require('../../config/database');
const { buildUpdate, escapeLike } = require('../../utils/sql');

const SORT_COLUMNS = { date: 'e.date', amount: 'e.amount', createdAt: 'e.created_at' };

const UPDATABLE = {
  amount: 'amount',
  date: 'date',
  description: 'description',
  accountId: 'account_id',
  categoryId: 'category_id',
};

const SELECT = `
  SELECT e.id, e.amount, e.date, e.description,
         e.account_id  AS "accountId",  a.name  AS "accountName", a.type AS "accountType",
         e.category_id AS "categoryId", c.name  AS "categoryName", c.color AS "categoryColor",
         e.created_at  AS "createdAt",  e.updated_at AS "updatedAt"
  FROM expenses e
  JOIN accounts a ON a.id = e.account_id
  LEFT JOIN categories c ON c.id = e.category_id`;

function buildFilters(userId, filters) {
  const params = [userId];
  const where = ['e.user_id = $1'];
  const add = (condition, value) => {
    params.push(value);
    where.push(condition.replace('?', `$${params.length}`));
  };

  if (filters.from) add('e.date >= ?', filters.from);
  if (filters.to) add('e.date <= ?', filters.to);
  if (filters.accountId) add('e.account_id = ?', filters.accountId);
  if (filters.categoryId) add('e.category_id = ?', filters.categoryId);
  if (filters.minAmount !== undefined) add('e.amount >= ?', filters.minAmount);
  if (filters.maxAmount !== undefined) add('e.amount <= ?', filters.maxAmount);
  if (filters.search) add("e.description ILIKE ? ESCAPE '\\'", `%${escapeLike(filters.search)}%`);

  return { where: where.join(' AND '), params };
}

async function findAll(userId, filters, { limit, offset, sort, order }) {
  const { where, params } = buildFilters(userId, filters);
  // La columna y dirección salen de una whitelist, nunca del texto del usuario
  const orderBy = `${SORT_COLUMNS[sort]} ${order === 'asc' ? 'ASC' : 'DESC'}, e.id DESC`;
  const pageParams = [...params, limit, offset];

  const [rows, totals] = await Promise.all([
    query(
      `${SELECT} WHERE ${where} ORDER BY ${orderBy} LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams
    ),
    query(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(e.amount), 0) AS "totalAmount" FROM expenses e WHERE ${where}`,
      params
    ),
  ]);

  return { rows: rows.rows, total: totals.rows[0].total, totalAmount: totals.rows[0].totalAmount };
}

async function findById(userId, id) {
  const { rows } = await query(`${SELECT} WHERE e.id = $1 AND e.user_id = $2`, [id, userId]);
  return rows[0] || null;
}

async function create(userId, data) {
  const { rows } = await query(
    `INSERT INTO expenses (user_id, account_id, category_id, amount, date, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, data.accountId, data.categoryId ?? null, data.amount, data.date, data.description ?? null]
  );
  return findById(userId, rows[0].id);
}

async function update(userId, id, data) {
  const { sets, values } = buildUpdate(data, UPDATABLE, 3);
  const { rowCount } = await query(
    `UPDATE expenses SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $1 AND user_id = $2`,
    [id, userId, ...values]
  );
  return rowCount ? findById(userId, id) : null;
}

async function remove(userId, id) {
  const { rowCount } = await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

// Total por categoría en un rango, con porcentaje sobre el total (función ventana)
async function summaryByCategory(userId, from, to) {
  const { rows } = await query(
    `SELECT c.id AS "categoryId",
            COALESCE(c.name, 'Sin categoría') AS "categoryName",
            c.color AS "categoryColor",
            COUNT(*)::int AS count,
            SUM(e.amount) AS total,
            ROUND(SUM(e.amount) * 100.0 / SUM(SUM(e.amount)) OVER (), 2) AS percentage
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = $1 AND e.date BETWEEN $2 AND $3
     GROUP BY c.id, c.name, c.color
     ORDER BY total DESC`,
    [userId, from, to]
  );
  return rows;
}

module.exports = { findAll, findById, create, update, remove, summaryByCategory };
