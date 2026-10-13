const app = require('./app');
const config = require('./config/env');
const { sequelize, closeConnections } = require('./config/database');

async function start() {
  try {
    await sequelize.authenticate();
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL. ¿Levantaste la base con "npm run db:up"?', error.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`API escuchando en http://localhost:${config.port}`);
    console.log(`Documentación: http://localhost:${config.port}/api-docs`);
  });

  const shutdown = () => {
    server.close(async () => {
      await closeConnections();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
