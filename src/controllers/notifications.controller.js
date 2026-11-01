// Servicio de correo: notificación informativa enviada por un administrador (Sequelize ORM)
const { ok } = require('../utils/response');
const notifications = require('../services/notifications.service');

async function sendEmail(req, res) {
  const { userId, subject, message } = req.validated.body;
  return ok(res, await notifications.sendInformative(userId, { subject, message }), 202);
}

module.exports = { sendEmail };
