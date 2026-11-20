const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true, validate: { isEmail: true } },
  senha_hash: { type: DataTypes.STRING(255), allowNull: false },
  perfil: { type: DataTypes.ENUM('Administrador', 'Gestor', 'Motorista', 'Cliente'), allowNull: false, defaultValue: 'Cliente' },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  aprovado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  cpf_cnpj: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  telefone: { type: DataTypes.STRING(30), allowNull: true },
  cep: { type: DataTypes.STRING(12), allowNull: true },
  endereco_coleta: { type: DataTypes.STRING(255), allowNull: true },
  cnh: { type: DataTypes.STRING(30), allowNull: true },
  documento_cnh: { type: DataTypes.TEXT('long'), allowNull: true }
}, {
  tableName: 'usuarios',
  timestamps: true,
  defaultScope: { attributes: { exclude: ['senha_hash', 'documento_cnh'] } }
});

module.exports = Usuario;
