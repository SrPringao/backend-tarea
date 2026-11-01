// Transporte de correo según el entorno:
//  - con GMAIL_USER y GMAIL_APP_PASSWORD: Gmail por SMTP (TLS)
//  - sin credenciales: jsonTransport, el correo se imprime en la consola y la app sigue funcionando
//  - en pruebas: jsonTransport y cada mensaje se guarda en outbox para revisarlo
const nodemailer = require('nodemailer');
const config = require('../../config/env');

const outbox = [];

const transporter = config.mail.enabled && !config.isTest
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.mail.user, pass: config.mail.appPassword },
    })
  : nodemailer.createTransport({ jsonTransport: true });

async function deliver(message) {
  const info = await transporter.sendMail({ from: config.mail.from, ...message });
  if (config.isTest) {
    outbox.push(message);
  } else if (!config.mail.enabled) {
    console.log(`[CORREO sin enviar: configura GMAIL_USER] Para: ${message.to} | Asunto: ${message.subject}\n${message.text}\n`);
  }
  return info;
}

module.exports = { deliver, outbox };
