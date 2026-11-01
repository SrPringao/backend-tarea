// Plantillas de correo (HTML y texto plano). Todo dato del usuario pasa por escapeHtml.
const config = require('../../config/env');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const money = (n) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function layout(title, bodyHtml) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2933">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px">
      <tr><td style="font-size:20px;font-weight:bold;color:#1f4e79;padding-bottom:16px">${escapeHtml(title)}</td></tr>
      <tr><td style="font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
      <tr><td style="font-size:12px;color:#7b8794;padding-top:24px">Finanzas Personales · Este es un correo automático, no respondas a este mensaje.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const button = (url, label) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#1f4e79;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`;

function verifyEmail({ name, token }) {
  const url = `${config.publicUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Confirma tu cuenta',
    text: `Hola ${name},\n\nConfirma tu correo abriendo este enlace (vence en 24 horas):\n${url}\n\nSi no creaste una cuenta, ignora este mensaje.`,
    html: layout(
      'Confirma tu cuenta',
      `<p>Hola ${escapeHtml(name)},</p><p>Gracias por registrarte. Confirma tu correo para activar todas las funciones.</p>${button(url, 'Confirmar mi correo')}<p>El enlace vence en 24 horas. Si no creaste una cuenta, ignora este mensaje.</p>`
    ),
  };
}

function passwordResetCode({ name, code }) {
  return {
    subject: 'Código para restablecer tu contraseña',
    text: `Hola ${name},\n\nTu código para restablecer la contraseña es: ${code}\nVence en 15 minutos.\n\nSi no lo solicitaste, ignora este mensaje; tu contraseña no cambiará.`,
    html: layout(
      'Restablecer contraseña',
      `<p>Hola ${escapeHtml(name)},</p><p>Usa este código para restablecer tu contraseña:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${escapeHtml(code)}</p><p>Vence en 15 minutos. Si no lo solicitaste, ignora este mensaje; tu contraseña no cambiará.</p>`
    ),
  };
}

function passwordChanged({ name }) {
  const when = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  return {
    subject: 'Tu contraseña cambió',
    text: `Hola ${name},\n\nLa contraseña de tu cuenta se cambió el ${when}.\nSi no fuiste tú, restablécela de inmediato con la opción "Olvidé mi contraseña".`,
    html: layout(
      'Tu contraseña cambió',
      `<p>Hola ${escapeHtml(name)},</p><p>La contraseña de tu cuenta se cambió el <strong>${escapeHtml(when)}</strong>.</p><p>Si no fuiste tú, restablécela de inmediato con la opción "Olvidé mi contraseña".</p>`
    ),
  };
}

function budgetAlert({ name, alerts }) {
  const lines = alerts.map((a) => `${a.label}: ${money(a.spent)} de ${money(a.limit)} (${a.percentUsed}%)`);
  return {
    subject: 'Alerta de presupuesto',
    text: `Hola ${name},\n\nEstas son tus alertas de gasto:\n${lines.map((l) => `- ${l}`).join('\n')}`,
    html: layout(
      'Alerta de presupuesto',
      `<p>Hola ${escapeHtml(name)},</p><p>Estas son tus alertas de gasto:</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
    ),
  };
}

function paymentReminder({ name, items }) {
  const lines = items.map((i) => `${i.name}: ${money(i.amount)}, vence el día ${i.dayOfMonth}`);
  return {
    subject: 'Recordatorio de pagos próximos',
    text: `Hola ${name},\n\nTienes pagos fijos por vencer:\n${lines.map((l) => `- ${l}`).join('\n')}`,
    html: layout(
      'Pagos próximos',
      `<p>Hola ${escapeHtml(name)},</p><p>Tienes pagos fijos por vencer:</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
    ),
  };
}

function dailySummary({ name, date, total, count, topCategory, budgetRemaining }) {
  const lines = [
    `Gastaste ${money(total)} en ${count} movimiento(s).`,
    topCategory ? `Categoría con más gasto: ${topCategory}.` : null,
    budgetRemaining !== null ? `Te quedan ${money(budgetRemaining)} de tu presupuesto del mes.` : null,
  ].filter(Boolean);
  return {
    subject: `Resumen de gastos del ${date}`,
    text: `Hola ${name},\n\nResumen del ${date}:\n${lines.join('\n')}`,
    html: layout(`Resumen del ${date}`, `<p>Hola ${escapeHtml(name)},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`),
  };
}

function informative({ name, subject, message }) {
  return {
    subject,
    text: `Hola ${name},\n\n${message}`,
    html: layout(subject, `<p>Hola ${escapeHtml(name)},</p>${escapeHtml(message).split('\n').map((l) => `<p>${l}</p>`).join('')}`),
  };
}

module.exports = { escapeHtml, verifyEmail, passwordResetCode, passwordChanged, budgetAlert, paymentReminder, dailySummary, informative };
