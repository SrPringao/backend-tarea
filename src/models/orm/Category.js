const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Category = sequelize.define(
  'Category',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(40), allowNull: false },
    color: { type: DataTypes.STRING(7) },
  },
  { tableName: 'categories', updatedAt: false }
);

module.exports = Category;
