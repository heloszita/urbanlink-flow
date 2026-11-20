const { Op, UniqueConstraintError } = require('sequelize');
const { Veiculo, Usuario, PosicaoVeiculo, Entrega, EventoEntrega } = require('../models');
const sequelize = require('../config/database');
const { asyncHandler, erroHttp, texto, numeroPositivo, paginacao } = require('../utils/http');

function normalizarPlaca(valor) {
  return texto(valor, 10).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

const STATUS_ENTREGA_ATIVA = ['Aguardando coleta', 'Em trânsito', 'Saiu para entrega', 'Problema'];

async function entregasAtivasDoCliente(usuarioId, veiculoId = null) {
  return Entrega.findAll({ where: {
    cliente_id: usuarioId, status: { [Op.in]: STATUS_ENTREGA_ATIVA },
    veiculo_id: veiculoId == null ? { [Op.ne]: null } : veiculoId
  } });
}

async function verificarAcessoVeiculo(veiculo, usuario) {
  if (usuario.perfil === 'Motorista' && Number(veiculo.motorista_id) !== usuario.id) {
    throw erroHttp(403, 'Você só pode acessar seu próprio veículo.');
  }
  if (usuario.perfil === 'Cliente') {
    const entregas = await entregasAtivasDoCliente(usuario.id, veiculo.id);
    if (!entregas.length) throw erroHttp(403, 'Este veículo não está associado a uma entrega ativa da sua conta.');
    return entregas;
  }
  return [];
}

const listar = asyncHandler(async (req, res) => {
  const { pagina, limite, offset } = paginacao(req.query);
  const where = req.usuario.perfil === 'Motorista' ? { motorista_id: req.usuario.id } : {};
  if (req.usuario.perfil === 'Cliente') {
    const entregas = await entregasAtivasDoCliente(req.usuario.id);
    where.id = { [Op.in]: [...new Set(entregas.map(e => e.veiculo_id))] };
  }
  if (req.query.status) where.status = req.query.status;
  if (req.query.busca) where.placa = { [Op.like]: `%${normalizarPlaca(req.query.busca)}%` };
  const resultado = await Veiculo.findAndCountAll({
    where, limit: limite, offset, order: [['createdAt', 'DESC']],
    include: [{ model: Usuario, as: 'motorista', attributes: ['id', 'nome'] }]
  });
  res.json({ dados: resultado.rows, total: resultado.count, pagina, limite, totalPaginas: Math.ceil(resultado.count / limite) });
});

async function criarRegistro(dados, motoristaId = null) {
  const placa = normalizarPlaca(dados.placa);
  const modelo = texto(dados.modelo, 100);
  const tipo = texto(dados.tipo, 20);
  if (!placa || !modelo || !tipo) throw erroHttp(422, 'Informe placa, modelo e tipo do veículo.');
  if (!['Moto', 'Carro', 'Van', 'Caminhão', 'Elétrico'].includes(tipo)) throw erroHttp(422, 'Tipo de veículo inválido.');
  const capacidade = numeroPositivo(dados.capacidade_kg ?? 0, 'capacidade');
  try {
    return await Veiculo.create({
      placa, modelo, tipo, motorista_id: motoristaId,
      cor: texto(dados.cor, 40) || null,
      ano: dados.ano ? Number(dados.ano) : null,
      tipo_combustivel: texto(dados.tipo_combustivel, 40) || null,
      capacidade_kg: capacidade,
      volume_m3: numeroPositivo(dados.volume_m3, 'volume'),
      capacidade_tanque_l: numeroPositivo(dados.capacidade_tanque_l, 'capacidade do tanque'),
      status: 'Disponivel'
    });
  } catch (erro) {
    if (erro instanceof UniqueConstraintError) throw erroHttp(409, 'Já existe um veículo cadastrado com essa placa.');
    throw erro;
  }
}

const cadastrar = asyncHandler(async (req, res) => {
  const veiculo = await criarRegistro(req.body);
  res.status(201).json({ mensagem: 'Veículo cadastrado.', veiculo });
});

const cadastrarMeuVeiculo = asyncHandler(async (req, res) => {
  const motorista = await Usuario.findByPk(req.usuario.id);
  if (motorista.perfil !== 'Motorista') throw erroHttp(403, 'Somente motoristas podem cadastrar seu próprio veículo nesta etapa.');
  const existente = await Veiculo.findOne({ where: { motorista_id: motorista.id } });
  if (existente) throw erroHttp(409, 'Este motorista já possui um veículo vinculado. Solicite a alteração ao gestor.');
  const veiculo = await criarRegistro(req.body, motorista.id);
  res.status(201).json({ mensagem: 'Veículo cadastrado. Seu perfil continuará pendente até a aprovação do gestor.', veiculo });
});

const detalhar = asyncHandler(async (req, res) => {
  const veiculo = await Veiculo.findOne({
    where: {
      id: req.params.id,
      ...(req.usuario.perfil === 'Motorista' ? { motorista_id: req.usuario.id } : {})
    },
    include: [{ model: Usuario, as: 'motorista', attributes: ['id', 'nome', 'email'] }]
  });
  if (!veiculo) throw erroHttp(404, 'Veículo não encontrado.');
  await verificarAcessoVeiculo(veiculo, req.usuario);
  res.json({ veiculo });
});

const atualizar = asyncHandler(async (req, res) => {
  const veiculo = await sequelize.transaction(async transaction => {
    const atual = await Veiculo.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!atual) throw erroHttp(404, 'Veículo não encontrado.');
    const campos = ['modelo', 'cor', 'ano', 'tipo', 'tipo_combustivel', 'capacidade_kg', 'volume_m3', 'capacidade_tanque_l', 'status'];
    if (req.body.status !== undefined) {
      if (!['Disponivel', 'Em Rota', 'Manutencao'].includes(req.body.status)) throw erroHttp(422, 'Status de veículo inválido.');
      if (req.body.status !== 'Em Rota') {
        const ativas = await Entrega.count({ where: {
          veiculo_id: atual.id, status: { [Op.notIn]: ['Entregue', 'Cancelada'] }
        }, transaction });
        if (ativas) throw erroHttp(409, 'Não é possível liberar ou colocar em manutenção um veículo com entrega ativa.');
      }
    }
    for (const campo of campos) if (req.body[campo] !== undefined) atual[campo] = req.body[campo];
    if (req.body.placa !== undefined) atual.placa = normalizarPlaca(req.body.placa);
    await atual.save({ transaction });
    return atual;
  }).catch(erro => {
    if (erro instanceof UniqueConstraintError) throw erroHttp(409, 'Já existe um veículo com essa placa.');
    throw erro;
  });
  res.json({ mensagem: 'Veículo atualizado.', veiculo });
});

const excluir = asyncHandler(async (req, res) => {
  const veiculo = await Veiculo.findByPk(req.params.id);
  if (!veiculo) throw erroHttp(404, 'Veículo não encontrado.');
  const ativas = await Entrega.count({
    where: { veiculo_id: veiculo.id, status: { [Op.notIn]: ['Entregue', 'Cancelada'] } }
  });
  if (ativas) throw erroHttp(409, 'O veículo possui entregas em aberto e não pode ser removido.');
  await veiculo.destroy();
  res.json({ mensagem: 'Veículo removido.' });
});

const registrarPosicao = asyncHandler(async (req, res) => {
  if (req.usuario.perfil === 'Motorista' && !req.usuario.aprovado) {
    throw erroHttp(403, 'Aguarde a aprovação do seu cadastro antes de compartilhar a localização.');
  }
  const veiculo = await Veiculo.findByPk(req.params.id);
  if (!veiculo) throw erroHttp(404, 'Veículo não encontrado.');
  if (req.usuario.perfil === 'Motorista' && Number(veiculo.motorista_id) !== req.usuario.id) {
    throw erroHttp(403, 'Você só pode atualizar a posição do veículo vinculado à sua conta.');
  }
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw erroHttp(422, 'Informe latitude e longitude válidas.');
  }
  if (req.body.status !== undefined) throw erroHttp(422, 'Atualize o status pela API de gestão de veículos, não pelo GPS.');
  const posicao = await PosicaoVeiculo.create({
    veiculo_id: veiculo.id,
    latitude,
    longitude,
    velocidade_kmh: numeroPositivo(req.body.velocidade_kmh, 'velocidade')
  });
  res.status(201).json({ mensagem: 'Posição registrada.', posicao });
});

const listarPosicoes = asyncHandler(async (req, res) => {
  const veiculo = await Veiculo.findByPk(req.params.id);
  if (!veiculo) throw erroHttp(404, 'Veículo não encontrado.');
  const entregas = await verificarAcessoVeiculo(veiculo, req.usuario);
  const where = { veiculo_id: veiculo.id };
  let limite = 100;
  if (req.usuario.perfil === 'Cliente') {
    // Nunca revelar trajetos de entregas anteriores: somente a última posição
    // registrada após a atribuição da entrega ativa do cliente.
    const eventos = await Promise.all(entregas.map(e => EventoEntrega.findOne({
      where: { entrega_id: e.id, descricao: { [Op.like]: 'Entrega atribuída ao motorista%' } },
      order: [['createdAt', 'DESC']]
    })));
    const atribuicoes = eventos.filter(Boolean);
    if (!atribuicoes.length) return res.json({ dados: [] });
    where.registrada_em = { [Op.gte]: new Date(Math.max(...atribuicoes.map(e => new Date(e.createdAt).getTime()))) };
    limite = 1;
  }
  const posicoes = await PosicaoVeiculo.findAll({
    where, order: [['registrada_em', 'DESC']], limit: limite
  });
  res.json({ dados: posicoes });
});

module.exports = { listar, cadastrar, cadastrarMeuVeiculo, detalhar, atualizar, excluir, registrarPosicao, listarPosicoes };
