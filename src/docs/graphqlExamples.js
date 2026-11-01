// Ejemplos de cada operación GraphQL (Postman y documentación). Los ids corresponden a los datos demo
// de "npm run db:init" (usuario demo@gastos.app): cuenta 1 = BBVA Azul (crédito), categoría 1 = Comida,
// contacto 1 = José Pérez. upload: true indica que la operación recibe un archivo (multipart).
const month = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

module.exports = {
  // Autenticación
  requestPasswordReset: { auth: 'none', query: 'mutation ($email: String!) {\n  requestPasswordReset(email: $email) { ok message }\n}', variables: { email: 'demo@gastos.app' } },
  resetPassword: { auth: 'none', query: 'mutation ($email: String!, $code: String!, $newPassword: String!) {\n  resetPassword(email: $email, code: $code, newPassword: $newPassword) { ok message }\n}', variables: { email: 'demo@gastos.app', code: '123456', newPassword: 'NuevaClave123' } },
  refreshToken: { auth: 'none', query: 'mutation ($refreshToken: String!) {\n  refreshToken(refreshToken: $refreshToken) { token refreshToken expiresIn user { email } }\n}', variables: { refreshToken: '{{refreshToken}}' } },
  logout: { query: 'mutation ($refreshToken: String) {\n  logout(refreshToken: $refreshToken) { ok message }\n}', variables: { refreshToken: '{{refreshToken}}' } },
  verifyEmail: { auth: 'none', query: 'mutation ($token: String!) {\n  verifyEmail(token: $token) { email emailVerified }\n}', variables: { token: 'TOKEN_DEL_CORREO' } },
  sendVerificationEmail: { query: 'mutation {\n  sendVerificationEmail { ok message }\n}' },

  // Cuentas
  uploadAccountImage: { upload: true, query: 'mutation ($accountId: Int!, $file: File!) {\n  uploadAccountImage(accountId: $accountId, file: $file) { id name imageUrl }\n}', variables: { accountId: 1, file: null } },
  reorderAccounts: { query: 'mutation ($ids: [Int!]!) {\n  reorderAccounts(ids: $ids) { id name sortOrder }\n}', variables: { ids: [3, 1, 2] } },
  creditCardStatement: { query: 'query ($accountId: Int!, $month: String) {\n  creditCardStatement(accountId: $accountId, month: $month) {\n    month periodStart periodEnd dueDate balance minimumPayment availableCredit utilization\n  }\n}', variables: { accountId: 1, month } },

  // Categorías y contactos
  createDefaultCategories: { query: 'mutation {\n  createDefaultCategories { id name color }\n}' },
  mergeCategories: { query: 'mutation ($sourceId: Int!, $targetId: Int!) {\n  mergeCategories(sourceId: $sourceId, targetId: $targetId) { movedExpenses movedFixedExpenses target { id name } }\n}', variables: { sourceId: 3, targetId: 1 } },
  setCategoryLimit: { query: 'mutation ($categoryId: Int!, $monthlyLimit: Float) {\n  setCategoryLimit(categoryId: $categoryId, monthlyLimit: $monthlyLimit) { name monthlyLimit spentThisMonth }\n}', variables: { categoryId: 1, monthlyLimit: 3000 } },
  mergeContacts: { query: 'mutation ($sourceId: Int!, $targetId: Int!) {\n  mergeContacts(sourceId: $sourceId, targetId: $targetId) { movedNetWorthEntries movedExpenseSplits target { name } }\n}', variables: { sourceId: 2, targetId: 1 } },

  // Gastos
  expenseSuggestions: { query: 'query ($prefix: String!) {\n  expenseSuggestions(prefix: $prefix, limit: 5) { description timesUsed averageAmount accountId categoryId }\n}', variables: { prefix: 'Super' } },
  importExpensesCsv: { query: 'mutation ($csv: String) {\n  importExpensesCsv(csv: $csv) { imported totalAmount errors { line message } }\n}', variables: { csv: `fecha,monto,descripcion,cuenta,categoria\n${month}-05,120.50,Gasolina,BBVA Azul,Transporte\n${month}-06,89.90,Farmacia,Efectivo,Salud` } },
  exportExpensesCsv: { query: 'query ($from: String!, $to: String!) {\n  exportExpensesCsv(from: $from, to: $to) { filename rows content }\n}', variables: { from: `${month}-01`, to: `${month}-28` } },
  attachReceipt: { upload: true, query: 'mutation ($expenseId: Int!, $file: File!) {\n  attachReceipt(expenseId: $expenseId, file: $file) { id description receiptUrl }\n}', variables: { expenseId: 1, file: null } },
  splitExpense: { query: 'mutation ($expenseId: Int!, $parts: [SplitPartInput!]!) {\n  splitExpense(expenseId: $expenseId, parts: $parts) {\n    yourShare\n    splits { contactName amount netWorthEntryId }\n  }\n}', variables: { expenseId: 3, parts: [{ contactId: 1, amount: 50 }] } },

  // Presupuestos, gastos fijos, patrimonio, reportes
  checkBudgetAlerts: { query: 'mutation ($month: String) {\n  checkBudgetAlerts(month: $month) { type label spent limit percentUsed threshold notified }\n}', variables: { month } },
  fixedExpenseToExpense: { query: 'mutation ($fixedExpenseId: Int!, $month: String!, $accountId: Int!) {\n  fixedExpenseToExpense(fixedExpenseId: $fixedExpenseId, month: $month, accountId: $accountId) {\n    expense { id amount date description }\n    payment { month expenseId }\n  }\n}', variables: { fixedExpenseId: 2, month, accountId: 2 } },
  sendPaymentReminders: { query: 'mutation {\n  sendPaymentReminders(daysAhead: 5) { name amount dayOfMonth notified }\n}' },
  reorderNetWorth: { query: 'mutation ($ids: [Int!]!) {\n  reorderNetWorth(ids: $ids) { id label kind sortOrder }\n}', variables: { ids: [3, 2, 1, 5, 4] } },
  syncNetWorthWithAccount: { query: 'mutation ($entryId: Int!) {\n  syncNetWorthWithAccount(entryId: $entryId) { previousAmount month entry { label amount } }\n}', variables: { entryId: 4 } },
  createProjection: { query: 'mutation {\n  createProjection(name: "Ahorro 5 años", monthlyContribution: 2000, annualRate: 10, months: 60) {\n    id startingAmount finalAmount totalContributed interestEarned\n    schedule(step: 12) { month balance }\n  }\n}' },
  projections: { query: 'query {\n  projections { id name months finalAmount interestEarned }\n}' },
  deleteProjection: { query: 'mutation ($id: Int!) {\n  deleteProjection(id: $id) { ok message }\n}', variables: { id: 1 } },
  dailySpending: { query: 'query ($month: String) {\n  dailySpending(month: $month) { month total dailyBudget days { date total cumulative } }\n}', variables: { month } },
  categoryComparison: { query: 'query {\n  categoryComparison {\n    monthA monthB totalA totalB\n    categories { categoryName totalA totalB difference percentChange }\n  }\n}' },

  // Notificaciones y automatización
  registerDevice: { query: 'mutation {\n  registerDevice(token: "fcm-token-de-ejemplo-123456", platform: "android") { id platform lastSeenAt }\n}' },
  devices: { query: 'query {\n  devices { id platform lastSeenAt }\n}' },
  sendDailySummary: { admin: true, query: 'mutation {\n  sendDailySummary { date sent skipped }\n}' },
  createApiToken: { query: 'mutation {\n  createApiToken(name: "Atajos iPhone") { token apiToken { id name } }\n}' },
  createCardNameMapping: { query: 'mutation {\n  createCardNameMapping(cardName: "BBVA **1234", accountId: 1) { id cardName account { name } }\n}' },
  webhookExpense: { auth: 'apiKey', query: 'mutation {\n  webhookExpense(amount: 59.90, card: "BBVA **1234", description: "Oxxo", category: "Comida") { id amount accountName categoryName date }\n}' },
};
