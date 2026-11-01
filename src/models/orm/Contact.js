const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

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

module.exports = Contact;
