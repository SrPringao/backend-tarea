const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { decimal } = require('./types');

const Category = sequelize.define(
  'Category',
  {
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(40), allowNull: false },
    color: { type: DataTypes.STRING(7) },
    monthlyLimit: decimal('monthlyLimit'),
  },
  { tableName: 'categories', updatedAt: false }
);

module.exports = Category;
