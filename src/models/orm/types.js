const { DataTypes } = require('sequelize');

// DECIMAL llega como string desde Postgres: lo exponemos como número
const decimal = (field) => ({
  type: DataTypes.DECIMAL(12, 2),
  get() {
    const value = this.getDataValue(field);
    return value === null || value === undefined ? null : Number(value);
  },
});

module.exports = { decimal };
