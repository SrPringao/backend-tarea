const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

// JWT revocados al cerrar sesión, identificados por su jti
const RevokedToken = sequelize.define(
  'RevokedToken',
  {
    jti: { type: DataTypes.UUID, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: 'revoked_tokens', createdAt: 'revoked_at', updatedAt: false }
);

module.exports = RevokedToken;
