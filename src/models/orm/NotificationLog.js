const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

// La llave única (userId, kind, ref) evita enviar la misma notificación dos veces
const NotificationLog = sequelize.define(
  'NotificationLog',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING(30), allowNull: false },
    ref: { type: DataTypes.STRING(80), allowNull: false },
  },
  { tableName: 'notification_log', createdAt: 'sent_at', updatedAt: false }
);

module.exports = NotificationLog;
