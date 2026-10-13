// Reinicia la base de pruebas (esquema + datos demo) antes de toda la suite
const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  execSync('node scripts/db-init.js', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'ignore',
  });
};
