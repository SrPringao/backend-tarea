// Genera docs/Documentacion_Inventario_Operaciones.xlsx a partir del inventario (src/docs/inventory.js)
// y de los resultados reales de Jest (docs/resultados-pruebas.json, creado con npm run test:report).
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { modules, operations } = require('../src/docs/inventory');

const OUT = path.join(__dirname, '../docs/Documentacion_Inventario_Operaciones.xlsx');
const RESULTS = path.join(__dirname, '../docs/resultados-pruebas.json');

const COLORS = {
  header: 'FF1F3864',
  implemented: 'FFE2EFDA',
  stage2: 'FFDDEBF7',
  future: 'FFFFF2CC',
  passed: 'FFE2EFDA',
  failed: 'FFF8CBAD',
};

const CRUD_LABEL = { C: 'Crear', R: 'Leer', U: 'Actualizar', D: 'Eliminar', L: 'Listar', Otro: 'Otro' };

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 30;
}

function fill(row, argb) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  });
}

function borders(sheet) {
  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true };
    });
  });
}

const STATUS = { 1: 'Implementada (etapa 1)', 2: 'Implementada (etapa 2)' };
const FUTURE = 'Versión futura';

function inventorySheet(wb) {
  const sheet = wb.addWorksheet('Inventario', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'ID', key: 'id', width: 9 },
    { header: 'Módulo', key: 'module', width: 24 },
    { header: 'Operación', key: 'name', width: 38 },
    { header: 'Tipo', key: 'crud', width: 11 },
    { header: 'API', key: 'api', width: 10 },
    { header: 'Método', key: 'method', width: 10 },
    { header: 'Endpoint / operación GraphQL', key: 'endpoint', width: 44 },
    { header: 'Acceso a datos', key: 'data', width: 16 },
    { header: 'Seguridad', key: 'access', width: 18 },
    { header: 'Prioridad', key: 'priority', width: 10 },
    { header: 'Etapa', key: 'stage', width: 8 },
    { header: 'Estado', key: 'status', width: 22 },
    { header: 'Descripción', key: 'description', width: 64 },
  ];
  styleHeader(sheet.getRow(1));

  for (const op of operations) {
    const graphql = op.implemented && op.api === 'GraphQL';
    const row = sheet.addRow({
      ...op,
      crud: CRUD_LABEL[op.crud],
      api: op.implemented ? op.api : 'Por definir',
      method: graphql ? 'POST' : op.method,
      endpoint: graphql ? `/graphql · ${op.graphql}` : op.path,
      data: op.implemented ? op.data : 'Por definir',
      stage: op.implemented ? op.stage : '',
      status: op.implemented ? STATUS[op.stage] : FUTURE,
      description: op.description || '',
    });
    fill(row, !op.implemented ? COLORS.future : op.stage === 2 ? COLORS.stage2 : COLORS.implemented);
  }
  sheet.autoFilter = { from: 'A1', to: 'M1' };
  borders(sheet);
  return sheet;
}

// Totales con fórmulas de Excel (se recalculan si el profesor cambia el estado de alguna fila)
function summarySheet(wb) {
  const sheet = wb.addWorksheet('Resumen');
  sheet.columns = [
    { header: 'Módulo', key: 'module', width: 30 },
    { header: 'Total operaciones', key: 'total', width: 14 },
    { header: 'Etapa 1 (REST)', key: 'stage1', width: 14 },
    { header: 'Etapa 2 (GraphQL)', key: 'gql', width: 16 },
    { header: 'Etapa 2 (REST correo y archivos)', key: 'rest2', width: 18 },
    { header: 'Versión futura', key: 'future', width: 14 },
    { header: 'Sequelize ORM', key: 'orm', width: 14 },
    { header: 'SQL nativo', key: 'sql', width: 12 },
    { header: '% implementado', key: 'pct', width: 14 },
  ];
  styleHeader(sheet.getRow(1));

  const inv = 'Inventario!';
  const by = (r, extra) => `COUNTIFS(${inv}$B:$B,A${r},${extra})`;
  modules.forEach((mod, i) => {
    const r = i + 2;
    sheet.addRow({
      module: mod.name,
      total: { formula: `COUNTIF(${inv}$B:$B,A${r})` },
      stage1: { formula: by(r, `${inv}$L:$L,"${STATUS[1]}"`) },
      gql: { formula: by(r, `${inv}$L:$L,"${STATUS[2]}",${inv}$E:$E,"GraphQL"`) },
      rest2: { formula: by(r, `${inv}$L:$L,"${STATUS[2]}",${inv}$E:$E,"REST"`) },
      future: { formula: by(r, `${inv}$L:$L,"${FUTURE}"`) },
      orm: { formula: by(r, `${inv}$H:$H,"Sequelize ORM"`) },
      sql: { formula: by(r, `${inv}$H:$H,"SQL nativo"`) },
      pct: { formula: `IF(B${r}=0,0,(C${r}+D${r}+E${r})/B${r})` },
    });
  });

  const last = modules.length + 1;
  const sum = (col) => ({ formula: `SUM(${col}2:${col}${last})` });
  const total = sheet.addRow({
    module: 'TOTAL',
    total: sum('B'),
    stage1: sum('C'),
    gql: sum('D'),
    rest2: sum('E'),
    future: sum('F'),
    orm: sum('G'),
    sql: sum('H'),
    pct: { formula: `IF(B${last + 1}=0,0,(C${last + 1}+D${last + 1}+E${last + 1})/B${last + 1})` },
  });
  total.font = { bold: true };
  fill(total, 'FFD9E1F2');
  sheet.getColumn('pct').numFmt = '0.0%';
  borders(sheet);

  const original = operations.filter((o) => Number(o.id.slice(3)) <= 87);
  const remaining = original.filter((o) => o.stage === 2 || !o.implemented);
  sheet.addRow([]);
  const notes = [
    `Etapa 1: ${original.filter((o) => o.stage === 1 && o.implemented).length} de 87 operaciones (60.9 %) en REST, divididas entre Sequelize ORM y SQL nativo.`,
    `Etapa 2: del 40 % restante (${remaining.length} operaciones, OP-001 a OP-087) se implementaron ${remaining.filter((o) => o.implemented).length} en GraphQL; el login con Google/Apple (OP-011) queda documentado para la etapa de Flutter.`,
    'Etapa 2 también agrega 3 operaciones REST del servicio de correo y archivos (OP-088 a OP-090): enlace de confirmación de cuenta, notificación informativa (admin) y descarga firmada.',
    'Correos: confirmación de cuenta al registrarse, código de recuperación, aviso de contraseña cambiada, alertas de presupuesto, recordatorios de pago y resumen diario.',
    'Sequelize ORM: Auth, Usuarios, Cuentas, Categorías, Contactos, Preferencias, Notificaciones, Automatización. SQL nativo (pg): Gastos, Presupuestos, Gastos fijos, Patrimonio, Reportes.',
  ];
  notes.forEach((n) => sheet.addRow([n]));
}

function testsSheet(wb) {
  const sheet = wb.addWorksheet('Escenario de pruebas', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'ID', key: 'id', width: 9 },
    { header: 'Archivo', key: 'file', width: 28 },
    { header: 'Módulo', key: 'module', width: 22 },
    { header: 'Caso de prueba', key: 'name', width: 62 },
    { header: 'Resultado esperado', key: 'expected', width: 36 },
    { header: 'Resultado obtenido', key: 'status', width: 18 },
    { header: 'Duración (ms)', key: 'ms', width: 14 },
  ];
  styleHeader(sheet.getRow(1));

  if (!fs.existsSync(RESULTS)) {
    sheet.addRow({ name: 'Ejecuta "npm run test:report" para llenar esta hoja con los resultados reales de Jest.' });
    return;
  }

  const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  let n = 0;
  const files = [...report.testResults].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of files) {
    for (const t of file.assertionResults) {
      n += 1;
      const [caseName, expected = ''] = t.title.split(' -> ');
      const passed = t.status === 'passed';
      const row = sheet.addRow({
        id: `CP-${String(n).padStart(3, '0')}`,
        file: path.basename(file.name),
        module: t.ancestorTitles.join(' / '),
        name: caseName,
        expected,
        status: passed ? 'Pasó' : 'Falló',
        ms: t.duration ?? '',
      });
      row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: passed ? COLORS.passed : COLORS.failed } };
    }
  }
  borders(sheet);

  sheet.addRow([]);
  sheet.addRow(['', '', '', `Total: ${report.numTotalTests} casos | Pasaron: ${report.numPassedTests} | Fallaron: ${report.numFailedTests}`]);
  sheet.addRow(['', '', '', `Ejecución: ${new Date(report.startTime).toLocaleString('es-MX')} | Herramientas: Jest + Supertest sobre base de datos de pruebas`]);
}

function dataModelSheet(wb) {
  const sheet = wb.addWorksheet('Modelo de datos');
  sheet.columns = [
    { header: 'Tabla', key: 'table', width: 26 },
    { header: 'Descripción', key: 'description', width: 50 },
    { header: 'Relaciones', key: 'relations', width: 56 },
    { header: 'Acceso', key: 'access', width: 16 },
  ];
  styleHeader(sheet.getRow(1));
  [
    ['users', 'Usuarios, rol (user/admin) y estado', '1:N con todas las tablas del usuario (ON DELETE CASCADE)', 'Sequelize ORM'],
    ['user_preferences', 'Tema, moneda, presupuesto por defecto', '1:1 users', 'Sequelize ORM'],
    ['accounts', 'Tarjetas de crédito, débito y efectivo', 'N:1 users; 1:N expenses (RESTRICT)', 'Sequelize ORM'],
    ['categories', 'Categorías de gasto, nombre único por usuario', 'N:1 users; 1:N expenses (SET NULL)', 'Sequelize ORM'],
    ['contacts', 'Personas que deben dinero al usuario', 'N:1 users; 1:N net_worth_entries (SET NULL)', 'Sequelize ORM'],
    ['expenses', 'Gastos variables', 'N:1 users, accounts, categories', 'SQL nativo'],
    ['monthly_budgets', 'Presupuesto por mes (único por usuario y mes)', 'N:1 users', 'SQL nativo'],
    ['fixed_expenses', 'Gastos recurrentes (renta, servicios)', 'N:1 users, categories; 1:N fixed_expense_payments', 'SQL nativo'],
    ['fixed_expense_payments', 'Pago mensual de cada gasto fijo (único por mes)', 'N:1 fixed_expenses (CASCADE)', 'SQL nativo'],
    ['net_worth_entries', 'Activos y deudas del patrimonio', 'N:1 users, accounts, contacts', 'SQL nativo'],
    ['auth_tokens (etapa 2)', 'Tokens de un solo uso: verificación de correo, código de recuperación y refresh (solo el hash SHA-256)', 'N:1 users (CASCADE)', 'Sequelize ORM'],
    ['revoked_tokens (etapa 2)', 'JWT revocados al cerrar sesión (jti)', 'N:1 users (CASCADE)', 'Sequelize ORM'],
    ['expense_splits (etapa 2)', 'Parte de un gasto que paga un contacto', 'N:1 expenses, contacts; 1:1 net_worth_entries (SET NULL)', 'SQL nativo'],
    ['net_worth_projections (etapa 2)', 'Simulador de patrimonio con interés compuesto', 'N:1 users', 'SQL nativo'],
    ['devices (etapa 2)', 'Tokens de FCM para notificaciones push', 'N:1 users (único por usuario y token)', 'Sequelize ORM'],
    ['api_tokens (etapa 2)', 'Tokens de API personales (solo el hash)', 'N:1 users', 'Sequelize ORM'],
    ['card_name_mappings (etapa 2)', 'Nombre de tarjeta externo -> cuenta', 'N:1 users, accounts', 'Sequelize ORM'],
    ['notification_log (etapa 2)', 'Notificaciones enviadas; evita duplicar alertas', 'N:1 users (único por tipo y referencia)', 'SQL nativo / ORM'],
    ['Columnas nuevas (etapa 2)', 'users.email_verified_at, accounts.sort_order e image_path, categories.monthly_limit, expenses.receipt_path, fixed_expense_payments.expense_id', 'Row Level Security activado en todas las tablas', '—'],
  ].forEach((r) => sheet.addRow(r));
  borders(sheet);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Equipo backend';
  wb.created = new Date();
  inventorySheet(wb);
  summarySheet(wb);
  testsSheet(wb);
  dataModelSheet(wb);
  await wb.xlsx.writeFile(OUT);

  const done = operations.filter((o) => o.implemented);
  console.log(`Excel generado: ${OUT}`);
  console.log(
    `  ${operations.length} operaciones, ${done.length} implementadas: ${done.filter((o) => o.stage === 1).length} etapa 1 (REST), ` +
      `${done.filter((o) => o.api === 'GraphQL').length} GraphQL, ${done.filter((o) => o.stage === 2 && o.api === 'REST').length} REST de etapa 2`
  );
}

main();
