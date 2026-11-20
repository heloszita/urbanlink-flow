const { DataTypes } = require('sequelize');
const { randomBytes } = require('crypto');
const sequelize = require('../config/database');

const Entrega = sequelize.define('Entrega', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(24), allowNull: false, unique: true },
  origem: { type: DataTypes.STRING(255), allowNull: false },
  origem_latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  origem_longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  destino: { type: DataTypes.STRING(255), allowNull: false },
  destino_latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  destino_longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  cep_entrega: { type: DataTypes.STRING(12), allowNull: true },
  bairro: { type: DataTypes.STRING(100), allowNull: true },
  cidade: { type: DataTypes.STRING(100), allowNull: true },
  destinatario_nome: { type: DataTypes.STRING(120), allowNull: false },
  destinatario_telefone: { type: DataTypes.STRING(30), allowNull: true },
  tipo_veiculo: { type: DataTypes.ENUM('Moto', 'Carro', 'Van', 'Caminhão', 'Elétrico'), allowNull: false },
  tipo_carga: { type: DataTypes.STRING(80), allowNull: true },
  quantidade_volumes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  peso_kg: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  volume_m3: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
  janela_inicio: { type: DataTypes.STRING(5), allowNull: true },
  janela_fim: { type: DataTypes.STRING(5), allowNull: true },
  observacoes: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('Pendente', 'Aguardando coleta', 'Em trânsito', 'Saiu para entrega', 'Entregue', 'Problema', 'Cancelada'), allowNull: false, defaultValue: 'Pendente' },
  distancia_km: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  tempo_estimado_min: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }
}, {
  tableName: 'entregas',
  timestamps: true,
  indexes: [{ fields: ['status'] }, { fields: ['cliente_id'] }, { fields: ['motorista_id'] }]
});

Entrega.beforeValidate((entrega) => {
  if (!entrega.codigo) {
    const parteAleatoria = randomBytes(6).toString('hex').toUpperCase();
    entrega.codigo = `UL-${new Date().getFullYear()}-${parteAleatoria}`;
  }
});

module.exports = Entrega;
