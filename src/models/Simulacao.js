const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Simulacao = sequelize.define('Simulacao', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  entrega_ids: { type: DataTypes.JSON, allowNull: false },
  origem_latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  origem_longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  velocidade_base_kmh: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  fator_congestionamento: { type: DataTypes.DECIMAL(4, 2), allowNull: false },
  distancia_total_km: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tempo_base_min: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tempo_simulado_min: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  acrescimo_min: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'simulacoes',
  timestamps: true,
  indexes: [{ fields: ['usuario_id'] }, { fields: ['created_at'] }]
});

module.exports = Simulacao;
