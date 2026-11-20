const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Chamado = sequelize.define('Chamado', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  assunto: { type: DataTypes.STRING(120), allowNull: false },
  mensagem: { type: DataTypes.TEXT, allowNull: false },
  resposta: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('Aberto', 'Em atendimento', 'Resolvido'), allowNull: false, defaultValue: 'Aberto' }
}, { tableName: 'chamados', timestamps: true });

module.exports = Chamado;
