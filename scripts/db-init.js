// Crea el esquema (database/schema.sql) y carga datos de demostración.
// Uso: npm run db:init   (o NODE_ENV=test para la base de pruebas)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const { pool } = require('../src/config/database');

const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');

function monthOffset(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateIn(month, day) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

async function seed(client) {
  const [adminHash, demoHash] = await Promise.all([bcrypt.hash('Admin1234', config.bcryptRounds), bcrypt.hash('Demo1234', config.bcryptRounds)]);

  await client.query(
    `INSERT INTO users (email, display_name, password_hash, role) VALUES ('admin@gastos.app', 'Administrador', $1, 'admin')`,
    [adminHash]
  );
  const { rows: [demo] } = await client.query(
    `INSERT INTO users (email, display_name, password_hash) VALUES ('demo@gastos.app', 'Usuario Demo', $1) RETURNING id`,
    [demoHash]
  );
  const uid = demo.id;

  await client.query(`INSERT INTO user_preferences (user_id) SELECT id FROM users`);
  await client.query(`UPDATE user_preferences SET default_budget = 12000 WHERE user_id = $1`, [uid]);

  const { rows: accounts } = await client.query(
    `INSERT INTO accounts (user_id, name, type, color, payment_day, credit_limit) VALUES
       ($1, 'BBVA Azul', 'credit', '#1A4D8F', 5, 25000),
       ($1, 'Nu Débito', 'debit', '#820AD1', NULL, NULL),
       ($1, 'Efectivo', 'cash', '#2E7D32', NULL, NULL)
     RETURNING id`,
    [uid]
  );
  const { rows: categories } = await client.query(
    `INSERT INTO categories (user_id, name, color) VALUES
       ($1, 'Comida', '#E4572E'), ($1, 'Transporte', '#29335C'), ($1, 'Entretenimiento', '#F3A712'),
       ($1, 'Salud', '#669BBC'), ($1, 'Servicios', '#A8C686')
     RETURNING id`,
    [uid]
  );
  const [credit, debit, cash] = accounts.map((a) => a.id);
  const [food, transport, fun, health, services] = categories.map((c) => c.id);

  // Gastos de los últimos 3 meses
  const templates = [
    [credit, food, 349.5, 2, 'Supermercado'],
    [cash, transport, 45, 3, 'Metro y camión'],
    [debit, food, 189, 6, 'Comida con amigos'],
    [credit, fun, 299, 9, 'Cine'],
    [debit, health, 520, 12, 'Farmacia'],
    [credit, food, 812.3, 15, 'Despensa quincenal'],
    [cash, transport, 120, 18, 'Uber'],
    [credit, services, 649, 20, 'Internet'],
    [debit, fun, 179, 24, 'Suscripción streaming'],
  ];
  const values = [];
  const params = [uid];
  for (const offset of [-2, -1, 0]) {
    const month = monthOffset(offset);
    for (const [acc, cat, amount, day, description] of templates) {
      if (offset === 0 && day > new Date().getDate()) continue;
      const base = params.length;
      params.push(acc, cat, Number((amount * (1 + offset * 0.05)).toFixed(2)), dateIn(month, day), description);
      values.push(`($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    }
  }
  await client.query(
    `INSERT INTO expenses (user_id, account_id, category_id, amount, date, description) VALUES ${values.join(', ')}`,
    params
  );

  await client.query(
    `INSERT INTO monthly_budgets (user_id, month, amount) VALUES ($1, $2, 10000), ($1, $3, 11000), ($1, $4, 12000)`,
    [uid, monthOffset(-2), monthOffset(-1), monthOffset(0)]
  );

  const { rows: fixed } = await client.query(
    `INSERT INTO fixed_expenses (user_id, name, amount, day_of_month, category_id) VALUES
       ($1, 'Renta', 8500, 1, $2), ($1, 'Gimnasio', 650, 10, $3), ($1, 'Telefonía', 399, 15, $2)
     RETURNING id`,
    [uid, services, health]
  );
  await client.query(
    `INSERT INTO fixed_expense_payments (fixed_expense_id, user_id, month, amount)
     SELECT f.id, f.user_id, $2, f.amount FROM fixed_expenses f WHERE f.id = ANY($1::int[])`,
    [fixed.map((f) => f.id), monthOffset(-1)]
  );
  await client.query(
    `INSERT INTO fixed_expense_payments (fixed_expense_id, user_id, month, amount) VALUES ($1, $2, $3, 8500)`,
    [fixed[0].id, uid, monthOffset(0)]
  );

  const { rows: contacts } = await client.query(
    `INSERT INTO contacts (user_id, name, name_key) VALUES ($1, 'José Pérez', 'jose perez'), ($1, 'Camila Ruiz', 'camila ruiz') RETURNING id`,
    [uid]
  );
  await client.query(
    `INSERT INTO net_worth_entries (user_id, label, kind, amount, account_id, contact_id, due_date, sort_order) VALUES
       ($1, 'Saldo Nu', 'asset', 18500, $2, NULL, NULL, 0),
       ($1, 'Préstamo a José', 'asset', 1500, NULL, $3, NULL, 1),
       ($1, 'Concierto Camila', 'asset', 900, NULL, $4, NULL, 2),
       ($1, 'Saldo tarjeta BBVA', 'debt', 6240.5, $5, NULL, CURRENT_DATE + 10, 3),
       ($1, 'Préstamo auto', 'debt', 85000, NULL, NULL, CURRENT_DATE + 45, 4)`,
    [uid, debit, contacts[0].id, contacts[1].id, credit]
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    if (process.argv.includes('--no-seed')) {
      console.log(`Esquema creado en "${config.db.name}" (sin datos de demostración)`);
    } else {
      await seed(client);
      console.log(`Esquema y datos de demostración cargados en "${config.db.name}"`);
      console.log('  admin@gastos.app / Admin1234  (rol admin)');
      console.log('  demo@gastos.app  / Demo1234   (usuario con datos)');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al inicializar la base de datos:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
