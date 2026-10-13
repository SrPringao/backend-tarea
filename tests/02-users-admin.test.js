const { api, newUser, login, bearer, closeConnections } = require('./helpers');

afterAll(closeConnections);

describe('Usuarios (administración)', () => {
  let adminToken;
  let adminId;
  let target;

  beforeAll(async () => {
    adminToken = await login('admin@gastos.app', 'Admin1234');
    adminId = (await api().get('/api/auth/me').set(bearer(adminToken))).body.data.id;
    target = await newUser('objetivo');
  });

  test('Listar usuarios paginado (admin) -> 200 con meta', async () => {
    const res = await api().get('/api/users?limit=2&page=1').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2 });
  });

  test('Buscar usuarios por correo -> 200', async () => {
    const res = await api().get('/api/users').query({ search: 'demo@' }).set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data[0].email).toBe('demo@gastos.app');
  });

  test('Consultar usuario por id -> 200', async () => {
    const res = await api().get(`/api/users/${target.user.id}`).set(bearer(adminToken));
    expect(res.status).toBe(200);
  });

  test('Consultar usuario con id que no es UUID -> 400', async () => {
    const res = await api().get('/api/users/123').set(bearer(adminToken));
    expect(res.status).toBe(400);
  });

  test('Desactivar usuario impide su acceso -> 200 y luego 401/403', async () => {
    const res = await api().patch(`/api/users/${target.user.id}`).set(bearer(adminToken)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await api().get('/api/accounts').set(bearer(target.token))).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: target.email, password: target.password })).status).toBe(403);
  });

  test('Admin no puede quitarse su propio rol -> 400', async () => {
    const res = await api().patch(`/api/users/${adminId}`).set(bearer(adminToken)).send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  test('Eliminar usuario -> 204 y luego 404', async () => {
    const res = await api().delete(`/api/users/${target.user.id}`).set(bearer(adminToken));
    expect(res.status).toBe(204);
    expect((await api().get(`/api/users/${target.user.id}`).set(bearer(adminToken))).status).toBe(404);
  });
});
