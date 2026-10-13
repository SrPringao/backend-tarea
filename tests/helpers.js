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

module.exports = { api, newUser, login, bearer, closeConnections };
