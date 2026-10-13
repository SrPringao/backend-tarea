const BaseJoi = require('joi');

const messages = {
  'any.required': '{#label} es obligatorio',
  'any.only': '{#label} debe ser uno de: {#valids}',
  'any.invalid': '{#label} tiene un valor no permitido',
  'string.base': '{#label} debe ser texto',
  'string.empty': '{#label} no puede estar vacío',
  'string.min': '{#label} debe tener al menos {#limit} caracteres',
  'string.max': '{#label} debe tener como máximo {#limit} caracteres',
  'string.length': '{#label} debe tener exactamente {#limit} caracteres',
  'string.email': '{#label} debe ser un correo válido',
  'string.guid': '{#label} debe ser un UUID válido',
  'string.pattern.base': '{#label} tiene un formato inválido',
  'string.pattern.name': '{#label} debe tener el formato {#name}',
  'number.base': '{#label} debe ser un número',
  'number.min': '{#label} debe ser mayor o igual a {#limit}',
  'number.max': '{#label} debe ser menor o igual a {#limit}',
  'number.positive': '{#label} debe ser mayor a 0',
  'number.integer': '{#label} debe ser un número entero',
  'number.unsafe': '{#label} es demasiado grande',
  'boolean.base': '{#label} debe ser true o false',
  'object.base': '{#label} debe ser un objeto',
  'object.min': 'Envía al menos un campo para actualizar',
  'object.missing': 'Envía al menos uno de: {#peers}',
  'date.invalid': '{#label} no es una fecha real',
};

const Joi = BaseJoi.defaults((schema) => schema.prefs({ messages, errors: { wrap: { label: false } } }));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const id = Joi.number().integer().positive();
const idParams = Joi.object({ id: id.required() });

// Fecha YYYY-MM-DD que además exista en el calendario (rechaza 2025-02-30)
const isoDate = Joi.string()
  .pattern(DATE_RE, 'YYYY-MM-DD')
  .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      return helpers.error('date.invalid');
    }
    return value;
  });

const month = Joi.string().pattern(MONTH_RE, 'YYYY-MM');
const money = Joi.number().min(0.01).precision(2).max(9999999999.99);
const color = Joi.string().pattern(/^#[0-9a-fA-F]{6}$/, '#RRGGBB');
const dayOfMonth = Joi.number().integer().min(1).max(31);

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

// Contraseña: mínimo 8 caracteres con al menos una letra y un número
const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'al menos una letra y un número');

module.exports = { Joi, id, idParams, isoDate, month, money, color, dayOfMonth, pagination, password };
