const express = require('express');
const { Op } = require('sequelize');
const { Entrega, Usuario, Veiculo, Chamado } = require('../models');
const autenticar = require('../middlewares/auth');
const { asyncHandler } = require('../utils/http');
const router = express.Router();

router.get('/dashboard/resumo', autenticar, asyncHandler(async (req, res) => {
  const escopo = req.usuario.perfil === 'Cliente'
    ? { cliente_id: req.usuario.id }
    : req.usuario.perfil === 'Motorista' ? { motorista_id: req.usuario.id } : {};
  const total = await Entrega.count({ where: escopo });
  const emAndamento = await Entrega.count({
    where: { ...escopo, status: { [Op.in]: ['Aguardando coleta', 'Em trânsito', 'Saiu para entrega'] } }
  });
  const entregues = await Entrega.count({ where: { ...escopo, status: 'Entregue' } });
  const pendentes = await Entrega.count({ where: { ...escopo, status: 'Pendente' } });
  const resultado = { total, em_andamento: emAndamento, entregues, pendentes };
  if (['Administrador', 'Gestor'].includes(req.usuario.perfil)) {
    resultado.veiculos_disponiveis = await Veiculo.count({ where: { status: 'Disponivel' } });
    resultado.motoristas_pendentes = await Usuario.count({ where: { perfil: 'Motorista', aprovado: false, ativo: true } });
    resultado.chamados_abertos = await Chamado.count({ where: { status: { [Op.ne]: 'Resolvido' } } });
  }
  res.json(resultado);
}));

module.exports = router;
