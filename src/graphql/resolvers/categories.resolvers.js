// Categorías (Sequelize ORM)
const categories = require('../../services/categories.service');
const { categories: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Category: {
    spentThisMonth: (category) => categories.spentInMonth(category.userId, category.id),
  },
  Mutation: {
    createDefaultCategories: (_, __, ctx) => categories.createDefaults(requireUser(ctx).id),
    mergeCategories: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { sourceId, targetId } = validateArgs(schemas.mergeArgs, args);
      return categories.merge(user.id, sourceId, targetId);
    },
    setCategoryLimit: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { categoryId, monthlyLimit } = validateArgs(schemas.setLimitArgs, { monthlyLimit: null, ...args });
      return categories.setLimit(user.id, categoryId, monthlyLimit);
    },
  },
};
