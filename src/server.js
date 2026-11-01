const app = require('./app');
const config = require('./config/env');
const { sequelize, closeConnections } = require('./config/database');

async function start() {
  try {
    await sequelize.authenticate();
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL:', error.message);
    console.error('Revisa DATABASE_URL o DB_HOST/DB_USER/DB_PASSWORD en .env y que la base exista (npm run setup la crea).');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`API escuchando en http://localhost:${config.port}`);
    console.log(`Documentación REST: http://localhost:${config.port}/api-docs`);
    console.log(`GraphQL: http://localhost:${config.port}/graphql`);
    console.log(config.mail.enabled ? `Correo: Gmail (${config.mail.user})` : 'Correo: sin GMAIL_USER, los correos se muestran en la consola');
    console.log(config.storage.supabaseUrl ? 'Archivos: Supabase Storage' : 'Archivos: carpeta local uploads/');
  });

  const scheduler = config.schedulerEnabled ? require('./services/scheduler').start() : null;

  const shutdown = () => {
    if (scheduler) scheduler.stop();
    server.close(async () => {
      await closeConnections();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
