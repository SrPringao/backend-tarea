const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { decimal } = require('./types');

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

module.exports = Account;
