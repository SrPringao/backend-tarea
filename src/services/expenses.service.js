// Gastos (SQL nativo): sugerencias (OP-048), importar CSV (OP-049), exportar CSV (OP-050),
// comprobante (OP-051) y dividir un gasto entre contactos (OP-052)
const { parse } = require('csv-parse/sync');
const ApiError = require('../utils/ApiError');
const storage = require('./storage');
const { normalizeKey } = require('../utils/text');
const { withTransaction, query } = require('../config/database');
const Expense = require('../models/sql/expenses.sql');
const Ownership = require('../models/sql/ownership.sql');
const { isoDate, money, Joi } = require('../validators/common');

const MAX_IMPORT_ROWS = 500;
const MAX_CSV_BYTES = 512 * 1024;

async function findOwned(userId, id) {
  const expense = await Expense.findById(userId, id);
  if (!expense) throw ApiError.notFound('Gasto no encontrado');
  return expense;
}

function suggestions(userId, prefix, limit) {
  return Expense.suggestions(userId, prefix, limit);
}

// ----- Importar CSV -----

// Encabezados aceptados en español o inglés
const HEADERS = {
  fecha: 'date', date: 'date',
  monto: 'amount', amount: 'amount',
  descripcion: 'description', description: 'description',
  cuenta: 'account', account: 'account', tarjeta: 'account',
  categoria: 'category', category: 'category',
};

const rowSchema = Joi.object({
  date: isoDate.required(),
  amount: money.required(),
  description: Joi.string().trim().max(200).allow(''),
  account: Joi.string().trim().min(1).max(60).required(),
  category: Joi.string().trim().max(40).allow(''),
});

async function readCsvText({ file, csv }) {
  if (Boolean(file) === Boolean(csv)) throw ApiError.badRequest('Envía el archivo (file) o el texto (csv), solo uno de los dos');
  if (file) {
    if (file.size > MAX_CSV_BYTES) throw ApiError.badRequest('El archivo CSV supera el máximo de 512 KB');
    return file.text();
  }
  if (Buffer.byteLength(csv) > MAX_CSV_BYTES) throw ApiError.badRequest('El CSV supera el máximo de 512 KB');
  return csv;
}

// Lookups por nombre normalizado: cuentas (incluye los mapeos de tarjeta) y categorías del usuario
async function loadLookups(userId) {
  const [accounts, mappings, categories] = await Promise.all([
    query('SELECT id, name FROM accounts WHERE user_id = $1 AND archived_at IS NULL', [userId]),
    query('SELECT card_key, account_id FROM card_name_mappings WHERE user_id = $1', [userId]),
    query('SELECT id, name FROM categories WHERE user_id = $1', [userId]),
  ]);
  const accountByKey = new Map(accounts.rows.map((a) => [normalizeKey(a.name), a.id]));
  for (const m of mappings.rows) if (!accountByKey.has(m.card_key)) accountByKey.set(m.card_key, m.account_id);
  const categoryByKey = new Map(categories.rows.map((c) => [normalizeKey(c.name), c.id]));
  return { accountByKey, categoryByKey };
}

// Todo o nada: si una sola fila tiene error no se importa ninguna y se devuelve la lista de errores
async function importCsv(userId, source) {
  const text = await readCsvText(source);
  let records;
  try {
    records = parse(text, {
      columns: (header) => header.map((h) => HEADERS[normalizeKey(h)] || `ignorar:${h}`),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (error) {
    throw ApiError.badRequest(`El CSV no tiene un formato válido: ${error.message}`);
  }

  if (!records.length) throw ApiError.badRequest('El CSV no tiene filas de datos');
  if (records.length > MAX_IMPORT_ROWS) throw ApiError.badRequest(`Máximo ${MAX_IMPORT_ROWS} filas por importación`);
  const missing = ['date', 'amount', 'account'].filter((c) => !(c in records[0]));
  if (missing.length) {
    throw ApiError.badRequest(`Faltan columnas obligatorias: ${missing.join(', ')} (se aceptan fecha, monto, descripcion, cuenta, categoria)`);
  }

  const { accountByKey, categoryByKey } = await loadLookups(userId);
  const items = [];
  const errors = [];

  records.forEach((raw, index) => {
    const line = index + 2; // la línea 1 es el encabezado
    const { value, error } = rowSchema.validate(
      { date: raw.date, amount: raw.amount, description: raw.description ?? '', account: raw.account, category: raw.category ?? '' },
      { abortEarly: false, convert: true }
    );
    if (error) {
      errors.push({ line, message: error.details.map((d) => d.message).join('; ') });
      return;
    }
    const accountId = accountByKey.get(normalizeKey(value.account));
    if (!accountId) {
      errors.push({ line, message: `No existe la cuenta "${value.account}"` });
      return;
    }
    const categoryId = value.category ? categoryByKey.get(normalizeKey(value.category)) : null;
    if (value.category && !categoryId) {
      errors.push({ line, message: `No existe la categoría "${value.category}"` });
      return;
    }
    items.push({ accountId, categoryId, amount: value.amount, date: value.date, description: value.description || null });
  });

  if (errors.length) return { imported: 0, totalAmount: 0, errors };

  await withTransaction((client) => Expense.insertMany(client, userId, items));
  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  return { imported: items.length, totalAmount, errors: [] };
}

// ----- Exportar CSV -----

// Evita la "inyección de fórmulas": Excel ejecuta celdas que empiezan con = + - @ como fórmulas
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function exportCsv(userId, from, to) {
  if (from > to) throw ApiError.badRequest('from debe ser anterior o igual a to');
  const rows = await Expense.findForExport(userId, from, to);
  const lines = [
    ['fecha', 'monto', 'descripcion', 'cuenta', 'categoria'].join(','),
    ...rows.map((r) => [r.date, r.amount.toFixed(2), r.description, r.accountName, r.categoryName].map(csvCell).join(',')),
  ];
  return {
    filename: `gastos_${from}_${to}.csv`,
    contentType: 'text/csv; charset=utf-8',
    rows: rows.length,
    content: `﻿${lines.join('\r\n')}\r\n`, // BOM para que Excel respete los acentos
  };
}

// ----- Comprobante -----

async function attachReceipt(userId, expenseId, file) {
  await findOwned(userId, expenseId);
  const receiptPath = await storage.save(userId, 'receipts', file, storage.RECEIPT_TYPES);
  const result = await Expense.setReceipt(userId, expenseId, receiptPath);
  if (!result) {
    await storage.remove(receiptPath);
    throw ApiError.notFound('Gasto no encontrado');
  }
  await storage.remove(result.previous);
  return Expense.findById(userId, expenseId);
}

// ----- Dividir gasto -----

async function split(userId, expenseId, parts) {
  const expense = await findOwned(userId, expenseId);

  const contactIds = parts.map((p) => p.contactId);
  if (new Set(contactIds).size !== contactIds.length) throw ApiError.badRequest('Un contacto aparece más de una vez');
  for (const contactId of contactIds) {
    if (!(await Ownership.contactBelongs(userId, contactId))) {
      throw ApiError.badRequest('Algún contacto no existe o no es tuyo', [{ field: 'parts.contactId', message: `Contacto ${contactId} inválido` }]);
    }
  }

  const total = Math.round(parts.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  if (total > expense.amount) {
    throw ApiError.badRequest(`Las partes suman ${total} y el gasto es de ${expense.amount}`);
  }
  if ((await Expense.findSplits(userId, expenseId)).length) throw ApiError.conflict('Este gasto ya está dividido');

  await withTransaction((client) => Expense.createSplits(client, userId, expense, parts));
  return { expense, splits: await Expense.findSplits(userId, expenseId), yourShare: Math.round((expense.amount - total) * 100) / 100 };
}

module.exports = { suggestions, importCsv, exportCsv, attachReceipt, split, findSplits: Expense.findSplits };
