// Documentación de la API GraphQL:
//  - docs/schema.graphql: el schema completo en SDL (tipos, operaciones y descripciones)
//  - docs/graphql/index.html: página navegable generada con SpectaQL a partir de ese schema
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { printSchema } = require('graphql');
const { schema } = require('../src/graphql');

const docsDir = path.join(__dirname, '../docs');
const schemaFile = path.join(docsDir, 'schema.graphql');
const configFile = path.join(docsDir, 'spectaql.yml');

fs.writeFileSync(schemaFile, `${printSchema(schema)}\n`);
console.log(`Schema exportado: ${schemaFile}`);

fs.writeFileSync(
  configFile,
  `spectaql:
  targetDir: ./docs/graphql
  oneFile: true
  embedLogo: false

introspection:
  schemaFile: ./docs/schema.graphql

info:
  title: API Finanzas Personales - GraphQL
  description: |
    API GraphQL de la etapa 2 (40 % restante de la lógica de negocio). Endpoint único: POST /graphql.

    Autenticación: cabecera Authorization: Bearer TOKEN (se obtiene con POST /api/auth/login de la API REST).
    La mutación webhookExpense usa la cabecera X-API-Key. Los errores llevan extensions.code
    (UNAUTHENTICATED, FORBIDDEN, BAD_USER_INPUT, NOT_FOUND, CONFLICT).

    Protecciones: profundidad máxima 8, costo máximo 5000, máximo 10 alias, 2000 tokens por consulta,
    100 KB por petición JSON y 3 MB por subida (2 MB por archivo); en producción se desactivan la introspección y GraphiQL.

servers:
  - url: http://localhost:3000/graphql
    description: Desarrollo local
    production: true
`
);

execFileSync(path.join(__dirname, '../node_modules/.bin/spectaql'), [configFile], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
console.log(`Documentación HTML: ${path.join(docsDir, 'graphql/index.html')}`);
