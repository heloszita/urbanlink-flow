const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rota = sequelize.define('Rota', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  status: { type: DataTypes.ENUM('Planejada', 'Em andamento', 'Concluída', 'Cancelada'), allowNull: false, defaultValue: 'Planejada' },
  entrega_ids: { type: DataTypes.JSON, allowNull: false },
  distancia_total_km: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  tempo_estimado_min: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  velocidade_media_kmh: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 30 },
  origem_latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  origem_longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false }
}, { tableName: 'rotas', timestamps: true });

module.exports = Rota;
