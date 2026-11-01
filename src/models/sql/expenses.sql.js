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
         e.receipt_path AS "receiptPath",
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

// ----- Etapa 2 (GraphQL) -----

// Descripciones usadas antes que empiezan con el texto, ordenadas por frecuencia, con la cuenta
// y categoría más usadas y el monto promedio (para autocompletar al registrar un gasto)
async function suggestions(userId, prefix, limit) {
  const { rows } = await query(
    `WITH matches AS (
       SELECT description, account_id, category_id, amount
       FROM expenses
       WHERE user_id = $1 AND description ILIKE $2 ESCAPE '\\'
     )
     SELECT m.description,
            COUNT(*)::int AS "timesUsed",
            ROUND(AVG(m.amount), 2) AS "averageAmount",
            MODE() WITHIN GROUP (ORDER BY m.account_id) AS "accountId",
            MODE() WITHIN GROUP (ORDER BY m.category_id) AS "categoryId"
     FROM matches m
     GROUP BY m.description
     ORDER BY "timesUsed" DESC, m.description
     LIMIT $3`,
    [userId, `${escapeLike(prefix)}%`, limit]
  );
  return rows;
}

// Gastos de un rango para exportar (orden cronológico)
async function findForExport(userId, from, to) {
  const { rows } = await query(`${SELECT} WHERE e.user_id = $1 AND e.date BETWEEN $2 AND $3 ORDER BY e.date, e.id`, [userId, from, to]);
  return rows;
}

// Inserta varios gastos con el cliente de una transacción (todo o nada)
async function insertMany(client, userId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO expenses (user_id, account_id, category_id, amount, date, description) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, item.accountId, item.categoryId, item.amount, item.date, item.description]
    );
  }
}

// Cambia el comprobante y devuelve la ruta anterior (para borrar el archivo viejo)
async function setReceipt(userId, id, receiptPath) {
  const { rows } = await query(
    `UPDATE expenses e SET receipt_path = $3, updated_at = NOW()
     FROM (SELECT receipt_path FROM expenses WHERE id = $1 AND user_id = $2 FOR UPDATE) old
     WHERE e.id = $1 AND e.user_id = $2
     RETURNING old.receipt_path AS "previous"`,
    [id, userId, receiptPath]
  );
  return rows[0] || null;
}

const SPLIT_SELECT = `
  SELECT s.id, s.expense_id AS "expenseId", s.contact_id AS "contactId", ct.name AS "contactName",
         s.amount, s.net_worth_entry_id AS "netWorthEntryId", s.created_at AS "createdAt"
  FROM expense_splits s JOIN contacts ct ON ct.id = s.contact_id`;

async function findSplits(userId, expenseId) {
  const { rows } = await query(`${SPLIT_SELECT} WHERE s.user_id = $1 AND s.expense_id = $2 ORDER BY s.id`, [userId, expenseId]);
  return rows;
}

// Por cada parte crea un activo de patrimonio "te debe" ligado al contacto y la división que lo referencia
async function createSplits(client, userId, expense, parts) {
  const { rows: [{ next }] } = await client.query(
    'SELECT COALESCE(MAX(sort_order) + 1, 0)::int AS next FROM net_worth_entries WHERE user_id = $1',
    [userId]
  );
  const label = `${expense.description || 'Gasto compartido'} (${expense.date})`.slice(0, 80);
  for (const [i, part] of parts.entries()) {
    const { rows: [entry] } = await client.query(
      `INSERT INTO net_worth_entries (user_id, contact_id, label, kind, amount, sort_order)
       VALUES ($1, $2, $3, 'asset', $4, $5) RETURNING id`,
      [userId, part.contactId, label, part.amount, next + i]
    );
    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, contact_id, amount, net_worth_entry_id) VALUES ($1, $2, $3, $4, $5)`,
      [expense.id, userId, part.contactId, part.amount, entry.id]
    );
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  summaryByCategory,
  suggestions,
  findForExport,
  insertMany,
  setReceipt,
  findSplits,
  createSplits,
};
