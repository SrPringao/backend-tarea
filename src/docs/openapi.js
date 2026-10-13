// Especificación OpenAPI 3 generada a partir del inventario y de los esquemas Joi,
// así la documentación no se desincroniza de las validaciones reales.
const j2s = require('joi-to-swagger');
const { modules, operations } = require('./inventory');

const tagDescriptions = {
  Auth: 'Registro, inicio de sesión y perfil (Sequelize ORM)',
  Users: 'Administración de usuarios, requiere rol admin (Sequelize ORM)',
  Accounts: 'Tarjetas, débito y efectivo (Sequelize ORM)',
  Categories: 'Categorías de gasto (Sequelize ORM)',
  Contacts: 'Personas que te deben dinero (Sequelize ORM)',
  Preferences: 'Preferencias del usuario (Sequelize ORM)',
  Expenses: 'Gastos variables (SQL nativo)',
  Budgets: 'Presupuestos mensuales (SQL nativo)',
  FixedExpenses: 'Gastos fijos y sus pagos (SQL nativo)',
  NetWorth: 'Activos y deudas (SQL nativo)',
  Reports: 'Reportes y dashboard (SQL nativo)',
};

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

function parameters(schemas = {}, path) {
  const params = [];
  for (const location of ['params', 'query']) {
    const schema = schemas[location];
    if (!schema) continue;
    const { swagger } = j2s(schema);
    for (const [name, prop] of Object.entries(swagger.properties || {})) {
      params.push({
        name,
        in: location === 'params' ? 'path' : 'query',
        required: location === 'params' || (swagger.required || []).includes(name),
        schema: prop,
      });
    }
  }
  // Parámetros de ruta sin esquema explícito
  for (const [, name] of path.matchAll(/\{(\w+)\}/g)) {
    if (!params.some((p) => p.name === name && p.in === 'path')) {
      params.push({ name, in: 'path', required: true, schema: { type: 'string' } });
    }
  }
  return params;
}

function buildOperation(op) {
  const isPublic = op.access === 'Pública';
  const operation = {
    tags: [op.tag],
    operationId: op.id,
    summary: op.name,
    description: [op.description, `Acceso a datos: ${op.data}.`, `Seguridad: ${op.access}.`].filter(Boolean).join('\n\n'),
    parameters: parameters(op.schemas, op.path),
    responses: {
      200: { description: 'Operación exitosa', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
      400: errorResponse('Datos inválidos (incluye detalle por campo)'),
      500: errorResponse('Error interno'),
    },
  };

  if (op.method === 'POST' || (op.method === 'PUT' && /budgets/.test(op.path))) {
    operation.responses[201] = { description: 'Recurso creado' };
  }
  if (op.method === 'DELETE') {
    delete operation.responses[200];
    operation.responses[204] = { description: 'Eliminado, sin contenido' };
  }
  if (!isPublic) {
    operation.security = [{ bearerAuth: [] }];
    operation.responses[401] = errorResponse('Token ausente, inválido o expirado');
    if (op.access.includes('admin')) operation.responses[403] = errorResponse('Requiere rol admin');
  }
  if (op.path.includes('{')) operation.responses[404] = errorResponse('No encontrado o no pertenece al usuario');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(op.method)) operation.responses[409] = errorResponse('Conflicto (duplicado o datos relacionados)');

  if (op.schemas?.body) {
    const { swagger } = j2s(op.schemas.body);
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: swagger, ...(op.example && { example: op.example }) } },
    };
  }
  return operation;
}

function buildSpec() {
  const paths = {};
  for (const op of operations.filter((o) => o.implemented)) {
    paths[op.path] = paths[op.path] || {};
    paths[op.path][op.method.toLowerCase()] = buildOperation(op);
  }

  const usedTags = new Set(operations.filter((o) => o.implemented).map((o) => o.tag));

  return {
    openapi: '3.0.3',
    info: {
      title: 'API Finanzas Personales',
      version: '1.0.0',
      description: [
        'Backend para la app Flutter de control de gastos, presupuestos y patrimonio.',
        '',
        '**Cómo probar:** ejecuta `POST /api/auth/login` con `demo@gastos.app` / `Demo1234`, copia `data.token` y pégalo en el botón **Authorize**.',
        '',
        'Todas las respuestas tienen la forma `{ ok: true, data, meta? }` o `{ ok: false, error: { status, message, details? } }`.',
        'Montos en pesos con 2 decimales, fechas `YYYY-MM-DD`, meses `YYYY-MM`.',
      ].join('\n'),
    },
    servers: [{ url: '/', description: 'Servidor actual' }],
    tags: modules.filter((m) => usedTags.has(m.tag)).map((m) => ({ name: m.tag, description: tagDescriptions[m.tag] })),
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Success: {
          type: 'object',
          properties: { ok: { type: 'boolean', example: true }, data: {}, meta: { type: 'object' } },
        },
        Error: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                status: { type: 'integer', example: 400 },
                message: { type: 'string', example: 'Datos inválidos' },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { location: { type: 'string' }, field: { type: 'string' }, message: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    paths,
  };
}

module.exports = buildSpec();
