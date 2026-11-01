const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const CardNameMapping = sequelize.define(
  'CardNameMapping',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    cardName: { type: DataTypes.STRING(60), allowNull: false },
    cardKey: { type: DataTypes.STRING(60), allowNull: false },
    accountId: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'card_name_mappings', updatedAt: false }
);

module.exports = CardNameMapping;
