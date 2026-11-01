const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { decimal } = require('./types');

const UserPreference = sequelize.define(
  'UserPreference',
  {
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    theme: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'dark', validate: { isIn: [['dark', 'light']] } },
    currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'MXN' },
    defaultBudget: decimal('defaultBudget'),
    hideAmounts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: 'user_preferences' }
);

module.exports = UserPreference;
