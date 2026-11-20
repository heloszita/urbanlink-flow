const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Veiculo = require('./veiculo');

const PosicaoVeiculo = sequelize.define('PosicaoVeiculo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  latitude: {
    type: DataTypes.NUMERIC,
    allowNull: false
  },
  longitude: {
    type: DataTypes.NUMERIC,
    allowNull: false
  },
  registrada_em: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW // Regista a data/hora exata do envio
  }
}, {
  tableName: 'posicoes_veiculo'
});

// Relacionamento 1 para Vários (Um Veículo tem Várias Posições)
Veiculo.hasMany(PosicaoVeiculo, { foreignKey: 'veiculo_id' });
PosicaoVeiculo.belongsTo(Veiculo, { foreignKey: 'veiculo_id' });

module.exports = PosicaoVeiculo;