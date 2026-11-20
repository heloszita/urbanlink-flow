const { Simulacao, Entrega, Usuario } = require('../models');
const { asyncHandler, erroHttp, texto, paginacao } = require('../utils/http');
const { otimizarParadas } = require('../utils/rotaMath');
const { calcularCenario } = require('../utils/simulacaoMath');

const listar = asyncHandler(async (req, res) => {
  const { pagina, limite, offset } = paginacao(req.query);
  const resultado = await Simulacao.findAndCountAll({
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nome'] }],
    order: [['createdAt', 'DESC']], limit: limite, offset
  });
  res.json({ dados: resultado.rows, total: resultado.count, pagina, limite, totalPaginas: Math.ceil(resultado.count / limite) });
});

const detalhar = asyncHandler(async (req, res) => {
  const simulacao = await Simulacao.findByPk(req.params.id, {
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nome'] }]
  });
  if (!simulacao) throw erroHttp(404, 'Simulação não encontrada.');
  res.json({ simulacao });
});

const criar = asyncHandler(async (req, res) => {
  const nome = texto(req.body.nome, 120) || `Cenário ${new Date().toLocaleDateString('pt-BR')}`;
  const ids = Array.isArray(req.body.entrega_ids) ? [...new Set(req.body.entrega_ids.map(Number))] : [];
  if (!ids.length || ids.length > 50 || ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw erroHttp(422, 'Selecione de 1 a 50 entregas válidas para simular.');
  }
  const origem = req.body.origem || {};
  const latitude = origem.latitude === undefined || origem.latitude === null || origem.latitude === '' ? NaN : Number(origem.latitude);
  const longitude = origem.longitude === undefined || origem.longitude === null || origem.longitude === '' ? NaN : Number(origem.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw erroHttp(422, 'Informe latitude e longitude válidas para o ponto de partida.');
  }

  const entregas = await Entrega.findAll({ where: { id: ids } });
  if (entregas.length !== ids.length) throw erroHttp(404, 'Uma ou mais entregas não foram encontradas.');
  const elegiveis = entregas.filter(e => !['Entregue', 'Cancelada'].includes(e.status));
  if (elegiveis.length !== ids.length) throw erroHttp(422, 'A simulação aceita apenas entregas que ainda não foram concluídas ou canceladas.');
  const ordenacao = otimizarParadas({ latitude, longitude }, elegiveis);
  const resultado = calcularCenario({
    distanciaKm: ordenacao.distancia,
    velocidadeBaseKmh: req.body.velocidade_base_kmh ?? 30,
    fatorCongestionamento: req.body.fator_congestionamento ?? 1
  });

  const simulacao = await Simulacao.create({
    nome,
    usuario_id: req.usuario.id,
    entrega_ids: ordenacao.ordem.map(p => p.entrega.id),
    origem_latitude: latitude,
    origem_longitude: longitude,
    velocidade_base_kmh: Number(req.body.velocidade_base_kmh ?? 30),
    fator_congestionamento: Number(req.body.fator_congestionamento ?? 1),
    ...resultado
  });
  res.status(201).json({
    mensagem: 'Cenário simulado e salvo.',
    simulacao,
    paradas: ordenacao.ordem.map((p, i) => ({ ordem: i + 1, entrega: p.entrega }))
  });
});

const excluir = asyncHandler(async (req, res) => {
  const simulacao = await Simulacao.findByPk(req.params.id);
  if (!simulacao) throw erroHttp(404, 'Simulação não encontrada.');
  await simulacao.destroy();
  res.json({ mensagem: 'Simulação removida.' });
});

module.exports = { listar, detalhar, criar, excluir };
