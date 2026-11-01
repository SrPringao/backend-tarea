// Instalación en una computadora nueva (p. ej. la del profesor, que solo tiene el servidor PostgreSQL):
//   1. Crea .env a partir de .env.example si no existe, con un JWT_SECRET aleatorio.
//   2. Crea la base de datos (y la de pruebas) si no existen, conectándose a la base de mantenimiento "postgres".
//      Con DATABASE_URL (Supabase) este paso se omite: la base ya existe.
//   3. Crea las tablas y carga los datos de demostración (scripts/db-init.js).
//   4. Si Supabase Storage está configurado, crea el bucket privado para los archivos.
// Uso: npm run setup            (se detiene si la base ya tiene tablas, para no borrar datos)
//      npm run setup -- --reset (borra y vuelve a crear las tablas)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const reset = process.argv.includes('--reset');

function createEnvFile() {
  if (fs.existsSync(envPath)) return false;
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(envPath, example.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  return true;
}

const SAFE_NAME = /^[A-Za-z0-9_]+$/;

// Crea la base si no existe. CREATE DATABASE no admite parámetros, por eso el nombre se valida con una whitelist.
async function ensureDatabase(pg, db, name) {
  if (!name) return null;
  if (!SAFE_NAME.test(name)) throw new Error(`Nombre de base inválido: "${name}" (solo letras, números y _)`);

  const client = new pg.Client({ host: db.host, port: db.port, user: db.user, password: db.password, database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount) return 'existía';
    await client.query(`CREATE DATABASE "${name}"`);
    return 'creada';
  } finally {
    await client.end();
  }
}

async function hasTables() {
  const { query, closeConnections } = require('../src/config/database');
  try {
    const { rows } = await query("SELECT to_regclass('public.users') IS NOT NULL AS exists");
    return rows[0].exists;
  } finally {
    await closeConnections();
  }
}

async function ensureBucket(config) {
  const { StorageClient } = require('@supabase/storage-js');
  const key = config.storage.supabaseKey;
  const client = new StorageClient(`${config.storage.supabaseUrl}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` });
  const { data, error } = await client.getBucket(config.storage.bucket);
  if (data) return data.public ? 'existe pero es PÚBLICO: cámbialo a privado en Supabase' : 'existía (privado)';
  if (error && !/not found/i.test(error.message)) throw new Error(error.message);

  const created = await client.createBucket(config.storage.bucket, {
    public: false,
    fileSizeLimit: config.storage.maxBytes,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  });
  if (created.error) throw new Error(created.error.message);
  return 'creado (privado, máximo 2 MB, JPEG/PNG/PDF)';
}

async function main() {
  if (createEnvFile()) {
    console.log('✔ Se creó .env a partir de .env.example con un JWT_SECRET aleatorio.');
    console.log('  Revisa en .env los datos de tu PostgreSQL (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT) y vuelve a ejecutar: npm run setup');
    return;
  }

  let config;
  try {
    config = require('../src/config/env');
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const pg = require('pg');
  if (config.db.url) {
    console.log('• Base de datos: DATABASE_URL (servicio en la nube); no se crea la base, ya existe.');
  } else {
    try {
      console.log(`• Base "${config.db.name}": ${await ensureDatabase(pg, config.db, config.db.name)}`);
      const testStatus = await ensureDatabase(pg, config.db, process.env.DB_NAME_TEST);
      if (testStatus) console.log(`• Base de pruebas "${process.env.DB_NAME_TEST}": ${testStatus}`);
    } catch (error) {
      console.error(`✖ No se pudo conectar o crear la base en ${config.db.host}:${config.db.port} con el usuario "${config.db.user}":`);
      console.error(`  ${error.message}`);
      console.error('  Revisa DB_HOST, DB_PORT, DB_USER y DB_PASSWORD en .env (el usuario necesita permiso para crear bases).');
      process.exitCode = 1;
      return;
    }
  }

  if ((await hasTables()) && !reset) {
    console.log('• La base ya tiene tablas; no se modificó para no borrar datos.');
    console.log('  Para borrar todo y volver a crear las tablas con datos demo: npm run setup -- --reset');
  } else {
    execSync('node scripts/db-init.js', { cwd: root, stdio: 'inherit' });
    if (!config.db.url && process.env.DB_NAME_TEST) {
      execSync('node scripts/db-init.js --no-seed', { cwd: root, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'test' } });
      console.log('• Esquema creado también en la base de pruebas.');
    }
  }

  if (config.storage.supabaseUrl) {
    try {
      console.log(`• Bucket "${config.storage.bucket}": ${await ensureBucket(config)}`);
    } catch (error) {
      console.error(`✖ Supabase Storage: ${error.message} (revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)`);
    }
  } else {
    console.log('• Archivos: sin Supabase, se guardarán en la carpeta local uploads/.');
  }
  console.log(config.mail.enabled ? `• Correo: Gmail (${config.mail.user})` : '• Correo: sin GMAIL_USER, los correos se mostrarán en la consola.');
  console.log('\n✔ Listo. Arranca la API con: npm run dev');
}

main().catch((error) => {
  console.error('✖ Error inesperado:', error.message);
  process.exitCode = 1;
});
