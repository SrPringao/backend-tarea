const request = require('supertest');
const app = require('../src/app');
const { closeConnections } = require('../src/config/database');

const api = () => request(app);
let counter = 0;

// Crea un usuario nuevo y aislado por archivo de prueba; devuelve su token
async function newUser(prefix = 'user') {
  counter += 1;
  const email = `${prefix}.${Date.now()}.${counter}@test.com`;
  const res = await api().post('/api/auth/register').send({ email, password: 'Prueba123', displayName: `Prueba ${prefix}` });
  return { token: res.body.data.token, user: res.body.data.user, email, password: 'Prueba123' };
}

async function login(email, password) {
  const res = await api().post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Petición GraphQL (JSON). Devuelve la respuesta de supertest.
function gql(query, variables = {}, token, headers = {}) {
  const req = api().post('/graphql').set(headers).send({ query, variables });
  return token ? req.set(bearer(token)) : req;
}

// Petición GraphQL con archivo (multipart, GraphQL multipart request spec)
function gqlUpload(query, variables, filePath, buffer, filename, token) {
  return api()
    .post('/graphql')
    .set(bearer(token))
    .field('operations', JSON.stringify({ query, variables }))
    .field('map', JSON.stringify({ 0: [filePath] }))
    .attach('0', buffer, filename);
}

// Código del primer error GraphQL (UNAUTHENTICATED, BAD_USER_INPUT, ...)
const errorCode = (res) => res.body.errors?.[0]?.extensions?.code;

module.exports = { api, newUser, login, bearer, gql, gqlUpload, errorCode, closeConnections };
