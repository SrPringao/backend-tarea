// Automatización (Sequelize ORM)
const automation = require('../../services/automation.service');
const { automation: schemas } = require('../../validators');
const { requireUser, requireApiKey, validateArgs } = require('../guards');

module.exports = {
  Query: {
    apiTokens: (_, __, ctx) => automation.listApiTokens(requireUser(ctx).id),
    cardNameMappings: (_, __, ctx) => automation.listCardNameMappings(requireUser(ctx).id),
  },
  Mutation: {
    createApiToken: (_, args, ctx) => automation.createApiToken(requireUser(ctx).id, validateArgs(schemas.createApiTokenArgs, args)),
    revokeApiToken: (_, args, ctx) => automation.revokeApiToken(requireUser(ctx).id, validateArgs(schemas.byIdArgs, args).id),
    createCardNameMapping: (_, args, ctx) =>
      automation.createCardNameMapping(requireUser(ctx).id, validateArgs(schemas.createCardNameMappingArgs, args)),
    webhookExpense: (_, args, ctx) => automation.webhookExpense(requireApiKey(ctx), validateArgs(schemas.webhookExpenseArgs, args)),
  },
};
