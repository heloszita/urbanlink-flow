const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EventoEntrega = sequelize.define('EventoEntrega', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  status: { type: DataTypes.STRING(40), allowNull: false },
  descricao: { type: DataTypes.STRING(255), allowNull: false }
}, { tableName: 'eventos_entrega', timestamps: true });

module.exports = EventoEntrega;
