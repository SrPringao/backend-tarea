// Genera docs/API_Finanzas.postman_collection.json con todas las operaciones implementadas:
//  - una carpeta por módulo REST (desde el inventario)
//  - una carpeta "GraphQL" con un request por operación (desde src/docs/graphqlExamples.js)
// "Iniciar sesión" guarda {{token}} y {{refreshToken}} automáticamente. Cada ejemplo GraphQL se valida
// contra el schema real antes de escribir la colección, así no se publican ejemplos con errores.
const fs = require('fs');
const path = require('path');
const { parse, validate } = require('graphql');
const { modules, operations } = require('../src/docs/inventory');
const examples = require('../src/docs/graphqlExamples');
const { schema } = require('../src/graphql');

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

  if (op.access === 'Pública' || op.access.startsWith('URL firmada')) request.auth = { type: 'noauth' };
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
            "if (body.data && body.data.refreshToken) pm.collectionVariables.set('refreshToken', body.data.refreshToken);",
          ],
        },
      },
    ];
  }
  return item;
}

// Nombres de operación GraphQL mencionados en el inventario (p. ej. "mutation verifyEmail / sendVerificationEmail")
const namesIn = (op) => (op.graphql.match(/\b[a-z]\w+\b/g) || []).filter((name) => examples[name]);

function assertValid(name, query) {
  const errors = validate(schema, parse(query));
  if (errors.length) throw new Error(`El ejemplo GraphQL "${name}" no es válido: ${errors.map((e) => e.message).join('; ')}`);
}

function buildGraphqlRequest(name, example, op) {
  assertValid(name, example.query);
  const headers = [];
  const request = {
    method: 'POST',
    header: headers,
    url: { raw: '{{baseUrl}}/graphql', host: ['{{baseUrl}}'], path: ['graphql'] },
    description: [
      `${op.id} · ${op.name}. ${op.description || ''}`,
      `Acceso a datos: ${op.data} | Seguridad: ${op.access}`,
      example.upload ? 'Subida de archivo: en Body > form-data elige el archivo en la clave "0".' : null,
      example.admin ? 'Requiere iniciar sesión con admin@gastos.app / Admin1234.' : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };

  if (example.auth === 'none') request.auth = { type: 'noauth' };
  if (example.auth === 'apiKey') {
    request.auth = { type: 'noauth' };
    headers.push({ key: 'X-API-Key', value: '{{apiKey}}' });
  }

  if (example.upload) {
    const fileVar = Object.keys(example.variables).find((k) => example.variables[k] === null);
    request.body = {
      mode: 'formdata',
      formdata: [
        { key: 'operations', type: 'text', value: JSON.stringify({ query: example.query, variables: example.variables }) },
        { key: 'map', type: 'text', value: JSON.stringify({ 0: [`variables.${fileVar}`] }) },
        { key: '0', type: 'file', src: [] },
      ],
    };
  } else {
    request.body = { mode: 'graphql', graphql: { query: example.query, variables: JSON.stringify(example.variables || {}, null, 2) } };
  }

  const item = { name: `GraphQL ${name}`, request };
  if (name === 'createApiToken') {
    item.event = [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: ["const t = pm.response.json().data?.createApiToken?.token; if (t) pm.collectionVariables.set('apiKey', t);"] },
      },
    ];
  }
  return item;
}

const graphqlOps = operations.filter((op) => op.implemented && op.api === 'GraphQL');
const graphqlFolders = modules
  .map((mod) => ({
    name: mod.name,
    item: graphqlOps.filter((op) => op.module === mod.name).flatMap((op) => namesIn(op).map((name) => buildGraphqlRequest(name, examples[name], op))),
  }))
  .filter((folder) => folder.item.length);

const covered = new Set(graphqlFolders.flatMap((f) => f.item.map((i) => i.name.replace('GraphQL ', ''))));
const missing = Object.keys(examples).filter((name) => !covered.has(name));
if (missing.length) throw new Error(`Ejemplos sin operación en el inventario: ${missing.join(', ')}`);

const collection = {
  info: {
    name: 'API Finanzas Personales',
    description: [
      'Colección generada desde el inventario de operaciones.',
      '1. Ejecuta "Autenticación > POST Iniciar sesión" (usuario demo): el token y el refresh token se guardan solos.',
      '2. Las carpetas REST corresponden a la etapa 1; la carpeta "GraphQL" contiene el 40 % restante (etapa 2).',
      '3. Para las operaciones de administración inicia sesión con admin@gastos.app / Admin1234.',
      '4. Para webhookExpense ejecuta antes "GraphQL createApiToken": guarda {{apiKey}} automáticamente.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'token', value: '' },
    { key: 'refreshToken', value: '' },
    { key: 'apiKey', value: '' },
  ],
  item: [
    ...modules
      .map((mod) => ({ name: mod.name, item: mod.operations.filter((op) => op.implemented && (op.api || 'REST') === 'REST').map((op) => buildRequest({ ...op, ...operations.find((o) => o.name === op.name && o.module === mod.name) })) }))
      .filter((folder) => folder.item.length),
    { name: 'GraphQL (etapa 2)', description: 'Todas las peticiones van a POST {{baseUrl}}/graphql.', item: graphqlFolders },
  ],
};

fs.writeFileSync(OUT, JSON.stringify(collection, null, 2));
const restCount = collection.item.slice(0, -1).reduce((n, f) => n + f.item.length, 0);
console.log(`Colección de Postman generada: ${OUT}`);
console.log(`  REST: ${restCount} requests · GraphQL: ${covered.size} requests (todos validados contra el schema)`);
