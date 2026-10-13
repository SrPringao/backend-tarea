// Genera docs/Inventario_Operaciones.xlsx a partir del inventario (src/docs/inventory.js)
// y de los resultados reales de Jest (docs/resultados-pruebas.json, creado con npm run test:report).
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { modules, operations } = require('../src/docs/inventory');

const OUT = path.join(__dirname, '../docs/Inventario_Operaciones.xlsx');
const RESULTS = path.join(__dirname, '../docs/resultados-pruebas.json');

const COLORS = {
  header: 'FF1F3864',
  implemented: 'FFE2EFDA',
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

function inventorySheet(wb) {
  const sheet = wb.addWorksheet('Inventario', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'ID', key: 'id', width: 9 },
    { header: 'Módulo', key: 'module', width: 24 },
    { header: 'Operación', key: 'name', width: 38 },
    { header: 'Tipo', key: 'crud', width: 11 },
    { header: 'Método', key: 'method', width: 9 },
    { header: 'Endpoint', key: 'path', width: 40 },
    { header: 'Acceso a datos', key: 'data', width: 16 },
    { header: 'Seguridad', key: 'access', width: 16 },
    { header: 'Prioridad', key: 'priority', width: 10 },
    { header: 'Estado', key: 'status', width: 18 },
    { header: 'Descripción', key: 'description', width: 60 },
  ];
  styleHeader(sheet.getRow(1));

  for (const op of operations) {
    const row = sheet.addRow({
      ...op,
      crud: CRUD_LABEL[op.crud],
      data: op.implemented ? op.data : 'Por definir',
      status: op.implemented ? 'Implementada (v1)' : 'Versión futura',
      description: op.description || '',
    });
    fill(row, op.implemented ? COLORS.implemented : COLORS.future);
  }
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  borders(sheet);
  return sheet;
}

// Totales con fórmulas de Excel (se recalculan si el profesor cambia el estado de alguna fila)
function summarySheet(wb) {
  const sheet = wb.addWorksheet('Resumen');
  sheet.columns = [
    { header: 'Módulo', key: 'module', width: 30 },
    { header: 'Total operaciones', key: 'total', width: 18 },
    { header: 'Implementadas (v1)', key: 'done', width: 18 },
    { header: 'Versión futura', key: 'future', width: 16 },
    { header: 'Sequelize ORM', key: 'orm', width: 16 },
    { header: 'SQL nativo', key: 'sql', width: 14 },
    { header: '% implementado', key: 'pct', width: 16 },
  ];
  styleHeader(sheet.getRow(1));

  const inv = 'Inventario!';
  modules.forEach((mod, i) => {
    const r = i + 2;
    sheet.addRow({
      module: mod.name,
      total: { formula: `COUNTIF(${inv}$B:$B,A${r})` },
      done: { formula: `COUNTIFS(${inv}$B:$B,A${r},${inv}$J:$J,"Implementada (v1)")` },
      future: { formula: `COUNTIFS(${inv}$B:$B,A${r},${inv}$J:$J,"Versión futura")` },
      orm: { formula: `COUNTIFS(${inv}$B:$B,A${r},${inv}$G:$G,"Sequelize ORM")` },
      sql: { formula: `COUNTIFS(${inv}$B:$B,A${r},${inv}$G:$G,"SQL nativo")` },
      pct: { formula: `IF(B${r}=0,0,C${r}/B${r})` },
    });
  });

  const last = modules.length + 1;
  const total = sheet.addRow({
    module: 'TOTAL',
    total: { formula: `SUM(B2:B${last})` },
    done: { formula: `SUM(C2:C${last})` },
    future: { formula: `SUM(D2:D${last})` },
    orm: { formula: `SUM(E2:E${last})` },
    sql: { formula: `SUM(F2:F${last})` },
    pct: { formula: `IF(B${last + 1}=0,0,C${last + 1}/B${last + 1})` },
  });
  total.font = { bold: true };
  fill(total, 'FFD9E1F2');
  sheet.getColumn('pct').numFmt = '0.0%';
  borders(sheet);

  sheet.addRow([]);
  const notes = [
    'Criterio de selección: se implementaron las operaciones críticas y de prioridad alta que forman el flujo base de la app',
    '(autenticación, catálogos, registro y consulta de gastos, presupuestos, gastos fijos, patrimonio y reportes).',
    'Las operaciones de "Versión futura" son mejoras, integraciones (push, S3, OAuth) o automatizaciones que no bloquean el uso básico.',
    'Sequelize ORM: Auth, Usuarios, Cuentas, Categorías, Contactos, Preferencias. SQL nativo (pg): Gastos, Presupuestos, Gastos fijos, Patrimonio, Reportes.',
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

  const done = operations.filter((o) => o.implemented).length;
  console.log(`Excel generado: ${OUT}`);
  console.log(`  ${operations.length} operaciones, ${done} implementadas (${((done * 100) / operations.length).toFixed(1)} %)`);
}

main();
