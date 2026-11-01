// Contexto de cada petición GraphQL: identifica al usuario a partir de las cabeceras.
//  - Authorization: Bearer <jwt>  -> usuario de la app
//  - X-API-Key: <token de API>    -> automatizaciones (solo para la mutación webhookExpense)
// Si el token es inválido no se falla aquí: el error se guarda y lo lanza requireUser, así las
// operaciones públicas (p. ej. requestPasswordReset) siguen funcionando.
const { verifyAccessToken } = require('../services/auth.service');
const automation = require('../services/automation.service');

async function buildContext({ request }) {
  const context = { user: null, authError: null, apiUser: null, apiKeyError: null };

  const [scheme, token] = (request.headers.get('authorization') || '').split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      context.user = await verifyAccessToken(token);
    } catch (error) {
      context.authError = error;
    }
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    try {
      context.apiUser = await automation.verifyApiToken(apiKey);
    } catch (error) {
      context.apiKeyError = error;
    }
  }

  return context;
}

module.exports = { buildContext };
