// Mes actual en formato YYYY-MM (hora local del servidor)
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// Fecha de hoy en formato YYYY-MM-DD (hora local del servidor, no UTC)
function today() {
  const now = new Date();
  return `${currentMonth()}-${String(now.getDate()).padStart(2, '0')}`;
}

// Suma meses a un YYYY-MM (acepta negativos)
function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { currentMonth, daysInMonth, today, addMonths };
