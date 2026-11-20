const { Rota, Usuario } = require('../models');
const { asyncHandler, erroHttp, paginacao } = require('../utils/http');
const { criarRota, obterOrigemMotorista } = require('../services/rotaService');

const otimizar = asyncHandler(async (req, res) => {
  const motoristaId = req.usuario.perfil === 'Motorista'
    ? req.usuario.id
    : (req.body.motorista_id ? Number(req.body.motorista_id) : null);
  if (req.usuario.perfil === 'Motorista' && !req.usuario.aprovado) {
    throw erroHttp(403, 'Seu cadastro ainda aguarda aprovação.');
  }
  let origem = req.body.origem;
  if ((!origem || origem.latitude == null || origem.longitude == null) && motoristaId) {
    origem = await obterOrigemMotorista(motoristaId);
  }
  if ((!origem || origem.latitude == null || origem.longitude == null) &&
      process.env.DEPOT_LAT !== undefined && process.env.DEPOT_LON !== undefined) {
    origem = { latitude: Number(process.env.DEPOT_LAT), longitude: Number(process.env.DEPOT_LON) };
  }
  const resultado = await criarRota({
    entregaIds: req.body.entrega_ids,
    origem,
    velocidadeMedia: req.body.velocidade_media_kmh,
    motoristaId,
    criadorId: req.usuario.id
  });
  res.status(201).json({
    mensagem: 'Rota otimizada pelo método do vizinho mais próximo.',
    ...resultado
  });
});

const minhasRotas = asyncHandler(async (req, res) => {
  const where = req.usuario.perfil === 'Motorista' ? { motorista_id: req.usuario.id } : {};
  const { pagina, limite, offset } = paginacao(req.query);
  const resultado = await Rota.findAndCountAll({
    where,
    include: [{ model: Usuario, as: 'motorista', attributes: ['id', 'nome'] }],
    order: [['createdAt', 'DESC']], limit: limite, offset
  });
  res.json({ dados: resultado.rows, total: resultado.count, pagina, limite, totalPaginas: Math.ceil(resultado.count / limite) });
});

const atualizarStatus = asyncHandler(async (req, res) => {
  const rota = await Rota.findByPk(req.params.id);
  if (!rota) throw erroHttp(404, 'Rota não encontrada.');
  if (req.usuario.perfil === 'Motorista') {
    if (!req.usuario.aprovado) throw erroHttp(403, 'Aguarde a aprovação do seu cadastro.');
    if (Number(rota.motorista_id) !== req.usuario.id) throw erroHttp(403, 'Você não tem acesso a esta rota.');
  }
  const status = req.body.status;
  if (!['Em andamento', 'Concluída', 'Cancelada'].includes(status)) {
    throw erroHttp(422, 'Status de rota inválido.');
  }
  if (status === 'Em andamento' && !rota.motorista_id) {
    throw erroHttp(409, 'A rota só pode começar depois que suas entregas forem atribuídas a um motorista.');
  }
  if (rota.status === 'Planejada' && status === 'Concluída') throw erroHttp(409, 'Inicie a rota antes de concluí-la.');
  if (rota.status === 'Em andamento' && status === 'Em andamento') throw erroHttp(409, 'Esta rota já está em andamento.');
  if (rota.status === 'Concluída' || rota.status === 'Cancelada') {
    throw erroHttp(409, 'Esta rota já foi finalizada.');
  }
  await rota.update({ status });
  res.json({ mensagem: 'Rota atualizada.', rota });
});

module.exports = { otimizar, minhasRotas, atualizarStatus };
