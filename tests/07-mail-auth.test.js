const { api, newUser, login, bearer, gql, errorCode, closeConnections } = require('./helpers');
const { outbox } = require('../src/services/mail');
const { currentMonth } = require('../src/utils/dates');

afterAll(closeConnections);

// Último correo enviado a una dirección (en pruebas se guardan en memoria, no se mandan)
const lastMailTo = (email) => [...outbox].reverse().find((m) => m.to === email);
const waitForMail = async (email, subject) => {
  for (let i = 0; i < 20; i += 1) {
    const mail = [...outbox].reverse().find((m) => m.to === email && (!subject || m.subject === subject));
    if (mail) return mail;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`No llegó el correo "${subject}" a ${email}`);
};

describe('Correo: confirmación de cuenta', () => {
  let user;
  let link;

  test('Registrarse envía el correo de confirmación con un enlace', async () => {
    user = await newUser('verifica');
    const mail = await waitForMail(user.email, 'Confirma tu cuenta');
    link = mail.text.match(/https?:\/\/\S+verify-email\?token=\S+/)[0];
    expect(mail.html).toContain('Confirmar mi correo');
  });

  test('Abrir el enlace confirma el correo y muestra una página HTML', async () => {
    const url = new URL(link);
    const res = await api().get(url.pathname + url.search);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Correo confirmado');
    const me = await gql('{ me { emailVerified } }', {}, user.token);
    expect(me.body.data.me.emailVerified).toBe(true);
  });

  test('El enlace es de un solo uso', async () => {
    const url = new URL(link);
    const res = await api().get(url.pathname + url.search);
    expect(res.status).toBe(400);
    expect(res.text).toContain('Enlace no válido');
  });

  test('sendVerificationEmail con el correo ya verificado -> CONFLICT', async () => {
    const res = await gql('mutation { sendVerificationEmail { ok } }', {}, user.token);
    expect(errorCode(res)).toBe('CONFLICT');
  });

  test('Reenviar y confirmar por GraphQL (verifyEmail); el enlace anterior queda invalidado', async () => {
    const other = await newUser('verifica.gql');
    const first = (await waitForMail(other.email, 'Confirma tu cuenta')).text.match(/token=(\S+)/)[1];
    const resend = await gql('mutation { sendVerificationEmail { ok message } }', {}, other.token);
    expect(resend.body.data.sendVerificationEmail.ok).toBe(true);
    const second = lastMailTo(other.email).text.match(/token=(\S+)/)[1];
    expect(second).not.toBe(first);

    const old = await gql('mutation($t: String!) { verifyEmail(token: $t) { id } }', { t: decodeURIComponent(first) }, null);
    expect(errorCode(old)).toBe('BAD_USER_INPUT');
    const res = await gql('mutation($t: String!) { verifyEmail(token: $t) { emailVerified } }', { t: decodeURIComponent(second) }, null);
    expect(res.body.data.verifyEmail.emailVerified).toBe(true);
  });
});

describe('Correo: recuperación y cambio de contraseña', () => {
  let user;

  beforeAll(async () => {
    user = await newUser('recupera');
  });

  test('requestPasswordReset responde igual exista o no el correo (no revela cuentas)', async () => {
    const q = 'mutation($e: String!) { requestPasswordReset(email: $e) { ok message } }';
    const exists = await gql(q, { e: user.email });
    const missing = await gql(q, { e: 'nadie.existe@test.com' });
    expect(exists.body.data).toEqual(missing.body.data);
    expect(lastMailTo('nadie.existe@test.com')).toBeUndefined();
    expect((await waitForMail(user.email, 'Código para restablecer tu contraseña')).text).toMatch(/\b\d{6}\b/);
  });

  test('Código incorrecto -> BAD_USER_INPUT; después de 5 intentos el código se bloquea', async () => {
    await gql('mutation($e: String!) { requestPasswordReset(email: $e) { ok } }', { e: user.email });
    const code = lastMailTo(user.email).text.match(/\b(\d{6})\b/)[1];
    const wrong = code === '000000' ? '111111' : '000000';
    const q = 'mutation($e: String!, $c: String!, $p: String!) { resetPassword(email: $e, code: $c, newPassword: $p) { ok } }';
    for (let i = 0; i < 5; i += 1) {
      expect(errorCode(await gql(q, { e: user.email, c: wrong, p: 'NuevaClave123' }))).toBe('BAD_USER_INPUT');
    }
    const blocked = await gql(q, { e: user.email, c: code, p: 'NuevaClave123' });
    expect(errorCode(blocked)).toBe('BAD_USER_INPUT');
  });

  test('resetPassword con el código correcto cambia la contraseña, cierra sesiones y avisa por correo', async () => {
    const session = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    const oldRefresh = session.body.data.refreshToken;

    await gql('mutation($e: String!) { requestPasswordReset(email: $e) { ok } }', { e: user.email });
    const code = lastMailTo(user.email).text.match(/\b(\d{6})\b/)[1];
    const res = await gql(
      'mutation($e: String!, $c: String!, $p: String!) { resetPassword(email: $e, code: $c, newPassword: $p) { ok } }',
      { e: user.email, c: code, p: 'NuevaClave123' }
    );
    expect(res.body.data.resetPassword.ok).toBe(true);
    await waitForMail(user.email, 'Tu contraseña cambió');
    expect(await login(user.email, 'NuevaClave123')).toBeDefined();

    const refresh = await gql('mutation($r: String!) { refreshToken(refreshToken: $r) { token } }', { r: oldRefresh });
    expect(errorCode(refresh)).toBe('UNAUTHENTICATED');
  });

  test('Cambiar la contraseña por REST también envía el aviso', async () => {
    const other = await newUser('cambia');
    const res = await api().put('/api/auth/password').set(bearer(other.token)).send({ currentPassword: other.password, newPassword: 'OtraClave456' });
    expect(res.status).toBe(200);
    expect((await waitForMail(other.email, 'Tu contraseña cambió')).html).toContain('Tu contraseña cambió');
  });
});

describe('Sesiones: refresh token y logout', () => {
  test('refreshToken entrega una sesión nueva y el refresh token anterior ya no sirve', async () => {
    const user = await newUser('refresh');
    const session = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    const q = 'mutation($r: String!) { refreshToken(refreshToken: $r) { token refreshToken user { email } } }';
    const renewed = await gql(q, { r: session.body.data.refreshToken });
    expect(renewed.body.data.refreshToken.user.email).toBe(user.email);
    expect(renewed.body.data.refreshToken.refreshToken).not.toBe(session.body.data.refreshToken);

    // Reutilizar un refresh token ya usado se toma como robo: se cierran todas las sesiones
    const reused = await gql(q, { r: session.body.data.refreshToken });
    expect(reused.body.errors[0].message).toMatch(/ya fue utilizado/);
    const afterTheft = await gql(q, { r: renewed.body.data.refreshToken.refreshToken });
    expect(errorCode(afterTheft)).toBe('UNAUTHENTICATED');
  });

  test('logout revoca el token de acceso en REST y en GraphQL', async () => {
    const user = await newUser('logout');
    const res = await gql('mutation { logout(allDevices: true) { ok } }', {}, user.token);
    expect(res.body.data.logout.ok).toBe(true);
    expect((await api().get('/api/auth/me').set(bearer(user.token))).status).toBe(401);
    expect(errorCode(await gql('{ me { id } }', {}, user.token))).toBe('UNAUTHENTICATED');
  });
});

describe('Correo: notificaciones informativas', () => {
  test('POST /api/notifications/email: usuario normal -> 403', async () => {
    const user = await newUser('noadmin.mail');
    const res = await api().post('/api/notifications/email').set(bearer(user.token)).send({ userId: user.user.id, subject: 'Hola', message: 'x' });
    expect(res.status).toBe(403);
  });

  test('POST /api/notifications/email: admin envía, con HTML escapado', async () => {
    const adminToken = await login('admin@gastos.app', 'Admin1234');
    const target = await newUser('destino.mail');
    const res = await api()
      .post('/api/notifications/email')
      .set(bearer(adminToken))
      .send({ userId: target.user.id, subject: 'Mantenimiento programado', message: 'El sábado <b>no</b> habrá servicio.' });
    expect(res.status).toBe(202);
    const mail = await waitForMail(target.email, 'Mantenimiento programado');
    expect(mail.html).toContain('&lt;b&gt;no&lt;/b&gt;');
  });

  test('POST /api/notifications/email: validación -> 400', async () => {
    const adminToken = await login('admin@gastos.app', 'Admin1234');
    const res = await api().post('/api/notifications/email').set(bearer(adminToken)).send({ userId: 'no-es-uuid', subject: '' });
    expect(res.status).toBe(400);
  });

  test('checkBudgetAlerts avisa al pasar el 80 % y no repite la misma alerta', async () => {
    const user = await newUser('alerta');
    const month = currentMonth();
    const accountId = (await api().post('/api/accounts').set(bearer(user.token)).send({ name: 'Efectivo', type: 'cash' })).body.data.id;
    await api().put(`/api/budgets/${month}`).set(bearer(user.token)).send({ amount: 1000 });
    await api().post('/api/expenses').set(bearer(user.token)).send({ amount: 850, date: `${month}-01`, accountId });

    const q = 'mutation { checkBudgetAlerts { type threshold percentUsed notified } }';
    const first = await gql(q, {}, user.token);
    expect(first.body.data.checkBudgetAlerts).toEqual([{ type: 'BUDGET', threshold: 80, percentUsed: 85, notified: true }]);
    expect((await waitForMail(user.email, 'Alerta de presupuesto')).text).toContain('85%');

    const second = await gql(q, {}, user.token);
    expect(second.body.data.checkBudgetAlerts[0].notified).toBe(false);
  });

  test('sendPaymentReminders avisa de gastos fijos por vencer una sola vez por mes', async () => {
    const user = await newUser('recordatorio');
    const day = new Date().getDate();
    await api().post('/api/fixed-expenses').set(bearer(user.token)).send({ name: 'Renta', amount: 8500, dayOfMonth: day });

    const q = 'mutation { sendPaymentReminders(daysAhead: 3) { name notified } }';
    const first = await gql(q, {}, user.token);
    expect(first.body.data.sendPaymentReminders).toEqual([{ name: 'Renta', notified: true }]);
    expect((await waitForMail(user.email, 'Recordatorio de pagos próximos')).text).toContain('Renta');
    const second = await gql(q, {}, user.token);
    expect(second.body.data.sendPaymentReminders[0].notified).toBe(false);
  });
});
