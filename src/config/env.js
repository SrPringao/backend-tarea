const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';
const isProd = env === 'production';
const port = Number(process.env.PORT) || 3000;

// Errores de configuración: se juntan todos para mostrarlos de una sola vez al arrancar
const problems = [];

const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < (isProd ? 32 : 16)) {
  problems.push(`JWT_SECRET no está definido o tiene menos de ${isProd ? 32 : 16} caracteres`);
}

// Base de datos: DATABASE_URL (Supabase u otro servicio en la nube) o variables sueltas (PostgreSQL local).
// Las pruebas nunca usan DATABASE_URL para no tocar la base real; usan DATABASE_URL_TEST o DB_NAME_TEST.
const databaseUrl = (isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL) || null;
if (databaseUrl && !/^postgres(ql)?:\/\/[^\s]+@[^\s/]+\/[^\s]+$/.test(databaseUrl)) {
  problems.push('DATABASE_URL no tiene el formato postgresql://usuario:contraseña@host:puerto/base (sin espacios ni corchetes)');
}
const dbName = isTest ? process.env.DB_NAME_TEST : process.env.DB_NAME;
if (!databaseUrl && (!process.env.DB_USER || !dbName)) {
  problems.push(
    `Falta la conexión a la base de datos: define DATABASE_URL o DB_USER, DB_PASSWORD y ${isTest ? 'DB_NAME_TEST' : 'DB_NAME'}`
  );
}

const gmailUser = process.env.GMAIL_USER || '';
const gmailPassword = process.env.GMAIL_APP_PASSWORD || '';
if (Boolean(gmailUser) !== Boolean(gmailPassword)) {
  problems.push('GMAIL_USER y GMAIL_APP_PASSWORD deben definirse juntos (o dejarse ambos vacíos)');
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (Boolean(supabaseUrl) !== Boolean(supabaseKey)) {
  problems.push('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben definirse juntos (o dejarse ambos vacíos)');
}

if (problems.length) {
  throw new Error(`Configuración incompleta (revisa el archivo .env; guía en .env.example):\n  - ${problems.join('\n  - ')}`);
}

module.exports = {
  env,
  isTest,
  isProd,
  port,
  // URL pública de la API; se usa para armar los enlaces de los correos
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  db: {
    url: databaseUrl,
    // Las pruebas usan la base local (sin TLS); DB_SSL solo aplica a la base real
    ssl: isTest ? process.env.DB_SSL_TEST === 'true' : process.env.DB_SSL === 'true',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: dbName,
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  },
  // Sin credenciales de Gmail los correos se imprimen en la consola (la app no falla)
  mail: {
    enabled: Boolean(gmailUser),
    user: gmailUser,
    appPassword: gmailPassword,
    from: process.env.MAIL_FROM || `"Finanzas Personales" <${gmailUser || 'no-reply@finanzas.local'}>`,
  },
  // Sin Supabase los archivos se guardan en la carpeta local uploads/
  storage: {
    supabaseUrl,
    supabaseKey,
    bucket: process.env.SUPABASE_BUCKET || 'archivos',
    localDir: path.resolve(__dirname, '../..', isTest ? 'uploads-test' : 'uploads'),
    maxBytes: 2 * 1024 * 1024,
  },
  schedulerEnabled: process.env.ENABLE_SCHEDULER === 'true',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((o) => o.trim()),
  bcryptRounds: isTest ? 4 : 10,
};
