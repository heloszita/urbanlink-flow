const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define a tabela 'veiculos' no MySQL para a UrbanLink Flow
const Veiculo = sequelize.define('Veiculo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  placa: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Não permite duas placas iguais no sistema
  },
  tipo_combustivel: {
    type: DataTypes.STRING,
    allowNull: false // Ex: 'Diesel', 'Elétrico', 'Flex'
  },
  capacidade: {
    type: DataTypes.NUMERIC,
    allowNull: false // Capacidade de carga (ex: em kg ou m³)
  },
  status: {
    type: DataTypes.ENUM('Disponivel', 'Em Rota', 'Manutencao'),
    allowNull: false,
    defaultValue: 'Disponivel' // Todo veículo novo entra como disponível
  }
}, {
  tableName: 'veiculos'
});

module.exports = Veiculo;