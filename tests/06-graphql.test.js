const { api, newUser, login, bearer, gql, gqlUpload, errorCode, closeConnections } = require('./helpers');
const { currentMonth, addMonths } = require('../src/utils/dates');

afterAll(closeConnections);

// Archivos mínimos válidos (solo importan los primeros bytes) y uno disfrazado
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.4\n%prueba\n');
const FAKE_PNG = Buffer.from('<script>alert(1)</script>');

const month = currentMonth();
const day = String(new Date().getDate()).padStart(2, '0');
const today = `${month}-${day}`;

let token;
let other;
let accountId;
let debitId;
let categoryId;
let contactId;
let expenseId;

beforeAll(async () => {
  ({ token } = await newUser('graphql'));
  other = await newUser('graphql.ajeno');
  const post = (path, body) => api().post(path).set(bearer(token)).send(body);
  accountId = (await post('/api/accounts', { name: 'Tarjeta Oro', type: 'credit', paymentDay: 10, creditLimit: 20000 })).body.data.id;
  debitId = (await post('/api/accounts', { name: 'Débito Nómina', type: 'debit' })).body.data.id;
  categoryId = (await post('/api/categories', { name: 'Comida' })).body.data.id;
  contactId = (await post('/api/contacts', { name: 'Laura Gómez' })).body.data.id;
  expenseId = (await post('/api/expenses', { amount: 900, date: today, description: 'Cena cumpleaños', accountId, categoryId })).body.data.id;
  await post('/api/expenses', { amount: 120, date: today, description: 'Cena rápida', accountId: debitId, categoryId });
});

describe('GraphQL: seguridad general', () => {
  test('Consulta pública ping -> pong', async () => {
    const res = await gql('{ ping }');
    expect(res.body.data.ping).toBe('pong');
  });

  test('Operación protegida sin token -> UNAUTHENTICATED', async () => {
    const res = await gql('{ me { id } }');
    expect(errorCode(res)).toBe('UNAUTHENTICATED');
  });

  test('Token con firma inválida -> UNAUTHENTICATED', async () => {
    const res = await gql('{ me { id } }', {}, 'eyJhbGciOiJIUzI1NiJ9.e30.firma');
    expect(errorCode(res)).toBe('UNAUTHENTICATED');
  });

  test('Consulta demasiado profunda es rechazada (graphql-armor)', async () => {
    const deep = `{ __type(name: "Query") { fields { type { ${'ofType { '.repeat(9)}name${' }'.repeat(9)} } } } }`;
    const res = await gql(deep, {}, token);
    expect(res.body.errors[0].message).toMatch(/depth/i);
  });

  test('Exceso de alias es rechazado (graphql-armor)', async () => {
    const aliases = Array.from({ length: 15 }, (_, i) => `p${i}: ping`).join(' ');
    const res = await gql(`{ ${aliases} }`);
    expect(res.body.errors[0].message).toMatch(/alias/i);
  });

  test('Validación de argumentos -> BAD_USER_INPUT con detalle por campo', async () => {
    const res = await gql('query($m: String) { dailySpending(month: $m) { month } }', { m: '2026-13' }, token);
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
    expect(res.body.errors[0].extensions.details[0].field).toBe('month');
  });

  test('Los errores internos no exponen la pila', async () => {
    const res = await gql('{ me { id } }', {}, token);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
  });

  test('Respuestas sin caché (Cache-Control: no-store)', async () => {
    const res = await gql('{ ping }');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GraphQL: cuentas (OP-023 a OP-025)', () => {
  test('reorderAccounts cambia el orden y REST lo respeta', async () => {
    const res = await gql('mutation($ids: [Int!]!) { reorderAccounts(ids: $ids) { id sortOrder } }', { ids: [debitId, accountId] }, token);
    expect(res.body.data.reorderAccounts.map((a) => a.id)).toEqual([debitId, accountId]);
    const rest = await api().get('/api/accounts').set(bearer(token));
    expect(rest.body.data[0].id).toBe(debitId);
  });

  test('reorderAccounts con cuenta ajena -> BAD_USER_INPUT', async () => {
    const res = await gql('mutation($ids: [Int!]!) { reorderAccounts(ids: $ids) { id } }', { ids: [accountId] }, other.token);
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });

  test('creditCardStatement calcula saldo, pago mínimo y fecha límite', async () => {
    const res = await gql(
      'query($id: Int!) { creditCardStatement(accountId: $id) { balance expenseCount minimumPayment availableCredit dueDate utilization } }',
      { id: accountId },
      token
    );
    expect(res.body.data.creditCardStatement).toMatchObject({ balance: 900, expenseCount: 1, minimumPayment: 250, availableCredit: 19100, utilization: 4.5 });
    expect(res.body.data.creditCardStatement.dueDate).toBe(`${addMonths(month, 1)}-10`);
  });

  test('creditCardStatement de una cuenta de débito -> BAD_USER_INPUT', async () => {
    const res = await gql('query($id: Int!) { creditCardStatement(accountId: $id) { balance } }', { id: debitId }, token);
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });

  test('uploadAccountImage guarda la imagen y devuelve una URL firmada', async () => {
    const res = await gqlUpload(
      'mutation($id: Int!, $file: File!) { uploadAccountImage(accountId: $id, file: $file) { id imageUrl } }',
      { id: accountId, file: null },
      'variables.file',
      PNG,
      'tarjeta.png',
      token
    );
    const url = res.body.data.uploadAccountImage.imageUrl;
    expect(url).toMatch(/\/api\/files\?path=.+&expires=\d+&sig=/);
    const download = await api().get(new URL(url).pathname + new URL(url).search);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
  });

  test('URL de archivo con firma alterada -> 403', async () => {
    const download = await api().get('/api/files?path=00000000-0000-4000-8000-000000000000/accounts/00000000-0000-4000-8000-000000000000.png&expires=9999999999&sig=falsa');
    expect(download.status).toBe(403);
  });

  test('uploadAccountImage rechaza un archivo que no es imagen aunque se llame .png', async () => {
    const res = await gqlUpload(
      'mutation($id: Int!, $file: File!) { uploadAccountImage(accountId: $id, file: $file) { id } }',
      { id: accountId, file: null },
      'variables.file',
      FAKE_PNG,
      'foto.png',
      token
    );
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });
});

describe('GraphQL: categorías y contactos (OP-031 a OP-033, OP-039)', () => {
  test('createDefaultCategories crea solo las que faltan', async () => {
    const res = await gql('mutation { createDefaultCategories { name } }', {}, token);
    const names = res.body.data.createDefaultCategories.map((c) => c.name);
    expect(names).toContain('Transporte');
    expect(names).not.toContain('Comida');
    const again = await gql('mutation { createDefaultCategories { name } }', {}, token);
    expect(again.body.data.createDefaultCategories).toEqual([]);
  });

  test('setCategoryLimit define el límite y muestra lo gastado en el mes', async () => {
    const res = await gql(
      'mutation($id: Int!) { setCategoryLimit(categoryId: $id, monthlyLimit: 1000) { monthlyLimit spentThisMonth } }',
      { id: categoryId },
      token
    );
    expect(res.body.data.setCategoryLimit).toEqual({ monthlyLimit: 1000, spentThisMonth: 1020 });
  });

  test('mergeCategories mueve los gastos y elimina la categoría origen', async () => {
    const source = (await api().post('/api/categories').set(bearer(token)).send({ name: 'Antojos' })).body.data.id;
    await api().post('/api/expenses').set(bearer(token)).send({ amount: 50, date: today, accountId: debitId, categoryId: source });
    const res = await gql(
      'mutation($s: Int!, $t: Int!) { mergeCategories(sourceId: $s, targetId: $t) { movedExpenses target { id } } }',
      { s: source, t: categoryId },
      token
    );
    expect(res.body.data.mergeCategories).toEqual({ movedExpenses: 1, target: { id: categoryId } });
    expect((await api().get(`/api/categories/${source}`).set(bearer(token))).status).toBe(404);
  });

  test('mergeCategories con la misma categoría -> BAD_USER_INPUT', async () => {
    const res = await gql('mutation($s: Int!) { mergeCategories(sourceId: $s, targetId: $s) { movedExpenses } }', { s: categoryId }, token);
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });

  test('mergeContacts pasa los registros de patrimonio al contacto destino', async () => {
    const dup = (await api().post('/api/contacts').set(bearer(token)).send({ name: 'Lau G.' })).body.data.id;
    await api().post('/api/net-worth').set(bearer(token)).send({ label: 'Préstamo', kind: 'asset', amount: 300, contactId: dup });
    const res = await gql(
      'mutation($s: Int!, $t: Int!) { mergeContacts(sourceId: $s, targetId: $t) { movedNetWorthEntries target { name } } }',
      { s: dup, t: contactId },
      token
    );
    expect(res.body.data.mergeContacts).toEqual({ movedNetWorthEntries: 1, target: { name: 'Laura Gómez' } });
  });
});

describe('GraphQL: gastos (OP-048 a OP-052)', () => {
  test('expenseSuggestions sugiere por frecuencia con cuenta y categoría', async () => {
    const res = await gql('{ expenseSuggestions(prefix: "cena") { description timesUsed categoryId } }', {}, token);
    expect(res.body.data.expenseSuggestions.map((s) => s.description)).toEqual(expect.arrayContaining(['Cena cumpleaños', 'Cena rápida']));
    expect(res.body.data.expenseSuggestions[0].categoryId).toBe(categoryId);
  });

  test('expenseSuggestions trata los comodines como texto literal', async () => {
    const res = await gql('{ expenseSuggestions(prefix: "%") { description } }', {}, token);
    expect(res.body.data.expenseSuggestions).toEqual([]);
  });

  test('importExpensesCsv importa filas válidas (encabezados en español)', async () => {
    const csv = `fecha,monto,descripcion,cuenta,categoria\n${today},80.5,Taxi,Débito Nómina,Transporte\n${today},35,"Café, galleta",tarjeta oro,`;
    const res = await gql('mutation($csv: String) { importExpensesCsv(csv: $csv) { imported totalAmount errors { line message } } }', { csv }, token);
    expect(res.body.data.importExpensesCsv).toEqual({ imported: 2, totalAmount: 115.5, errors: [] });
  });

  test('importExpensesCsv es todo o nada y reporta la línea con error', async () => {
    const csv = `fecha,monto,cuenta\n${today},10,Débito Nómina\n2026-02-30,-5,Inexistente`;
    const res = await gql('mutation($csv: String) { importExpensesCsv(csv: $csv) { imported errors { line } } }', { csv }, token);
    expect(res.body.data.importExpensesCsv).toEqual({ imported: 0, errors: [{ line: 3 }] });
  });

  test('importExpensesCsv también acepta el archivo por multipart', async () => {
    const csv = Buffer.from(`date,amount,account\n${today},12,Débito Nómina\n`);
    const res = await gqlUpload('mutation($file: File) { importExpensesCsv(file: $file) { imported } }', { file: null }, 'variables.file', csv, 'gastos.csv', token);
    expect(res.body.data.importExpensesCsv.imported).toBe(1);
  });

  test('exportExpensesCsv genera CSV protegido contra inyección de fórmulas', async () => {
    await api().post('/api/expenses').set(bearer(token)).send({ amount: 5, date: today, description: '=HYPERLINK("http://malo")', accountId: debitId });
    const res = await gql('query($f: String!, $t: String!) { exportExpensesCsv(from: $f, to: $t) { filename rows content } }', { f: today, t: today }, token);
    const { content, rows, filename } = res.body.data.exportExpensesCsv;
    expect(filename).toBe(`gastos_${today}_${today}.csv`);
    expect(rows).toBeGreaterThanOrEqual(5);
    expect(content).toContain('fecha,monto,descripcion,cuenta,categoria');
    expect(content).toContain(`"'=HYPERLINK(""http://malo"")"`);
  });

  test('attachReceipt adjunta un PDF y devuelve su URL', async () => {
    const res = await gqlUpload(
      'mutation($id: Int!, $file: File!) { attachReceipt(expenseId: $id, file: $file) { id receiptUrl } }',
      { id: expenseId, file: null },
      'variables.file',
      PDF,
      'ticket.pdf',
      token
    );
    expect(res.body.data.attachReceipt.receiptUrl).toMatch(/\.pdf&expires=/);
  });

  test('attachReceipt sobre un gasto ajeno -> NOT_FOUND', async () => {
    const res = await gqlUpload(
      'mutation($id: Int!, $file: File!) { attachReceipt(expenseId: $id, file: $file) { id } }',
      { id: expenseId, file: null },
      'variables.file',
      PDF,
      'ticket.pdf',
      other.token
    );
    expect(errorCode(res)).toBe('NOT_FOUND');
  });

  test('splitExpense crea la división y el registro de patrimonio "te debe"', async () => {
    const res = await gql(
      'mutation($id: Int!, $parts: [SplitPartInput!]!) { splitExpense(expenseId: $id, parts: $parts) { yourShare splits { contactName amount netWorthEntryId } expense { splits { id } } } }',
      { id: expenseId, parts: [{ contactId, amount: 450 }] },
      token
    );
    const { yourShare, splits, expense } = res.body.data.splitExpense;
    expect(yourShare).toBe(450);
    expect(splits[0]).toMatchObject({ contactName: 'Laura Gómez', amount: 450 });
    expect(expense.splits).toHaveLength(1);
    const entry = await api().get(`/api/net-worth/${splits[0].netWorthEntryId}`).set(bearer(token));
    expect(entry.body.data).toMatchObject({ kind: 'asset', amount: 450, contactId });
  });

  test('splitExpense dos veces -> CONFLICT; partes mayores al gasto -> BAD_USER_INPUT', async () => {
    const again = await gql('mutation($id: Int!) { splitExpense(expenseId: $id, parts: [{ contactId: ' + contactId + ', amount: 1 }]) { yourShare } }', { id: expenseId }, token);
    expect(errorCode(again)).toBe('CONFLICT');
    const other2 = (await api().post('/api/expenses').set(bearer(token)).send({ amount: 100, date: today, accountId: debitId })).body.data.id;
    const tooMuch = await gql('mutation($id: Int!) { splitExpense(expenseId: $id, parts: [{ contactId: ' + contactId + ', amount: 150 }]) { yourShare } }', { id: other2 }, token);
    expect(errorCode(tooMuch)).toBe('BAD_USER_INPUT');
  });
});

describe('GraphQL: gastos fijos, patrimonio y reportes (OP-065, OP-073 a OP-077, OP-080, OP-081)', () => {
  let fixedId;

  test('fixedExpenseToExpense registra el gasto y marca el mes como pagado', async () => {
    fixedId = (await api().post('/api/fixed-expenses').set(bearer(token)).send({ name: 'Internet', amount: 599, dayOfMonth: Number(day), categoryId })).body.data.id;
    const res = await gql(
      'mutation($f: Int!, $m: String!, $a: Int!) { fixedExpenseToExpense(fixedExpenseId: $f, month: $m, accountId: $a) { expense { amount description categoryId date } payment { month expenseId } } }',
      { f: fixedId, m: month, a: debitId },
      token
    );
    const { expense, payment } = res.body.data.fixedExpenseToExpense;
    expect(expense).toMatchObject({ amount: 599, description: 'Internet', categoryId, date: today });
    expect(payment.month).toBe(month);
    const list = await api().get(`/api/fixed-expenses?month=${month}`).set(bearer(token));
    expect(list.body.data.find((f) => f.id === fixedId).paid).toBe(true);
  });

  test('fixedExpenseToExpense dos veces el mismo mes -> CONFLICT', async () => {
    const res = await gql(
      'mutation($f: Int!, $m: String!, $a: Int!) { fixedExpenseToExpense(fixedExpenseId: $f, month: $m, accountId: $a) { payment { id } } }',
      { f: fixedId, m: month, a: debitId },
      token
    );
    expect(errorCode(res)).toBe('CONFLICT');
  });

  test('reorderNetWorth y syncNetWorthWithAccount con la tarjeta de crédito', async () => {
    const debt = (await api().post('/api/net-worth').set(bearer(token)).send({ label: 'Saldo Tarjeta Oro', kind: 'debt', amount: 1, accountId })).body.data.id;
    const sync = await gql('mutation($id: Int!) { syncNetWorthWithAccount(entryId: $id) { previousAmount month entry { amount } } }', { id: debt }, token);
    expect(sync.body.data.syncNetWorthWithAccount).toMatchObject({ previousAmount: 1, month });
    expect(sync.body.data.syncNetWorthWithAccount.entry.amount).toBeGreaterThanOrEqual(900);

    const ids = (await api().get('/api/net-worth').set(bearer(token))).body.data.map((e) => e.id).reverse();
    const res = await gql('mutation($ids: [Int!]!) { reorderNetWorth(ids: $ids) { id sortOrder } }', { ids }, token);
    // La lista agrupa activos y deudas; dentro de cada grupo respeta el orden. Cada id toma su posición.
    const order = Object.fromEntries(res.body.data.reorderNetWorth.map((e) => [e.id, e.sortOrder]));
    expect(ids.map((id) => order[id])).toEqual(ids.map((_, i) => i));
  });

  test('Proyecciones: crear (interés compuesto), listar y eliminar', async () => {
    const created = await gql(
      'mutation { createProjection(name: "Ahorro", startingAmount: 1000, monthlyContribution: 100, annualRate: 12, months: 12) { id finalAmount totalContributed interestEarned schedule(step: 6) { month balance } } }',
      {},
      token
    );
    const p = created.body.data.createProjection;
    expect(p).toMatchObject({ finalAmount: 2395.08, totalContributed: 2200, interestEarned: 195.08 });
    expect(p.schedule.map((s) => s.month)).toEqual([6, 12]);
    const list = await gql('{ projections { id } }', {}, token);
    expect(list.body.data.projections.map((x) => x.id)).toContain(p.id);
    const del = await gql(`mutation { deleteProjection(id: ${p.id}) { ok } }`, {}, token);
    expect(del.body.data.deleteProjection.ok).toBe(true);
    const again = await gql(`mutation { deleteProjection(id: ${p.id}) { ok } }`, {}, token);
    expect(errorCode(again)).toBe('NOT_FOUND');
  });

  test('createProjection con tasa mayor a 100 % -> BAD_USER_INPUT', async () => {
    const res = await gql('mutation { createProjection(name: "X", monthlyContribution: 1, annualRate: 150, months: 12) { id } }', {}, token);
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });

  test('dailySpending devuelve todos los días del mes con acumulado', async () => {
    const res = await gql('{ dailySpending { month total days { date total cumulative } } }', {}, token);
    const { days, total } = res.body.data.dailySpending;
    expect(days[days.length - 1].cumulative).toBe(total);
    expect(days.find((d) => d.date === today).total).toBeGreaterThan(0);
  });

  test('categoryComparison compara el mes anterior contra el actual', async () => {
    const res = await gql('{ categoryComparison { monthA monthB totalB categories { categoryName totalA totalB } } }', {}, token);
    const data = res.body.data.categoryComparison;
    expect(data).toMatchObject({ monthA: addMonths(month, -1), monthB: month });
    expect(data.categories.find((c) => c.categoryName === 'Comida').totalA).toBe(0);
  });
});

describe('GraphQL: notificaciones y automatización (OP-082 a OP-087)', () => {
  test('registerDevice registra y actualiza sin duplicar; devices lo lista', async () => {
    const q = 'mutation($t: String!, $p: String!) { registerDevice(token: $t, platform: $p) { id platform } }';
    const first = await gql(q, { t: 'fcm-token-1234567890', p: 'android' }, token);
    const second = await gql(q, { t: 'fcm-token-1234567890', p: 'ios' }, token);
    expect(second.body.data.registerDevice.id).toBe(first.body.data.registerDevice.id);
    const list = await gql('{ devices { platform } }', {}, token);
    expect(list.body.data.devices).toEqual([{ platform: 'ios' }]);
  });

  test('sendDailySummary requiere rol admin', async () => {
    const res = await gql('mutation { sendDailySummary { sent } }', {}, token);
    expect(errorCode(res)).toBe('FORBIDDEN');
  });

  test('Token de API: crear, usar en webhookExpense con mapeo de tarjeta y revocar', async () => {
    const created = await gql('mutation { createApiToken(name: "Atajos iPhone") { token apiToken { id name } } }', {}, token);
    const { token: apiKey, apiToken } = created.body.data.createApiToken;
    expect(apiKey).toMatch(/^fin_/);

    const mapping = await gql('mutation($a: Int!) { createCardNameMapping(cardName: "ORO **1234", accountId: $a) { cardName account { id } } }', { a: accountId }, token);
    expect(mapping.body.data.createCardNameMapping.account.id).toBe(accountId);

    const hook = await gql(
      'mutation { webhookExpense(amount: 42.5, card: "oro **1234", description: "Oxxo", category: "comida") { amount accountName categoryId date } }',
      {},
      null,
      { 'X-API-Key': apiKey }
    );
    expect(hook.body.data.webhookExpense).toMatchObject({ amount: 42.5, accountName: 'Tarjeta Oro', categoryId });

    const tokens = await gql('{ apiTokens { id lastUsedAt } }', {}, token);
    expect(tokens.body.data.apiTokens[0].lastUsedAt).not.toBeNull();

    await gql(`mutation { revokeApiToken(id: ${apiToken.id}) { revokedAt } }`, {}, token);
    const denied = await gql('mutation { webhookExpense(amount: 1, card: "oro **1234") { id } }', {}, null, { 'X-API-Key': apiKey });
    expect(errorCode(denied)).toBe('UNAUTHENTICATED');
  });

  test('webhookExpense sin X-API-Key (aunque tenga Bearer) -> UNAUTHENTICATED', async () => {
    const res = await gql('mutation { webhookExpense(amount: 1, card: "Tarjeta Oro") { id } }', {}, token);
    expect(errorCode(res)).toBe('UNAUTHENTICATED');
  });

  test('webhookExpense con tarjeta desconocida -> BAD_USER_INPUT', async () => {
    const { token: apiKey } = (await gql('mutation { createApiToken(name: "Script") { token } }', {}, token)).body.data.createApiToken;
    const res = await gql('mutation { webhookExpense(amount: 1, card: "Amex Platino") { id } }', {}, null, { 'X-API-Key': apiKey });
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });
});

describe('GraphQL: admin', () => {
  test('sendDailySummary como admin responde el resumen del envío', async () => {
    const adminToken = await login('admin@gastos.app', 'Admin1234');
    const res = await gql('mutation { sendDailySummary { date sent skipped } }', {}, adminToken);
    expect(res.body.data.sendDailySummary.sent).toBeGreaterThanOrEqual(0);
  });
});
