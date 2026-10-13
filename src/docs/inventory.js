// Inventario global de operaciones del sistema. Fuente única para:
//  - el Excel de operaciones (scripts/generar-excel.js)
//  - la documentación OpenAPI/Swagger (src/docs/openapi.js)
//  - la colección de Postman (scripts/generar-postman.js)
// implemented: true = incluida en la versión 1 (60 %); false = alcance de versiones futuras (40 %).
const v = require('../validators');

const ORM = 'Sequelize ORM';
const SQL = 'SQL nativo';
const PUBLIC = 'Pública';
const JWT = 'JWT';
const ADMIN = 'JWT + rol admin';

const modules = [
  {
    name: 'Autenticación',
    tag: 'Auth',
    operations: [
      { name: 'Registrar usuario', crud: 'C', method: 'POST', path: '/api/auth/register', data: ORM, access: PUBLIC, priority: 'Crítica', implemented: true, schemas: v.auth.register, description: 'Crea la cuenta (contraseña con bcrypt) y sus preferencias en una transacción; devuelve un JWT.', example: { email: 'ana@correo.com', password: 'Secreta123', displayName: 'Ana López' } },
      { name: 'Iniciar sesión', crud: 'Otro', method: 'POST', path: '/api/auth/login', data: ORM, access: PUBLIC, priority: 'Crítica', implemented: true, schemas: v.auth.login, description: 'Valida credenciales y devuelve un JWT con vigencia configurable.', example: { email: 'demo@gastos.app', password: 'Demo1234' } },
      { name: 'Consultar mi perfil', crud: 'R', method: 'GET', path: '/api/auth/me', data: ORM, access: JWT, priority: 'Alta', implemented: true, description: 'Datos del usuario autenticado con sus preferencias (include).' },
      { name: 'Actualizar mi perfil', crud: 'U', method: 'PUT', path: '/api/auth/me', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.auth.updateMe, description: 'Cambia nombre o correo (correo único).', example: { displayName: 'Ana L.' } },
      { name: 'Cambiar contraseña', crud: 'U', method: 'PUT', path: '/api/auth/password', data: ORM, access: JWT, priority: 'Alta', implemented: true, schemas: v.auth.changePassword, description: 'Requiere la contraseña actual.', example: { currentPassword: 'Demo1234', newPassword: 'NuevaClave456' } },
      { name: 'Solicitar recuperación de contraseña', crud: 'Otro', method: 'POST', path: '/api/auth/forgot-password', access: PUBLIC, priority: 'Media', implemented: false, description: 'Envía un código de recuperación por correo.' },
      { name: 'Restablecer contraseña con código', crud: 'U', method: 'POST', path: '/api/auth/reset-password', access: PUBLIC, priority: 'Media', implemented: false, description: 'Cambia la contraseña con el código recibido.' },
      { name: 'Renovar token (refresh token)', crud: 'Otro', method: 'POST', path: '/api/auth/refresh', access: PUBLIC, priority: 'Media', implemented: false, description: 'Emite un nuevo JWT sin pedir credenciales.' },
      { name: 'Cerrar sesión (revocar token)', crud: 'D', method: 'POST', path: '/api/auth/logout', access: JWT, priority: 'Baja', implemented: false, description: 'Agrega el token a una lista de revocados.' },
      { name: 'Verificar correo electrónico', crud: 'U', method: 'POST', path: '/api/auth/verify-email', access: PUBLIC, priority: 'Baja', implemented: false, description: 'Confirma el correo mediante enlace.' },
      { name: 'Inicio de sesión con Google / Apple', crud: 'Otro', method: 'POST', path: '/api/auth/oauth/{provider}', access: PUBLIC, priority: 'Baja', implemented: false, description: 'Login social para la app móvil.' },
    ],
  },
  {
    name: 'Usuarios (administración)',
    tag: 'Users',
    operations: [
      { name: 'Listar usuarios', crud: 'L', method: 'GET', path: '/api/users', data: ORM, access: ADMIN, priority: 'Media', implemented: true, schemas: v.users.list, description: 'Paginado, con búsqueda por nombre/correo y filtros de rol y estado.' },
      { name: 'Consultar usuario', crud: 'R', method: 'GET', path: '/api/users/{id}', data: ORM, access: ADMIN, priority: 'Media', implemented: true, schemas: v.users.byId },
      { name: 'Cambiar rol o estado de usuario', crud: 'U', method: 'PATCH', path: '/api/users/{id}', data: ORM, access: ADMIN, priority: 'Media', implemented: true, schemas: v.users.update, description: 'Activa/desactiva o cambia el rol. Un admin no puede degradarse a sí mismo.', example: { isActive: false } },
      { name: 'Eliminar usuario', crud: 'D', method: 'DELETE', path: '/api/users/{id}', data: ORM, access: ADMIN, priority: 'Media', implemented: true, schemas: v.users.byId, description: 'Borra al usuario y en cascada toda su información.' },
      { name: 'Eliminar mi propia cuenta', crud: 'D', method: 'DELETE', path: '/api/auth/me', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.auth.deleteMe, description: 'Baja voluntaria: requiere la contraseña y borra en cascada toda la información del usuario. El último administrador activo no puede darse de baja.', example: { password: 'TuContrasena123' } },
    ],
  },
  {
    name: 'Cuentas / métodos de pago',
    tag: 'Accounts',
    operations: [
      { name: 'Crear cuenta', crud: 'C', method: 'POST', path: '/api/accounts', data: ORM, access: JWT, priority: 'Crítica', implemented: true, schemas: v.accounts.create, description: 'Tarjeta de crédito, débito o efectivo.', example: { name: 'BBVA Azul', type: 'credit', color: '#1A4D8F', paymentDay: 5, creditLimit: 25000 } },
      { name: 'Listar cuentas', crud: 'L', method: 'GET', path: '/api/accounts', data: ORM, access: JWT, priority: 'Crítica', implemented: true, schemas: v.accounts.list, description: 'Filtra por tipo; las archivadas se ocultan salvo includeArchived=true.' },
      { name: 'Consultar cuenta', crud: 'R', method: 'GET', path: '/api/accounts/{id}', data: ORM, access: JWT, priority: 'Alta', implemented: true, schemas: v.accounts.byId },
      { name: 'Actualizar cuenta', crud: 'U', method: 'PUT', path: '/api/accounts/{id}', data: ORM, access: JWT, priority: 'Alta', implemented: true, schemas: v.accounts.update, example: { name: 'BBVA Azul Oro', creditLimit: 30000 } },
      { name: 'Archivar / reactivar cuenta', crud: 'U', method: 'PATCH', path: '/api/accounts/{id}/archive', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.accounts.archive, description: 'Oculta la cuenta conservando sus gastos.', example: { archived: true } },
      { name: 'Eliminar cuenta', crud: 'D', method: 'DELETE', path: '/api/accounts/{id}', data: ORM, access: JWT, priority: 'Alta', implemented: true, schemas: v.accounts.byId, description: 'Responde 409 si la cuenta tiene gastos (integridad referencial).' },
      { name: 'Subir imagen de la tarjeta', crud: 'U', method: 'POST', path: '/api/accounts/{id}/image', access: JWT, priority: 'Baja', implemented: false, description: 'Carga a almacenamiento S3.' },
      { name: 'Reordenar cuentas', crud: 'U', method: 'PUT', path: '/api/accounts/reorder', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Estado de cuenta de tarjeta de crédito', crud: 'R', method: 'GET', path: '/api/accounts/{id}/statement', access: JWT, priority: 'Media', implemented: false, description: 'Saldo al corte, mínimo y fecha límite.' },
    ],
  },
  {
    name: 'Categorías',
    tag: 'Categories',
    operations: [
      { name: 'Crear categoría', crud: 'C', method: 'POST', path: '/api/categories', data: ORM, access: JWT, priority: 'Crítica', implemented: true, schemas: v.categories.create, description: 'Nombre único por usuario sin distinguir mayúsculas.', example: { name: 'Comida', color: '#E4572E' } },
      { name: 'Listar categorías', crud: 'L', method: 'GET', path: '/api/categories', data: ORM, access: JWT, priority: 'Crítica', implemented: true, schemas: v.categories.list },
      { name: 'Consultar categoría', crud: 'R', method: 'GET', path: '/api/categories/{id}', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.categories.byId },
      { name: 'Actualizar categoría', crud: 'U', method: 'PUT', path: '/api/categories/{id}', data: ORM, access: JWT, priority: 'Alta', implemented: true, schemas: v.categories.update, example: { color: '#29335C' } },
      { name: 'Eliminar categoría', crud: 'D', method: 'DELETE', path: '/api/categories/{id}', data: ORM, access: JWT, priority: 'Alta', implemented: true, schemas: v.categories.byId, description: 'Sus gastos quedan "Sin categoría".' },
      { name: 'Crear categorías predeterminadas', crud: 'C', method: 'POST', path: '/api/categories/defaults', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Fusionar categorías', crud: 'U', method: 'POST', path: '/api/categories/merge', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Límite de gasto por categoría', crud: 'C', method: 'PUT', path: '/api/categories/{id}/limit', access: JWT, priority: 'Media', implemented: false },
    ],
  },
  {
    name: 'Contactos',
    tag: 'Contacts',
    operations: [
      { name: 'Crear contacto', crud: 'C', method: 'POST', path: '/api/contacts', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.contacts.create, description: 'Detecta duplicados ignorando acentos, mayúsculas y espacios.', example: { name: 'José Pérez' } },
      { name: 'Listar contactos', crud: 'L', method: 'GET', path: '/api/contacts', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.contacts.list },
      { name: 'Consultar contacto', crud: 'R', method: 'GET', path: '/api/contacts/{id}', data: ORM, access: JWT, priority: 'Baja', implemented: true, schemas: v.contacts.byId },
      { name: 'Actualizar / archivar contacto', crud: 'U', method: 'PUT', path: '/api/contacts/{id}', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.contacts.update, example: { archived: true } },
      { name: 'Eliminar contacto', crud: 'D', method: 'DELETE', path: '/api/contacts/{id}', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.contacts.byId },
      { name: 'Fusionar contactos duplicados', crud: 'U', method: 'POST', path: '/api/contacts/merge', access: JWT, priority: 'Baja', implemented: false },
    ],
  },
  {
    name: 'Preferencias',
    tag: 'Preferences',
    operations: [
      { name: 'Consultar preferencias', crud: 'R', method: 'GET', path: '/api/preferences', data: ORM, access: JWT, priority: 'Media', implemented: true, description: 'Las crea con valores por defecto si no existen (findOrCreate).' },
      { name: 'Actualizar preferencias', crud: 'U', method: 'PUT', path: '/api/preferences', data: ORM, access: JWT, priority: 'Media', implemented: true, schemas: v.preferences.update, example: { theme: 'light', defaultBudget: 12000 } },
    ],
  },
  {
    name: 'Gastos',
    tag: 'Expenses',
    operations: [
      { name: 'Registrar gasto', crud: 'C', method: 'POST', path: '/api/expenses', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.expenses.create, description: 'Valida que la cuenta y la categoría pertenezcan al usuario.', example: { amount: 249.9, date: '2026-10-10', description: 'Supermercado', accountId: 1, categoryId: 1 } },
      { name: 'Listar gastos con filtros', crud: 'L', method: 'GET', path: '/api/expenses', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.expenses.list, description: 'Paginación, rango de fechas, cuenta, categoría, montos, búsqueda y orden.' },
      { name: 'Consultar gasto', crud: 'R', method: 'GET', path: '/api/expenses/{id}', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.expenses.byId },
      { name: 'Actualizar gasto', crud: 'U', method: 'PUT', path: '/api/expenses/{id}', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.expenses.update, example: { amount: 300, description: 'Supermercado y farmacia' } },
      { name: 'Eliminar gasto', crud: 'D', method: 'DELETE', path: '/api/expenses/{id}', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.expenses.byId },
      { name: 'Resumen de gastos por categoría', crud: 'R', method: 'GET', path: '/api/expenses/summary', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.expenses.summary, description: 'Totales y porcentaje por categoría en un rango (función ventana).' },
      { name: 'Sugerencias de gasto (autocompletar)', crud: 'R', method: 'GET', path: '/api/expenses/suggestions', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Importar gastos desde CSV', crud: 'C', method: 'POST', path: '/api/expenses/import', access: JWT, priority: 'Media', implemented: false },
      { name: 'Exportar gastos a Excel / CSV', crud: 'R', method: 'GET', path: '/api/expenses/export', access: JWT, priority: 'Media', implemented: false },
      { name: 'Adjuntar ticket / comprobante', crud: 'U', method: 'POST', path: '/api/expenses/{id}/receipt', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Dividir gasto entre contactos', crud: 'C', method: 'POST', path: '/api/expenses/{id}/split', access: JWT, priority: 'Baja', implemented: false },
    ],
  },
  {
    name: 'Presupuestos mensuales',
    tag: 'Budgets',
    operations: [
      { name: 'Definir presupuesto del mes', crud: 'C', method: 'PUT', path: '/api/budgets/{month}', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.budgets.upsert, description: 'Crea o actualiza (UPSERT con ON CONFLICT). 201 si es nuevo, 200 si se actualizó.', example: { amount: 15000 } },
      { name: 'Listar presupuestos con lo gastado', crud: 'L', method: 'GET', path: '/api/budgets', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.budgets.list, description: 'Incluye gastado, restante y % usado por mes (LATERAL JOIN).' },
      { name: 'Estado del presupuesto del mes', crud: 'R', method: 'GET', path: '/api/budgets/{month}', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.budgets.byMonth, description: 'Gastado, restante, promedio diario y proyección al cierre.' },
      { name: 'Eliminar presupuesto del mes', crud: 'D', method: 'DELETE', path: '/api/budgets/{month}', data: SQL, access: JWT, priority: 'Media', implemented: true, schemas: v.budgets.byMonth },
      { name: 'Alertas al rebasar el presupuesto', crud: 'Otro', method: 'POST', path: '/api/budgets/alerts', access: JWT, priority: 'Media', implemented: false },
    ],
  },
  {
    name: 'Gastos fijos',
    tag: 'FixedExpenses',
    operations: [
      { name: 'Crear gasto fijo', crud: 'C', method: 'POST', path: '/api/fixed-expenses', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.fixedExpenses.create, example: { name: 'Renta', amount: 8500, dayOfMonth: 1 } },
      { name: 'Listar gastos fijos con estado de pago', crud: 'L', method: 'GET', path: '/api/fixed-expenses', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.fixedExpenses.list, description: 'Indica si cada uno está pagado en el mes y totales pagado/pendiente.' },
      { name: 'Consultar gasto fijo con historial', crud: 'R', method: 'GET', path: '/api/fixed-expenses/{id}', data: SQL, access: JWT, priority: 'Media', implemented: true, schemas: v.fixedExpenses.byId },
      { name: 'Actualizar gasto fijo', crud: 'U', method: 'PUT', path: '/api/fixed-expenses/{id}', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.fixedExpenses.update, example: { amount: 9000 } },
      { name: 'Eliminar gasto fijo', crud: 'D', method: 'DELETE', path: '/api/fixed-expenses/{id}', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.fixedExpenses.byId },
      { name: 'Marcar gasto fijo como pagado', crud: 'C', method: 'POST', path: '/api/fixed-expenses/{id}/payments', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.fixedExpenses.pay, description: '409 si ese mes ya estaba pagado.', example: { month: '2026-10' } },
      { name: 'Desmarcar pago del mes', crud: 'D', method: 'DELETE', path: '/api/fixed-expenses/{id}/payments/{month}', data: SQL, access: JWT, priority: 'Media', implemented: true, schemas: v.fixedExpenses.unpay },
      { name: 'Generar gasto real al pagar', crud: 'C', method: 'POST', path: '/api/fixed-expenses/{id}/to-expense', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Recordatorios de pago', crud: 'Otro', method: 'POST', path: '/api/fixed-expenses/reminders', access: JWT, priority: 'Media', implemented: false },
    ],
  },
  {
    name: 'Patrimonio',
    tag: 'NetWorth',
    operations: [
      { name: 'Registrar activo o deuda', crud: 'C', method: 'POST', path: '/api/net-worth', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.netWorth.create, description: 'Activo (saldo, dinero que te deben) o deuda con fecha límite.', example: { label: 'Préstamo a José', kind: 'asset', amount: 1500, contactId: 1 } },
      { name: 'Listar patrimonio', crud: 'L', method: 'GET', path: '/api/net-worth', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.netWorth.list },
      { name: 'Consultar registro de patrimonio', crud: 'R', method: 'GET', path: '/api/net-worth/{id}', data: SQL, access: JWT, priority: 'Media', implemented: true, schemas: v.netWorth.byId },
      { name: 'Actualizar registro de patrimonio', crud: 'U', method: 'PUT', path: '/api/net-worth/{id}', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.netWorth.update, example: { amount: 1000 } },
      { name: 'Eliminar registro de patrimonio', crud: 'D', method: 'DELETE', path: '/api/net-worth/{id}', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.netWorth.byId },
      { name: 'Resumen de patrimonio neto', crud: 'R', method: 'GET', path: '/api/net-worth/summary', data: SQL, access: JWT, priority: 'Alta', implemented: true, description: 'Activos - deudas, deudas vencidas, próximas a vencer y lo que te debe cada contacto.' },
      { name: 'Reordenar registros de patrimonio', crud: 'U', method: 'PUT', path: '/api/net-worth/reorder', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Sincronizar saldo con gastos de la cuenta', crud: 'U', method: 'POST', path: '/api/net-worth/{id}/sync', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Crear proyección (simulador)', crud: 'C', method: 'POST', path: '/api/net-worth/projections', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Listar proyecciones', crud: 'L', method: 'GET', path: '/api/net-worth/projections', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Eliminar proyección', crud: 'D', method: 'DELETE', path: '/api/net-worth/projections/{id}', access: JWT, priority: 'Baja', implemented: false },
    ],
  },
  {
    name: 'Reportes',
    tag: 'Reports',
    operations: [
      { name: 'Dashboard del mes', crud: 'R', method: 'GET', path: '/api/reports/dashboard', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.reports.dashboard, description: 'Gastado, comparativo vs mes anterior, top categorías, por cuenta, fijos pendientes y últimos gastos.' },
      { name: 'Tendencia mensual', crud: 'R', method: 'GET', path: '/api/reports/monthly-trend', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.reports.trend, description: 'Gastado vs presupuesto de los últimos N meses (generate_series).' },
      { name: 'Gasto diario del mes', crud: 'R', method: 'GET', path: '/api/reports/daily', access: JWT, priority: 'Media', implemented: false },
      { name: 'Comparativo por categoría entre meses', crud: 'R', method: 'GET', path: '/api/reports/category-comparison', access: JWT, priority: 'Baja', implemented: false },
    ],
  },
  {
    name: 'Notificaciones',
    tag: 'Notifications',
    operations: [
      { name: 'Registrar dispositivo para push (FCM)', crud: 'C', method: 'POST', path: '/api/notifications/devices', access: JWT, priority: 'Media', implemented: false },
      { name: 'Listar dispositivos registrados', crud: 'L', method: 'GET', path: '/api/notifications/devices', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Resumen diario programado', crud: 'Otro', method: 'POST', path: '/api/notifications/daily-summary', access: ADMIN, priority: 'Baja', implemented: false },
    ],
  },
  {
    name: 'Automatización',
    tag: 'Automation',
    operations: [
      { name: 'Tokens de API personales', crud: 'C', method: 'POST', path: '/api/api-tokens', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Mapeo de nombres de tarjeta (Atajos iOS)', crud: 'C', method: 'POST', path: '/api/card-name-mappings', access: JWT, priority: 'Baja', implemented: false },
      { name: 'Registrar gasto vía webhook', crud: 'C', method: 'POST', path: '/api/webhooks/expense', access: 'Token de API', priority: 'Baja', implemented: false },
    ],
  },
];

// Lista plana con id consecutivo (OP-001, OP-002, ...)
const operations = modules.flatMap((mod) => mod.operations.map((op) => ({ ...op, module: mod.name, tag: mod.tag })));
operations.forEach((op, i) => {
  op.id = `OP-${String(i + 1).padStart(3, '0')}`;
});

module.exports = { modules, operations };
