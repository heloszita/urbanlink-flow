const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Veiculo = sequelize.define('Veiculo', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  placa: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  modelo: { type: DataTypes.STRING(100), allowNull: false },
  cor: { type: DataTypes.STRING(40), allowNull: true },
  ano: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1980, max: 2100 } },
  tipo: { type: DataTypes.ENUM('Moto', 'Carro', 'Van', 'Caminhão', 'Elétrico'), allowNull: false },
  tipo_combustivel: { type: DataTypes.STRING(40), allowNull: true },
  capacidade_kg: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  volume_m3: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
  capacidade_tanque_l: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  status: { type: DataTypes.ENUM('Disponivel', 'Em Rota', 'Manutencao'), allowNull: false, defaultValue: 'Disponivel' }
}, { tableName: 'veiculos', timestamps: true });

module.exports = Veiculo;
