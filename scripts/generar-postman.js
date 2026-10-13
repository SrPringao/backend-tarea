// Genera docs/API_Finanzas.postman_collection.json con todas las operaciones implementadas.
// El request "Iniciar sesión" guarda el token en la variable {{token}} automáticamente.
const fs = require('fs');
const path = require('path');
const { modules } = require('../src/docs/inventory');

const OUT = path.join(__dirname, '../docs/API_Finanzas.postman_collection.json');

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const pathValues = { id: '1', month };

function buildRequest(op) {
  const segments = op.path.replace(/^\//, '').split('/');
  const variables = [];
  const urlPath = segments.map((s) => {
    const match = s.match(/^\{(\w+)\}$/);
    if (!match) return s;
    variables.push({ key: match[1], value: pathValues[match[1]] || '' });
    return `:${match[1]}`;
  });

  const request = {
    method: op.method,
    header: [],
    url: {
      raw: `{{baseUrl}}/${urlPath.join('/')}`,
      host: ['{{baseUrl}}'],
      path: urlPath,
      ...(variables.length && { variable: variables }),
    },
    description: [op.description, `Acceso a datos: ${op.data} | Seguridad: ${op.access}`].filter(Boolean).join('\n\n'),
  };

  if (op.access === 'Pública') request.auth = { type: 'noauth' };
  if (op.example) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: JSON.stringify(op.example, null, 2), options: { raw: { language: 'json' } } };
  }

  const item = { name: `${op.method} ${op.name}`, request };

  if (op.path === '/api/auth/login' || op.path === '/api/auth/register') {
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'const body = pm.response.json();',
            "pm.test('Responde con token', () => pm.expect(body.data.token).to.be.a('string'));",
            "if (body.data && body.data.token) pm.collectionVariables.set('token', body.data.token);",
          ],
        },
      },
    ];
  }
  return item;
}

const collection = {
  info: {
    name: 'API Finanzas Personales',
    description:
      'Colección generada desde el inventario de operaciones. Ejecuta primero "Autenticación > POST Iniciar sesión" (usuario demo) y el token se guarda solo. Para probar las rutas de administración inicia sesión con admin@gastos.app / Admin1234.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'token', value: '' },
  ],
  item: modules
    .map((mod) => ({ name: mod.name, item: mod.operations.filter((op) => op.implemented).map(buildRequest) }))
    .filter((folder) => folder.item.length),
};

fs.writeFileSync(OUT, JSON.stringify(collection, null, 2));
console.log(`Colección de Postman generada: ${OUT}`);
