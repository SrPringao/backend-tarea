// Enmascarado de errores: solo llegan al cliente mensajes pensados para él.
// ApiError y errores conocidos de la base se traducen a un código en extensions;
// cualquier otro error se reemplaza por "Unexpected error." sin pila. Fuera de producción se agrega
// solo el mensaje original en extensions.debug (igual que la API REST), nunca la pila ni rutas de archivos.
const { GraphQLError } = require('graphql');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

const CODES = { 400: 'BAD_USER_INPUT', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT' };

function maskError(error, message) {
  const original = error instanceof GraphQLError ? error.originalError : error;
  const known = original ? ApiError.fromDatabase(original) : null;

  if (known) {
    const extensions = { code: CODES[known.status] || 'BAD_REQUEST', status: known.status };
    if (known.details) extensions.details = known.details;
    return new GraphQLError(known.message, { nodes: error.nodes, path: error.path, extensions });
  }
  // Errores de sintaxis, de validación del schema o de graphql-armor: ya son seguros
  if (error instanceof GraphQLError && !error.originalError) return error;

  if (original) console.error('[GRAPHQL ERROR]', original);
  const extensions = { code: 'INTERNAL_SERVER_ERROR', status: 500 };
  if (!config.isProd && original?.message) extensions.debug = original.message;
  return new GraphQLError(message, { nodes: error.nodes, path: error.path, extensions });
}

module.exports = { maskError };
