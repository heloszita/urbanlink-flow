const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PosicaoVeiculo = sequelize.define('PosicaoVeiculo', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  velocidade_kmh: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  registrada_em: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: 'posicoes_veiculo', timestamps: false, indexes: [{ fields: ['veiculo_id', 'registrada_em'] }] });

module.exports = PosicaoVeiculo;
