const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Device = sequelize.define(
  'Device',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    token: { type: DataTypes.STRING(255), allowNull: false },
    platform: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['android', 'ios', 'web']] } },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'devices', updatedAt: false }
);

module.exports = Device;
