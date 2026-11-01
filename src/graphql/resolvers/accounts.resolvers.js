// Cuentas (Sequelize ORM)
const accounts = require('../../services/accounts.service');
const storage = require('../../services/storage');
const { accounts: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Account: {
    imageUrl: (account) => storage.signedUrl(account.imagePath),
  },
  Query: {
    creditCardStatement: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { accountId, month } = validateArgs(schemas.statementArgs, args);
      return accounts.creditCardStatement(user.id, accountId, month);
    },
  },
  Mutation: {
    reorderAccounts: (_, args, ctx) => accounts.reorder(requireUser(ctx).id, validateArgs(schemas.reorderArgs, args).ids),
    uploadAccountImage: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { accountId, file } = validateArgs(schemas.uploadImageArgs, args);
      return accounts.uploadImage(user.id, accountId, file);
    },
  },
};
