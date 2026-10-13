const { api, newUser, bearer, closeConnections } = require('./helpers');

afterAll(closeConnections);

let token;
let otherToken;

beforeAll(async () => {
  ({ token } = await newUser('catalogos'));
  ({ token: otherToken } = await newUser('intruso'));
});

describe('Cuentas', () => {
  let creditId;

  test('Crear tarjeta de crédito -> 201', async () => {
    const res = await api().post('/api/accounts').set(bearer(token)).send({ name: 'BBVA', type: 'credit', creditLimit: 20000, paymentDay: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.creditLimit).toBe(20000);
    creditId = res.body.data.id;
  });

  test('Crear cuenta de débito ignora límite de crédito -> 201', async () => {
    const res = await api().post('/api/accounts').set(bearer(token)).send({ name: 'Débito', type: 'debit', creditLimit: 5000 });
    expect(res.status).toBe(201);
    expect(res.body.data.creditLimit).toBeNull();
  });

  test('Crear cuenta con tipo inválido y color mal formado -> 400', async () => {
    const res = await api().post('/api/accounts').set(bearer(token)).send({ name: 'X', type: 'bitcoin', color: 'rojo' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['type', 'color']));
  });

  test('Listar cuentas filtrando por tipo -> 200', async () => {
    const res = await api().get('/api/accounts?type=credit').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.every((a) => a.type === 'credit')).toBe(true);
  });

  test('Actualizar cuenta -> 200', async () => {
    const res = await api().put(`/api/accounts/${creditId}`).set(bearer(token)).send({ name: 'BBVA Oro' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('BBVA Oro');
  });

  test('Otro usuario no puede ver mi cuenta -> 404', async () => {
    const res = await api().get(`/api/accounts/${creditId}`).set(bearer(otherToken));
    expect(res.status).toBe(404);
  });

  test('Archivar cuenta la oculta del listado -> 200', async () => {
    const res = await api().patch(`/api/accounts/${creditId}/archive`).set(bearer(token)).send({ archived: true });
    expect(res.status).toBe(200);
    const list = await api().get('/api/accounts').set(bearer(token));
    expect(list.body.data.some((a) => a.id === creditId)).toBe(false);
    const all = await api().get('/api/accounts?includeArchived=true').set(bearer(token));
    expect(all.body.data.some((a) => a.id === creditId)).toBe(true);
  });

  test('Eliminar cuenta sin gastos -> 204', async () => {
    const res = await api().delete(`/api/accounts/${creditId}`).set(bearer(token));
    expect(res.status).toBe(204);
  });
});

describe('Categorías', () => {
  let categoryId;

  test('Crear categoría -> 201', async () => {
    const res = await api().post('/api/categories').set(bearer(token)).send({ name: 'Comida', color: '#E4572E' });
    expect(res.status).toBe(201);
    categoryId = res.body.data.id;
  });

  test('Crear categoría duplicada con otras mayúsculas -> 409', async () => {
    const res = await api().post('/api/categories').set(bearer(token)).send({ name: 'COMIDA' });
    expect(res.status).toBe(409);
  });

  test('Otro usuario sí puede usar el mismo nombre -> 201', async () => {
    const res = await api().post('/api/categories').set(bearer(otherToken)).send({ name: 'Comida' });
    expect(res.status).toBe(201);
  });

  test('Listar y buscar categorías -> 200', async () => {
    const res = await api().get('/api/categories?search=com').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('Actualizar categoría -> 200', async () => {
    const res = await api().put(`/api/categories/${categoryId}`).set(bearer(token)).send({ color: '#000000' });
    expect(res.status).toBe(200);
  });

  test('Actualizar sin campos -> 400', async () => {
    const res = await api().put(`/api/categories/${categoryId}`).set(bearer(token)).send({});
    expect(res.status).toBe(400);
  });

  test('Eliminar categoría -> 204', async () => {
    expect((await api().delete(`/api/categories/${categoryId}`).set(bearer(token))).status).toBe(204);
    expect((await api().get(`/api/categories/${categoryId}`).set(bearer(token))).status).toBe(404);
  });
});

describe('Contactos', () => {
  let contactId;

  test('Crear contacto -> 201', async () => {
    const res = await api().post('/api/contacts').set(bearer(token)).send({ name: 'José  Pérez' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('José Pérez');
    contactId = res.body.data.id;
  });

  test('Contacto duplicado sin acentos ni mayúsculas -> 409', async () => {
    const res = await api().post('/api/contacts').set(bearer(token)).send({ name: 'jose perez' });
    expect(res.status).toBe(409);
  });

  test('Archivar contacto -> 200 y desaparece del listado', async () => {
    const res = await api().put(`/api/contacts/${contactId}`).set(bearer(token)).send({ archived: true });
    expect(res.status).toBe(200);
    const list = await api().get('/api/contacts').set(bearer(token));
    expect(list.body.data).toHaveLength(0);
  });

  test('Eliminar contacto -> 204', async () => {
    expect((await api().delete(`/api/contacts/${contactId}`).set(bearer(token))).status).toBe(204);
  });
});

describe('Preferencias', () => {
  test('Consultar preferencias por defecto -> 200', async () => {
    const res = await api().get('/api/preferences').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ theme: 'dark', currency: 'MXN' });
  });

  test('Actualizar preferencias -> 200', async () => {
    const res = await api().put('/api/preferences').set(bearer(token)).send({ theme: 'light', defaultBudget: 9000, currency: 'usd' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ theme: 'light', defaultBudget: 9000, currency: 'USD' });
  });

  test('Tema no permitido -> 400', async () => {
    const res = await api().put('/api/preferences').set(bearer(token)).send({ theme: 'rosa' });
    expect(res.status).toBe(400);
  });
});
