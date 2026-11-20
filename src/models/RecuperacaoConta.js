const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('RecuperacaoConta', {
  usuario_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    references: { model: 'usuarios', key: 'id' },
    onDelete: 'CASCADE'
  },
  codigo_hash: { type: DataTypes.CHAR(64), allowNull: true, unique: true },
  senha_redefinida_em: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'recuperacao_conta', timestamps: false });
