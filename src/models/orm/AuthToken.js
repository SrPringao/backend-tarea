const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

// Tokens de un solo uso (verificación de correo, recuperación de contraseña, refresh). Solo guarda el hash.
const AuthToken = sequelize.define(
  'AuthToken',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    purpose: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [['verify_email', 'reset_password', 'refresh']] } },
    tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
    attempts: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE },
  },
  { tableName: 'auth_tokens', updatedAt: false }
);

module.exports = AuthToken;
