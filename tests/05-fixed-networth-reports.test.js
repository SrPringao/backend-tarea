const { api, newUser, login, bearer, closeConnections } = require('./helpers');

afterAll(closeConnections);

let token;

beforeAll(async () => {
  ({ token } = await newUser('fijos'));
});

describe('Gastos fijos', () => {
  let fixedId;

  test('Crear gasto fijo -> 201', async () => {
    const res = await api().post('/api/fixed-expenses').set(bearer(token)).send({ name: 'Renta', amount: 8000, dayOfMonth: 1 });
    expect(res.status).toBe(201);
    fixedId = res.body.data.id;
  });

  test('Día del mes fuera de rango -> 400', async () => {
    const res = await api().post('/api/fixed-expenses').set(bearer(token)).send({ name: 'X', amount: 10, dayOfMonth: 40 });
    expect(res.status).toBe(400);
  });

  test('Marcar como pagado -> 201', async () => {
    const res = await api().post(`/api/fixed-expenses/${fixedId}/payments`).set(bearer(token)).send({ month: '2026-10' });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(8000);
  });

  test('Marcar dos veces el mismo mes -> 409', async () => {
    const res = await api().post(`/api/fixed-expenses/${fixedId}/payments`).set(bearer(token)).send({ month: '2026-10' });
    expect(res.status).toBe(409);
  });

  test('Listar con estado de pago y totales del mes -> 200', async () => {
    await api().post('/api/fixed-expenses').set(bearer(token)).send({ name: 'Gimnasio', amount: 500 });
    const res = await api().get('/api/fixed-expenses?month=2026-10').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 8500, paidTotal: 8000, pendingTotal: 500 });
  });

  test('Consultar con historial de pagos -> 200', async () => {
    const res = await api().get(`/api/fixed-expenses/${fixedId}`).set(bearer(token));
    expect(res.body.data.payments).toHaveLength(1);
  });

  test('Actualizar gasto fijo -> 200', async () => {
    const res = await api().put(`/api/fixed-expenses/${fixedId}`).set(bearer(token)).send({ amount: 8200 });
    expect(res.body.data.amount).toBe(8200);
  });

  test('Desmarcar pago del mes -> 204', async () => {
    const res = await api().delete(`/api/fixed-expenses/${fixedId}/payments/2026-10`).set(bearer(token));
    expect(res.status).toBe(204);
  });

  test('Eliminar gasto fijo -> 204', async () => {
    expect((await api().delete(`/api/fixed-expenses/${fixedId}`).set(bearer(token))).status).toBe(204);
  });
});

describe('Patrimonio', () => {
  let contactId;
  let debtId;

  beforeAll(async () => {
    contactId = (await api().post('/api/contacts').set(bearer(token)).send({ name: 'Camila' })).body.data.id;
  });

  test('Registrar activo ligado a contacto -> 201', async () => {
    const res = await api().post('/api/net-worth').set(bearer(token)).send({ label: 'Préstamo', kind: 'asset', amount: 1500, contactId });
    expect(res.status).toBe(201);
    expect(res.body.data.contactName).toBe('Camila');
  });

  test('Registrar deuda con fecha límite -> 201', async () => {
    const res = await api().post('/api/net-worth').set(bearer(token)).send({ label: 'Tarjeta', kind: 'debt', amount: 500, dueDate: '2099-01-01' });
    expect(res.status).toBe(201);
    debtId = res.body.data.id;
  });

  test('Activo con fecha límite viola regla de negocio -> 400', async () => {
    const res = await api().post('/api/net-worth').set(bearer(token)).send({ label: 'X', kind: 'asset', amount: 1, dueDate: '2099-01-01' });
    expect(res.status).toBe(400);
  });

  test('Listar solo deudas -> 200', async () => {
    const res = await api().get('/api/net-worth?kind=debt').set(bearer(token));
    expect(res.body.data).toHaveLength(1);
  });

  test('Actualizar registro -> 200', async () => {
    const res = await api().put(`/api/net-worth/${debtId}`).set(bearer(token)).send({ amount: 300 });
    expect(res.body.data.amount).toBe(300);
  });

  test('Resumen de patrimonio neto -> 200', async () => {
    const res = await api().get('/api/net-worth/summary').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ assets: 1500, debts: 300, netWorth: 1200 });
    expect(res.body.data.receivablesByContact[0]).toMatchObject({ contactName: 'Camila', total: 1500 });
  });

  test('Eliminar registro -> 204', async () => {
    expect((await api().delete(`/api/net-worth/${debtId}`).set(bearer(token))).status).toBe(204);
  });
});

describe('Reportes', () => {
  let demoToken;

  beforeAll(async () => {
    demoToken = await login('demo@gastos.app', 'Demo1234');
  });

  test('Dashboard del mes con datos demo -> 200', async () => {
    const res = await api().get('/api/reports/dashboard').set(bearer(demoToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('topCategories');
    expect(res.body.data).toHaveProperty('fixedExpenses.pending');
  });

  test('Tendencia de 6 meses incluye meses sin gastos -> 200', async () => {
    const res = await api().get('/api/reports/monthly-trend?months=6').set(bearer(demoToken));
    expect(res.body.data).toHaveLength(6);
  });

  test('Tendencia con más de 24 meses -> 400', async () => {
    const res = await api().get('/api/reports/monthly-trend?months=50').set(bearer(demoToken));
    expect(res.status).toBe(400);
  });
});
