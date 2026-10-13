// Construye "col = $n" solo con los campos permitidos (whitelist) para UPDATE dinamicos.
// Nunca se interpolan valores: van como parametros posicionales.
function buildUpdate(data, columns, firstIndex = 1) {
  const sets = [];
  const values = [];
  for (const [field, column] of Object.entries(columns)) {
    if (data[field] === undefined) continue;
    values.push(data[field]);
    sets.push(`${column} = $${firstIndex + values.length - 1}`);
  }
  return { sets, values };
}

// Escapa comodines de LIKE para que el texto del usuario se busque literal
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

module.exports = { buildUpdate, escapeLike };
