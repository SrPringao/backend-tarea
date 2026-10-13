const jwt = require('jsonwebtoken');
const { api, newUser, bearer, closeConnections } = require('./helpers');

afterAll(closeConnections);

describe('Autenticación', () => {
  const email = `auth.${Date.now()}@test.com`;
  let token;

  test('Registrar usuario con datos válidos -> 201 y JWT', async () => {
    const res = await api().post('/api/auth/register').send({ email, password: 'Segura123', displayName: 'Ana' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
    token = res.body.data.token;
  });

  test('Registrar con correo duplicado -> 409', async () => {
    const res = await api().post('/api/auth/register').send({ email: email.toUpperCase(), password: 'Segura123', displayName: 'Ana' });
    expect(res.status).toBe(409);
  });

  test('Registrar con contraseña débil y correo inválido -> 400 con detalle por campo', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'no-es-correo', password: 'corta', displayName: '' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'displayName']));
  });

  test('Iniciar sesión con credenciales correctas -> 200', async () => {
    const res = await api().post('/api/auth/login').send({ email, password: 'Segura123' });
    expect(res.status).toBe(200);
    expect(res.body.data.tokenType).toBe('Bearer');
  });

  test('Iniciar sesión con contraseña incorrecta -> 401', async () => {
    const res = await api().post('/api/auth/login').send({ email, password: 'Incorrecta1' });
    expect(res.status).toBe(401);
  });

  test('Consultar mi perfil con token -> 200 e incluye preferencias', async () => {
    const res = await api().get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.preferences.theme).toBe('dark');
  });

  test('Actualizar mi perfil -> 200', async () => {
    const res = await api().put('/api/auth/me').set(bearer(token)).send({ displayName: 'Ana López' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Ana López');
  });

  test('Cambiar contraseña con la actual incorrecta -> 400', async () => {
    const res = await api().put('/api/auth/password').set(bearer(token)).send({ currentPassword: 'Otra1234', newPassword: 'Nueva1234' });
    expect(res.status).toBe(400);
  });

  test('Cambiar contraseña y entrar con la nueva -> 200', async () => {
    const change = await api().put('/api/auth/password').set(bearer(token)).send({ currentPassword: 'Segura123', newPassword: 'Nueva1234' });
    expect(change.status).toBe(200);
    const res = await api().post('/api/auth/login').send({ email, password: 'Nueva1234' });
    expect(res.status).toBe(200);
  });
});

describe('Seguridad', () => {
  test('Ruta protegida sin token -> 401', async () => {
    const res = await api().get('/api/accounts');
    expect(res.status).toBe(401);
  });

  test('Token con firma alterada -> 401', async () => {
    const forged = jwt.sign({ sub: '00000000-0000-4000-8000-000000000000', role: 'admin' }, 'secreto-falso-del-atacante');
    const res = await api().get('/api/accounts').set(bearer(forged));
    expect(res.status).toBe(401);
  });

  test('Usuario normal intenta ruta de administrador -> 403', async () => {
    const { token } = await newUser('noadmin');
    const res = await api().get('/api/users').set(bearer(token));
    expect(res.status).toBe(403);
  });

  test('JSON malformado -> 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
  });

  test('Ruta inexistente -> 404', async () => {
    const res = await api().get('/api/no-existe');
    expect(res.status).toBe(404);
  });

  test('Cabeceras de seguridad de Helmet presentes', async () => {
    const res = await api().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('Health check de la base de datos (ORM y SQL) -> 200', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('up');
  });
});
