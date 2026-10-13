// Modelos Sequelize (ORM). Mapean tablas ya creadas por database/schema.sql;
// nunca se usa sequelize.sync() para que el esquema SQL sea la única fuente de verdad.
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

// DECIMAL llega como string desde Postgres: lo exponemos como número
const decimal = (field) => ({
  type: DataTypes.DECIMAL(12, 2),
  get() {
    const value = this.getDataValue(field);
    return value === null || value === undefined ? null : Number(value);
  },
});

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

const Account = sequelize.define(
  'Account',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(60), allowNull: false },
    type: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['credit', 'debit', 'cash']] } },
    color: { type: DataTypes.STRING(7) },
    paymentDay: { type: DataTypes.SMALLINT, validate: { min: 1, max: 31 } },
    creditLimit: decimal('creditLimit'),
    archivedAt: { type: DataTypes.DATE },
  },
  { tableName: 'accounts' }
);

const Category = sequelize.define(
  'Category',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(40), allowNull: false },
    color: { type: DataTypes.STRING(7) },
  },
  { tableName: 'categories', updatedAt: false }
);

const Contact = sequelize.define(
  'Contact',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(60), allowNull: false },
    nameKey: { type: DataTypes.STRING(60), allowNull: false },
    archivedAt: { type: DataTypes.DATE },
  },
  { tableName: 'contacts', updatedAt: false }
);

// Relaciones
User.hasOne(UserPreference, { foreignKey: 'userId', as: 'preferences', onDelete: 'CASCADE' });
UserPreference.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Account, { foreignKey: 'userId', as: 'accounts', onDelete: 'CASCADE' });
Account.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Category, { foreignKey: 'userId', as: 'categories', onDelete: 'CASCADE' });
Category.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Contact, { foreignKey: 'userId', as: 'contacts', onDelete: 'CASCADE' });
Contact.belongsTo(User, { foreignKey: 'userId' });

module.exports = { sequelize, User, UserPreference, Account, Category, Contact };
