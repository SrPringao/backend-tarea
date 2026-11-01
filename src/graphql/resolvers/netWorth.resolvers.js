// Patrimonio (SQL nativo)
const netWorth = require('../../services/netWorth.service');
const { netWorth: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Projection: {
    finalAmount: (p) => netWorth.simulate(p).finalAmount,
    totalContributed: (p) => netWorth.simulate(p).totalContributed,
    interestEarned: (p) => netWorth.simulate(p).interestEarned,
    schedule: (p, { step }) => netWorth.simulate(p, Math.min(Math.max(step || 12, 1), p.months)).schedule,
  },
  Query: {
    projections: (_, __, ctx) => netWorth.listProjections(requireUser(ctx).id),
  },
  Mutation: {
    reorderNetWorth: (_, args, ctx) => {
      const user = requireUser(ctx);
      return netWorth.reorder(user.id, validateArgs(schemas.reorderArgs, args).ids);
    },
    syncNetWorthWithAccount: (_, args, ctx) => {
      const user = requireUser(ctx);
      return netWorth.syncWithAccount(user.id, validateArgs(schemas.syncArgs, args).entryId);
    },
    createProjection: (_, args, ctx) => {
      const user = requireUser(ctx);
      return netWorth.createProjection(user.id, validateArgs(schemas.createProjectionArgs, args));
    },
    deleteProjection: async (_, args, ctx) => {
      const user = requireUser(ctx);
      await netWorth.deleteProjection(user.id, validateArgs(schemas.byIdArgs, args).id);
      return { ok: true, message: 'Proyección eliminada' };
    },
  },
};
