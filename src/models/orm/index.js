// Modelos Sequelize (ORM), uno por archivo. Mapean tablas ya creadas por database/schema.sql;
// nunca se usa sequelize.sync() para que el esquema SQL sea la única fuente de verdad.
// Aquí solo se registran las relaciones y se exportan todos los modelos juntos.
const { sequelize } = require('../../config/database');
const User = require('./User');
const UserPreference = require('./UserPreference');
const Account = require('./Account');
const Category = require('./Category');
const Contact = require('./Contact');
const AuthToken = require('./AuthToken');
const RevokedToken = require('./RevokedToken');
const Device = require('./Device');
const ApiToken = require('./ApiToken');
const CardNameMapping = require('./CardNameMapping');
const NotificationLog = require('./NotificationLog');

// Relaciones
User.hasOne(UserPreference, { foreignKey: 'userId', as: 'preferences', onDelete: 'CASCADE' });
UserPreference.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Account, { foreignKey: 'userId', as: 'accounts', onDelete: 'CASCADE' });
Account.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Category, { foreignKey: 'userId', as: 'categories', onDelete: 'CASCADE' });
Category.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Contact, { foreignKey: 'userId', as: 'contacts', onDelete: 'CASCADE' });
Contact.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AuthToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Device, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(ApiToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(CardNameMapping, { foreignKey: 'userId', onDelete: 'CASCADE' });
CardNameMapping.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

module.exports = {
  sequelize,
  User,
  UserPreference,
  Account,
  Category,
  Contact,
  AuthToken,
  RevokedToken,
  Device,
  ApiToken,
  CardNameMapping,
  NotificationLog,
};
