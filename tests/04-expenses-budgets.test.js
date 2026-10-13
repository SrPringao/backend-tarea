const { api, newUser, bearer, closeConnections } = require('./helpers');

afterAll(closeConnections);

let token;
let otherToken;
let accountId;
let categoryId;
let otherAccountId;

beforeAll(async () => {
  ({ token } = await newUser('gastos'));
  ({ token: otherToken } = await newUser('ajeno'));
  accountId = (await api().post('/api/accounts').set(bearer(token)).send({ name: 'Débito', type: 'debit' })).body.data.id;
  categoryId = (await api().post('/api/categories').set(bearer(token)).send({ name: 'Comida' })).body.data.id;
  otherAccountId = (await api().post('/api/accounts').set(bearer(otherToken)).send({ name: 'Ajena', type: 'cash' })).body.data.id;
});

describe('Gastos', () => {
  let expenseId;

  test('Registrar gasto -> 201 con nombres de cuenta y categoría', async () => {
    const res = await api().post('/api/expenses').set(bearer(token)).send({ amount: 250.5, date: '2026-09-10', description: 'Súper', accountId, categoryId });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ amount: 250.5, accountName: 'Débito', categoryName: 'Comida' });
    expenseId = res.body.data.id;
  });

  test('Registrar gasto con monto negativo y fecha inexistente -> 400', async () => {
    const res = await api().post('/api/expenses').set(bearer(token)).send({ amount: -5, date: '2026-02-30', accountId });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['amount', 'date']));
  });

  test('Registrar gasto en cuenta de otro usuario -> 400', async () => {
    const res = await api().post('/api/expenses').set(bearer(token)).send({ amount: 10, date: '2026-09-10', accountId: otherAccountId });
    expect(res.status).toBe(400);
  });

  test('Listar gastos con filtros, orden y paginación -> 200', async () => {
    await api().post('/api/expenses').set(bearer(token)).send({ amount: 99, date: '2026-09-15', description: 'Taxi', accountId });
    await api().post('/api/expenses').set(bearer(token)).send({ amount: 1200, date: '2026-08-01', description: 'Súper grande', accountId, categoryId });

    const res = await api().get('/api/expenses').query({ from: '2026-09-01', to: '2026-09-30', sort: 'amount', order: 'asc', limit: 10 }).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e.amount)).toEqual([99, 250.5]);
    expect(res.body.meta).toMatchObject({ total: 2, totalAmount: 349.5 });
  });

  test('Búsqueda por texto en la descripción -> 200', async () => {
    const res = await api().get('/api/expenses?search=súper').set(bearer(token));
    expect(res.body.data).toHaveLength(2);
  });

  test('Búsqueda con comodín SQL se toma literal (sin inyección) -> 200 vacío', async () => {
    const res = await api().get('/api/expenses').query({ search: "%' OR 1=1 --" }).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('Rango de fechas invertido -> 400', async () => {
    const res = await api().get('/api/expenses?from=2026-10-01&to=2026-09-01').set(bearer(token));
    expect(res.status).toBe(400);
  });

  test('Campo de orden no permitido -> 400', async () => {
    const res = await api().get('/api/expenses?sort=password_hash').set(bearer(token));
    expect(res.status).toBe(400);
  });

  test('Actualizar gasto -> 200', async () => {
    const res = await api().put(`/api/expenses/${expenseId}`).set(bearer(token)).send({ amount: 300, categoryId: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ amount: 300, categoryId: null });
  });

  test('Otro usuario no puede editar mi gasto -> 404', async () => {
    const res = await api().put(`/api/expenses/${expenseId}`).set(bearer(otherToken)).send({ amount: 1 });
    expect(res.status).toBe(404);
  });

  test('Resumen por categoría con porcentajes -> 200', async () => {
    const res = await api().get('/api/expenses/summary?from=2026-08-01&to=2026-09-30').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1599);
    const sum = res.body.data.categories.reduce((s, c) => s + c.percentage, 0);
    expect(Math.round(sum)).toBe(100);
  });

  test('Eliminar cuenta con gastos -> 409 (integridad referencial)', async () => {
    const res = await api().delete(`/api/accounts/${accountId}`).set(bearer(token));
    expect(res.status).toBe(409);
  });

  test('Eliminar gasto -> 204 y luego 404', async () => {
    expect((await api().delete(`/api/expenses/${expenseId}`).set(bearer(token))).status).toBe(204);
    expect((await api().get(`/api/expenses/${expenseId}`).set(bearer(token))).status).toBe(404);
  });
});

describe('Presupuestos', () => {
  test('Definir presupuesto nuevo -> 201', async () => {
    const res = await api().put('/api/budgets/2026-09').set(bearer(token)).send({ amount: 5000 });
    expect(res.status).toBe(201);
  });

  test('Redefinir presupuesto existente (upsert) -> 200', async () => {
    const res = await api().put('/api/budgets/2026-09').set(bearer(token)).send({ amount: 6000 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(6000);
  });

  test('Mes con formato inválido -> 400', async () => {
    const res = await api().put('/api/budgets/2026-13').set(bearer(token)).send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  test('Estado del mes calcula gastado y restante -> 200', async () => {
    const res = await api().get('/api/budgets/2026-09').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ budget: 6000, source: 'month', spent: 99, remaining: 5901 });
  });

  test('Mes sin presupuesto usa el presupuesto por defecto -> 200', async () => {
    await api().put('/api/preferences').set(bearer(token)).send({ defaultBudget: 7000 });
    const res = await api().get('/api/budgets/2026-08').set(bearer(token));
    expect(res.body.data).toMatchObject({ budget: 7000, source: 'default', spent: 1200 });
  });

  test('Listar presupuestos con lo gastado -> 200', async () => {
    const res = await api().get('/api/budgets?year=2026').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ month: '2026-09', spent: 99 });
  });

  test('Eliminar presupuesto -> 204 y de nuevo -> 404', async () => {
    expect((await api().delete('/api/budgets/2026-09').set(bearer(token))).status).toBe(204);
    expect((await api().delete('/api/budgets/2026-09').set(bearer(token))).status).toBe(404);
  });
});
