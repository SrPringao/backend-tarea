// Servicio de correo: un solo punto de entrada para REST, GraphQL y las tareas programadas
const { deliver, outbox } = require('./transport');
const templates = require('./templates');

async function send(to, template, data) {
  const { subject, text, html } = templates[template](data);
  return deliver({ to, subject, text, html });
}

// Para correos que no deben bloquear ni romper la respuesta (p. ej. el de bienvenida al registrarse)
function sendInBackground(to, template, data) {
  send(to, template, data).catch((error) => console.error(`[CORREO] No se pudo enviar "${template}" a ${to}:`, error.message));
}

module.exports = { send, sendInBackground, outbox };
