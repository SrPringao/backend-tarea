const pg = require('pg');
const { Sequelize } = require('sequelize');
const config = require('./env');

// NUMERIC -> number, DATE -> 'YYYY-MM-DD' (sin conversion de zona horaria), BIGINT -> number
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const { host, port, user, password, name, logging } = config.db;

// Acceso mediante ORM (modulos: auth, usuarios, cuentas, categorias, contactos, preferencias)
const sequelize = new Sequelize(name, user, password, {
  host,
  port,
  dialect: 'postgres',
  logging: logging ? console.log : false,
  define: { underscored: true },
  pool: { max: 10, idle: 10000 },
});

// Acceso mediante SQL nativo (modulos: gastos, presupuestos, gastos fijos, patrimonio, reportes)
const pool = new pg.Pool({ host, port, user, password, database: name, max: 10 });

async function query(text, params = []) {
  if (logging) console.log('[SQL]', text.replace(/\s+/g, ' '), params);
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closeConnections() {
  await Promise.all([sequelize.close(), pool.end()]);
}

module.exports = { sequelize, pool, query, withTransaction, closeConnections };
