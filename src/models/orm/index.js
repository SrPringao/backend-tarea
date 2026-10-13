// Modelos Sequelize (ORM), uno por archivo. Mapean tablas ya creadas por database/schema.sql;
// nunca se usa sequelize.sync() para que el esquema SQL sea la única fuente de verdad.
// Aquí solo se registran las relaciones y se exportan todos los modelos juntos.
const { sequelize } = require('../../config/database');
const User = require('./User');
const UserPreference = require('./UserPreference');
const Account = require('./Account');
const Category = require('./Category');
const Contact = require('./Contact');

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
