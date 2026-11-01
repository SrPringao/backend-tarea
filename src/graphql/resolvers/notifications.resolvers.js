// Notificaciones (Sequelize ORM)
const notifications = require('../../services/notifications.service');
const { notifications: schemas } = require('../../validators');
const { requireUser, requireAdmin, validateArgs } = require('../guards');

module.exports = {
  Query: {
    devices: (_, __, ctx) => notifications.listDevices(requireUser(ctx).id),
  },
  Mutation: {
    registerDevice: (_, args, ctx) => {
      const user = requireUser(ctx);
      return notifications.registerDevice(user.id, validateArgs(schemas.registerDeviceArgs, args));
    },
    sendDailySummary: (_, args, ctx) => {
      requireAdmin(ctx);
      return notifications.sendDailySummary(validateArgs(schemas.dailySummaryArgs, args).date);
    },
  },
};
