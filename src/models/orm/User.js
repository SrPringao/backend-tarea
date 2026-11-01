const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue('email', String(value).trim().toLowerCase());
      },
    },
    displayName: { type: DataTypes.STRING(80), allowNull: false },
    passwordHash: { type: DataTypes.TEXT, allowNull: false },
    role: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'user', validate: { isIn: [['user', 'admin']] } },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    emailVerifiedAt: { type: DataTypes.DATE },
  },
  {
    tableName: 'users',
    // El hash nunca sale en consultas normales; para el login se usa User.unscoped()
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
  }
);

User.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

module.exports = User;
