const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

// Tokens de API personales; el valor real solo se muestra al crearlo
const ApiToken = sequelize.define(
  'ApiToken',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(60), allowNull: false },
    tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
    lastUsedAt: { type: DataTypes.DATE },
    revokedAt: { type: DataTypes.DATE },
  },
  {
    tableName: 'api_tokens',
    updatedAt: false,
    defaultScope: { attributes: { exclude: ['tokenHash'] } },
  }
);

module.exports = ApiToken;
