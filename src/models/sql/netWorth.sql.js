// Patrimonio (activos y deudas): acceso a datos con SQL nativo
const { query } = require('../../config/database');
const { buildUpdate } = require('../../utils/sql');

const UPDATABLE = {
  label: 'label',
  kind: 'kind',
  amount: 'amount',
  dueDate: 'due_date',
  accountId: 'account_id',
  contactId: 'contact_id',
  sortOrder: 'sort_order',
};

const SELECT = `
  SELECT n.id, n.label, n.kind, n.amount, n.due_date AS "dueDate", n.sort_order AS "sortOrder",
         n.account_id AS "accountId", a.name AS "accountName",
         n.contact_id AS "contactId", ct.name AS "contactName",
         n.created_at AS "createdAt", n.updated_at AS "updatedAt"
  FROM net_worth_entries n
  LEFT JOIN accounts a  ON a.id  = n.account_id
  LEFT JOIN contacts ct ON ct.id = n.contact_id`;

async function findAll(userId, kind) {
  const params = [userId];
  let kindFilter = '';
  if (kind) {
    params.push(kind);
    kindFilter = 'AND n.kind = $2';
  }
  const { rows } = await query(`${SELECT} WHERE n.user_id = $1 ${kindFilter} ORDER BY n.kind, n.sort_order, n.id`, params);
  return rows;
}

async function findById(userId, id) {
  const { rows } = await query(`${SELECT} WHERE n.id = $1 AND n.user_id = $2`, [id, userId]);
  return rows[0] || null;
}

async function create(userId, data) {
  const { rows } = await query(
    `INSERT INTO net_worth_entries (user_id, label, kind, amount, due_date, account_id, contact_id, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             COALESCE($8, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM net_worth_entries WHERE user_id = $1)))
     RETURNING id`,
    [
      userId,
      data.label,
      data.kind,
      data.amount,
      data.dueDate ?? null,
      data.accountId ?? null,
      data.contactId ?? null,
      data.sortOrder ?? null,
    ]
  );
  return findById(userId, rows[0].id);
}

async function update(userId, id, data) {
  const { sets, values } = buildUpdate(data, UPDATABLE, 3);
  const { rowCount } = await query(
    `UPDATE net_worth_entries SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $1 AND user_id = $2`,
    [id, userId, ...values]
  );
  return rowCount ? findById(userId, id) : null;
}

async function remove(userId, id) {
  const { rowCount } = await query('DELETE FROM net_worth_entries WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

// Totales con agregación condicional (FILTER) y deudas próximas a vencer
async function summary(userId) {
  const [totals, upcoming, receivables] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'asset'), 0) AS assets,
              COALESCE(SUM(amount) FILTER (WHERE kind = 'debt'), 0)  AS debts,
              COUNT(*) FILTER (WHERE kind = 'debt' AND due_date < CURRENT_DATE)::int AS "overdueDebts"
       FROM net_worth_entries WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT id, label, amount, due_date AS "dueDate", (due_date - CURRENT_DATE) AS "daysLeft"
       FROM net_worth_entries
       WHERE user_id = $1 AND kind = 'debt' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
       ORDER BY due_date`,
      [userId]
    ),
    query(
      `SELECT ct.id AS "contactId", ct.name AS "contactName", SUM(n.amount) AS total, COUNT(*)::int AS entries
       FROM net_worth_entries n
       JOIN contacts ct ON ct.id = n.contact_id
       WHERE n.user_id = $1 AND n.kind = 'asset'
       GROUP BY ct.id, ct.name
       ORDER BY total DESC`,
      [userId]
    ),
  ]);

  const { assets, debts, overdueDebts } = totals.rows[0];
  return {
    assets,
    debts,
    netWorth: Number((assets - debts).toFixed(2)),
    overdueDebts,
    upcomingDebts: upcoming.rows,
    receivablesByContact: receivables.rows,
  };
}

module.exports = { findAll, findById, create, update, remove, summary };
