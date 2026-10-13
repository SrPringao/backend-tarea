// Gastos fijos y sus pagos mensuales: acceso a datos con SQL nativo
const { query } = require('../../config/database');
const { buildUpdate } = require('../../utils/sql');

const UPDATABLE = {
  name: 'name',
  amount: 'amount',
  dayOfMonth: 'day_of_month',
  categoryId: 'category_id',
};

const COLUMNS = `
  f.id, f.name, f.amount, f.day_of_month AS "dayOfMonth",
  f.category_id AS "categoryId", c.name AS "categoryName",
  f.created_at AS "createdAt", f.updated_at AS "updatedAt"`;

// Lista con el estado de pago del mes indicado
async function findAll(userId, month) {
  const { rows } = await query(
    `SELECT ${COLUMNS},
            (p.id IS NOT NULL) AS paid,
            p.amount  AS "paidAmount",
            p.paid_at AS "paidAt"
     FROM fixed_expenses f
     LEFT JOIN categories c ON c.id = f.category_id
     LEFT JOIN fixed_expense_payments p ON p.fixed_expense_id = f.id AND p.month = $2
     WHERE f.user_id = $1
     ORDER BY f.day_of_month NULLS LAST, f.name`,
    [userId, month]
  );
  return rows;
}

async function findById(userId, id) {
  const { rows } = await query(
    `SELECT ${COLUMNS}
     FROM fixed_expenses f
     LEFT JOIN categories c ON c.id = f.category_id
     WHERE f.id = $1 AND f.user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function paymentHistory(fixedExpenseId, limit = 12) {
  const { rows } = await query(
    `SELECT id, month, amount, paid_at AS "paidAt"
     FROM fixed_expense_payments
     WHERE fixed_expense_id = $1
     ORDER BY month DESC
     LIMIT $2`,
    [fixedExpenseId, limit]
  );
  return rows;
}

async function create(userId, data) {
  const { rows } = await query(
    `INSERT INTO fixed_expenses (user_id, name, amount, day_of_month, category_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, data.name, data.amount, data.dayOfMonth ?? null, data.categoryId ?? null]
  );
  return findById(userId, rows[0].id);
}

async function update(userId, id, data) {
  const { sets, values } = buildUpdate(data, UPDATABLE, 3);
  const { rowCount } = await query(
    `UPDATE fixed_expenses SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $1 AND user_id = $2`,
    [id, userId, ...values]
  );
  return rowCount ? findById(userId, id) : null;
}

async function remove(userId, id) {
  const { rowCount } = await query('DELETE FROM fixed_expenses WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

// Registra el pago del mes; si ya existía no inserta nada (null). Monto por defecto: el del gasto fijo.
async function markPaid(userId, id, month, amount) {
  const { rows } = await query(
    `INSERT INTO fixed_expense_payments (fixed_expense_id, user_id, month, amount)
     SELECT f.id, f.user_id, $3, COALESCE($4, f.amount)
     FROM fixed_expenses f
     WHERE f.id = $1 AND f.user_id = $2
     ON CONFLICT (fixed_expense_id, month) DO NOTHING
     RETURNING id, fixed_expense_id AS "fixedExpenseId", month, amount, paid_at AS "paidAt"`,
    [id, userId, month, amount ?? null]
  );
  return rows[0] || null;
}

async function unmarkPaid(userId, id, month) {
  const { rowCount } = await query(
    'DELETE FROM fixed_expense_payments WHERE fixed_expense_id = $1 AND user_id = $2 AND month = $3',
    [id, userId, month]
  );
  return rowCount > 0;
}

module.exports = { findAll, findById, paymentHistory, create, update, remove, markPaid, unmarkPaid };
