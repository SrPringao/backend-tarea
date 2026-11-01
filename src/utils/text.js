// "  José  Pérez" y "jose perez" generan la misma llave: sin acentos, minúsculas y espacios simples
function normalizeKey(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeKey };
