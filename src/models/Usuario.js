// Importamos os tipos de dados do Sequelize (STRING, ENUM, BOOLEAN, etc.)
const { DataTypes } = require('sequelize');

// Importamos a conexão do banco criada no Módulo 1 (database.js)
const sequelize = require('../config/database');

// Criamos a tabela de usuários adaptada para o UrbanLink Flow
const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Gera IDs 1, 2, 3... automaticamente
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false // Obrigatório preencher o nome
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Impede dois cadastros com o mesmo e-mail
  },
  senha_hash: {
    type: DataTypes.STRING,
    allowNull: false // Guardará a senha criptografada pelo bcrypt
  },
  perfil: {
    // Enum com os 4 perfis exigidos pelo Guia do UrbanLink Flow
    type: DataTypes.ENUM('Administrador', 'Gestor', 'Motorista', 'Cliente'),
    allowNull: false,
    defaultValue: 'Cliente'
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true // Permite desativar usuários mantendo o histórico
  }
}, {
  tableName: 'usuarios' // Nome exato da tabela no MySQL
});

module.exports = Usuario;