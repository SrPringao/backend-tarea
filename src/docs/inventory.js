// Inventario global de operaciones del sistema. Fuente única para:
//  - el Excel de operaciones (scripts/generar-excel.js)
//  - la documentación OpenAPI/Swagger (src/docs/openapi.js)
//  - la colección de Postman (scripts/generar-postman.js)
// implemented: true = implementada; stage 1 = primera entrega (60 % en REST), stage 2 = el 40 % restante en GraphQL
// más el servicio de correo y archivos. false = documentada para versiones futuras.
const v = require('../validators');

const ORM = 'Sequelize ORM';
const SQL = 'SQL nativo';
const PUBLIC = 'Pública';
const JWT = 'JWT';
const ADMIN = 'JWT + rol admin';
const API_KEY = 'Token de API (X-API-Key)';
const GQL = 'GraphQL';

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
      { name: 'Solicitar recuperación de contraseña', crud: 'Otro', method: 'POST', path: '/api/auth/forgot-password', access: PUBLIC, priority: 'Media', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation requestPasswordReset', description: 'Envía un código de 6 dígitos al correo (vence en 15 min). Responde igual exista o no el correo.' },
      { name: 'Restablecer contraseña con código', crud: 'U', method: 'POST', path: '/api/auth/reset-password', access: PUBLIC, priority: 'Media', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation resetPassword', description: 'Cambia la contraseña con el código (máx. 5 intentos), cierra otras sesiones y envía aviso por correo.' },
      { name: 'Renovar token (refresh token)', crud: 'Otro', method: 'POST', path: '/api/auth/refresh', access: PUBLIC, priority: 'Media', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation refreshToken', description: 'Rotación de refresh tokens de un solo uso; si se reutiliza uno se cierran todas las sesiones.' },
      { name: 'Cerrar sesión (revocar token)', crud: 'D', method: 'POST', path: '/api/auth/logout', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation logout', description: 'Revoca el JWT actual (jti) y el refresh token, o todos con allDevices.' },
      { name: 'Verificar correo electrónico', crud: 'U', method: 'POST', path: '/api/auth/verify-email', access: PUBLIC, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation verifyEmail / sendVerificationEmail', description: 'Confirma el correo con el token del enlace enviado al registrarse; permite reenviarlo.' },
      { name: 'Inicio de sesión con Google / Apple', crud: 'Otro', method: 'POST', path: '/api/auth/oauth/{provider}', access: PUBLIC, priority: 'Baja', implemented: false, description: 'Login social para la app móvil. Queda para la etapa de Flutter: requiere registrar la app en Google Cloud y una cuenta de Apple Developer (99 USD al año) para validar los tokens de identidad.' },
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
      { name: 'Subir imagen de la tarjeta', crud: 'U', method: 'POST', path: '/api/accounts/{id}/image', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation uploadAccountImage', description: 'Subida multipart (JPEG/PNG, 2 MB) a Supabase Storage (bucket privado) o disco; URL firmada temporal.' },
      { name: 'Reordenar cuentas', crud: 'U', method: 'PUT', path: '/api/accounts/reorder', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation reorderAccounts', description: 'Define el orden de las cuentas; el listado REST lo respeta.' },
      { name: 'Estado de cuenta de tarjeta de crédito', crud: 'R', method: 'GET', path: '/api/accounts/{id}/statement', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'query creditCardStatement', description: 'Saldo del periodo, pago mínimo aproximado, fecha límite, crédito disponible y utilización.' },
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
      { name: 'Crear categorías predeterminadas', crud: 'C', method: 'POST', path: '/api/categories/defaults', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation createDefaultCategories', description: 'Crea solo las categorías base que falten (compara sin acentos ni mayúsculas).' },
      { name: 'Fusionar categorías', crud: 'U', method: 'POST', path: '/api/categories/merge', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation mergeCategories', description: 'Mueve gastos y gastos fijos a la categoría destino y elimina la origen (transacción).' },
      { name: 'Límite de gasto por categoría', crud: 'C', method: 'PUT', path: '/api/categories/{id}/limit', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation setCategoryLimit', description: 'Límite mensual por categoría; se usa en las alertas de presupuesto.' },
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
      { name: 'Fusionar contactos duplicados', crud: 'U', method: 'POST', path: '/api/contacts/merge', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation mergeContacts', description: 'Mueve registros de patrimonio y gastos divididos al contacto destino (transacción).' },
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
      { name: 'Sugerencias de gasto (autocompletar)', crud: 'R', method: 'GET', path: '/api/expenses/suggestions', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'query expenseSuggestions', description: 'Descripciones por frecuencia con cuenta y categoría más usadas (MODE() WITHIN GROUP).' },
      { name: 'Importar gastos desde CSV', crud: 'C', method: 'POST', path: '/api/expenses/import', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation importExpensesCsv', description: 'CSV por archivo o texto, máx. 500 filas; todo o nada con errores por línea.' },
      { name: 'Exportar gastos a Excel / CSV', crud: 'R', method: 'GET', path: '/api/expenses/export', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'query exportExpensesCsv', description: 'CSV compatible con Excel, protegido contra inyección de fórmulas.' },
      { name: 'Adjuntar ticket / comprobante', crud: 'U', method: 'POST', path: '/api/expenses/{id}/receipt', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation attachReceipt', description: 'JPEG/PNG/PDF (2 MB) validado por sus bytes iniciales; URL firmada temporal.' },
      { name: 'Dividir gasto entre contactos', crud: 'C', method: 'POST', path: '/api/expenses/{id}/split', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation splitExpense', description: 'Cada parte crea un activo de patrimonio "te debe" ligado al contacto (transacción).' },
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
      { name: 'Alertas al rebasar el presupuesto', crud: 'Otro', method: 'POST', path: '/api/budgets/alerts', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation checkBudgetAlerts', description: 'Alertas al 80 % y 100 % del presupuesto y límites por categoría; correo una sola vez por alerta.' },
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
      { name: 'Generar gasto real al pagar', crud: 'C', method: 'POST', path: '/api/fixed-expenses/{id}/to-expense', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation fixedExpenseToExpense', description: 'Registra el gasto del pago y marca el mes como pagado (transacción).' },
      { name: 'Recordatorios de pago', crud: 'Otro', method: 'POST', path: '/api/fixed-expenses/reminders', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation sendPaymentReminders', description: 'Correo con gastos fijos por vencer; también como tarea programada diaria.' },
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
      { name: 'Reordenar registros de patrimonio', crud: 'U', method: 'PUT', path: '/api/net-worth/reorder', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation reorderNetWorth', description: 'UPDATE con UNNEST ... WITH ORDINALITY.' },
      { name: 'Sincronizar saldo con gastos de la cuenta', crud: 'U', method: 'POST', path: '/api/net-worth/{id}/sync', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation syncNetWorthWithAccount', description: 'La deuda de una tarjeta toma el saldo de la tarjeta en el mes actual.' },
      { name: 'Crear proyección (simulador)', crud: 'C', method: 'POST', path: '/api/net-worth/projections', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation createProjection', description: 'Aportación mensual con interés compuesto; parte del patrimonio neto actual si no se indica.' },
      { name: 'Listar proyecciones', crud: 'L', method: 'GET', path: '/api/net-worth/projections', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'query projections', description: 'Incluye monto final, interés ganado y calendario por periodo.' },
      { name: 'Eliminar proyección', crud: 'D', method: 'DELETE', path: '/api/net-worth/projections/{id}', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'mutation deleteProjection' },
    ],
  },
  {
    name: 'Reportes',
    tag: 'Reports',
    operations: [
      { name: 'Dashboard del mes', crud: 'R', method: 'GET', path: '/api/reports/dashboard', data: SQL, access: JWT, priority: 'Crítica', implemented: true, schemas: v.reports.dashboard, description: 'Gastado, comparativo vs mes anterior, top categorías, por cuenta, fijos pendientes y últimos gastos.' },
      { name: 'Tendencia mensual', crud: 'R', method: 'GET', path: '/api/reports/monthly-trend', data: SQL, access: JWT, priority: 'Alta', implemented: true, schemas: v.reports.trend, description: 'Gastado vs presupuesto de los últimos N meses (generate_series).' },
      { name: 'Gasto diario del mes', crud: 'R', method: 'GET', path: '/api/reports/daily', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'query dailySpending', description: 'Todos los días del mes (generate_series) con acumulado (función ventana) y presupuesto diario.' },
      { name: 'Comparativo por categoría entre meses', crud: 'R', method: 'GET', path: '/api/reports/category-comparison', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: SQL, graphql: 'query categoryComparison', description: 'Agregación condicional con FILTER; diferencia y cambio porcentual.' },
    ],
  },
  {
    name: 'Notificaciones',
    tag: 'Notifications',
    operations: [
      { name: 'Registrar dispositivo para push (FCM)', crud: 'C', method: 'POST', path: '/api/notifications/devices', access: JWT, priority: 'Media', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation registerDevice', description: 'Guarda el token de FCM; el envío de push se integrará con la app Flutter.' },
      { name: 'Listar dispositivos registrados', crud: 'L', method: 'GET', path: '/api/notifications/devices', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'query devices' },
      { name: 'Resumen diario programado', crud: 'Otro', method: 'POST', path: '/api/notifications/daily-summary', access: ADMIN, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation sendDailySummary', description: 'Correo con el resumen del día anterior; tarea programada a las 08:00 (ENABLE_SCHEDULER).' },
    ],
  },
  {
    name: 'Automatización',
    tag: 'Automation',
    operations: [
      { name: 'Tokens de API personales', crud: 'C', method: 'POST', path: '/api/api-tokens', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation createApiToken / revokeApiToken · query apiTokens', description: 'Token fin_... mostrado una sola vez; se guarda su hash.' },
      { name: 'Mapeo de nombres de tarjeta (Atajos iOS)', crud: 'C', method: 'POST', path: '/api/card-name-mappings', access: JWT, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation createCardNameMapping · query cardNameMappings' },
      { name: 'Registrar gasto vía webhook', crud: 'C', method: 'POST', path: '/api/webhooks/expense', access: API_KEY, priority: 'Baja', implemented: true, stage: 2, api: GQL, data: ORM, graphql: 'mutation webhookExpense', description: 'Autenticado con cabecera X-API-Key; resuelve la tarjeta por mapeo o nombre.' },
    ],
  },
  {
    name: 'Servicios (correo y archivos)',
    tag: 'Services',
    operations: [
      { name: 'Confirmar correo desde el enlace', crud: 'U', method: 'GET', path: '/api/auth/verify-email', data: ORM, access: PUBLIC, priority: 'Alta', implemented: true, stage: 2, schemas: v.auth.verifyEmailLink, description: 'Destino del enlace del correo de confirmación; responde una página HTML. Es REST porque se abre desde el cliente de correo.' },
      { name: 'Enviar notificación informativa por correo', crud: 'C', method: 'POST', path: '/api/notifications/email', data: ORM, access: ADMIN, priority: 'Alta', implemented: true, stage: 2, schemas: v.notifications.sendEmail, description: 'Un administrador envía un aviso a un usuario registrado. Limitado a 30 correos por hora; el contenido se escapa en el HTML.', example: { userId: '00000000-0000-4000-8000-000000000000', subject: 'Mantenimiento programado', message: 'El sábado de 2 a 4 a. m. la app no estará disponible.' } },
      { name: 'Descargar archivo con URL firmada', crud: 'R', method: 'GET', path: '/api/files', data: 'Almacenamiento', access: 'URL firmada (HMAC)', priority: 'Media', implemented: true, stage: 2, description: 'Sirve la imagen o comprobante guardado en disco cuando no hay Supabase Storage. La URL expira en 1 hora y no se puede alterar.' },
    ],
  },
];

// Lista plana con id consecutivo (OP-001, OP-002, ...)
// api: REST salvo que se indique GraphQL; stage: 1 (primera entrega) o 2 (GraphQL y correos)
const operations = modules.flatMap((mod) =>
  mod.operations.map((op) => ({ api: 'REST', stage: 1, ...op, module: mod.name, tag: mod.tag }))
);
operations.forEach((op, i) => {
  op.id = `OP-${String(i + 1).padStart(3, '0')}`;
});

module.exports = { modules, operations };
