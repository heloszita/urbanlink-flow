const { Op } = require('sequelize');
const { Entrega, Usuario, Veiculo, EventoEntrega } = require('../models');
const { asyncHandler, erroHttp, texto, paginacao } = require('../utils/http');
const { criarEntrega, alterarStatus, atribuirEntrega } = require('../services/entregaService');
const { geocodificarEndereco } = require('../services/geocodingService');
const sequelize = require('../config/database');

const incluir = [
  { model: Usuario, as: 'cliente', attributes: ['id', 'nome', 'email', 'telefone'] },
  { model: Usuario, as: 'motorista', attributes: ['id', 'nome', 'telefone'] },
  { model: Veiculo, as: 'veiculo', attributes: ['id', 'placa', 'modelo', 'tipo'] },
  { model: EventoEntrega, as: 'eventos', separate: true, order: [['createdAt', 'ASC']] }
];

function escopoUsuario(req) {
  if (req.usuario.perfil === 'Cliente') return { cliente_id: req.usuario.id };
  if (req.usuario.perfil === 'Motorista') return { motorista_id: req.usuario.id };
  return {};
}

const listar = asyncHandler(async (req, res) => {
  const { pagina, limite, offset } = paginacao(req.query);
  const where = { ...escopoUsuario(req) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.busca) {
    const busca = `%${texto(req.query.busca, 100)}%`;
    where[Op.or] = [
      { codigo: { [Op.like]: busca } },
      { destino: { [Op.like]: busca } },
      { destinatario_nome: { [Op.like]: busca } }
    ];
  }
  const resultado = await Entrega.findAndCountAll({
    where, include: incluir, limit: limite, offset,
    order: [['createdAt', 'DESC']], distinct: true
  });
  res.json({
    dados: resultado.rows, total: resultado.count, pagina, limite,
    totalPaginas: Math.ceil(resultado.count / limite)
  });
});

const criar = asyncHandler(async (req, res) => {
  const entrega = await criarEntrega(req.body, req.usuario);
  res.status(201).json({
    mensagem: 'Solicitação registrada. Você já pode acompanhar pelo código do pedido.',
    entrega,
    localizacao: entrega._localizacao || { status: 'nao_encontrado' }
  });
});

const detalhar = asyncHandler(async (req, res) => {
  const entrega = await Entrega.findOne({
    where: { id: req.params.id, ...escopoUsuario(req) }, include: incluir
  });
  if (!entrega) throw erroHttp(404, 'Entrega não encontrada.');
  res.json({ entrega });
});

const atualizarStatus = asyncHandler(async (req, res) => {
  const entrega = await Entrega.findOne({
    where: { id: req.params.id, ...escopoUsuario(req) }
  });
  if (!entrega) throw erroHttp(404, 'Entrega não encontrada.');
  if (req.usuario.perfil === 'Cliente' && req.body.status !== 'Cancelada') {
    throw erroHttp(403, 'O cliente só pode cancelar uma solicitação que ainda não foi despachada.');
  }
  if (req.usuario.perfil === 'Cliente' && !['Pendente', 'Aguardando coleta'].includes(entrega.status)) {
    throw erroHttp(409, 'A entrega já foi despachada e não pode ser cancelada pelo cliente.');
  }
  if (req.usuario.perfil === 'Motorista' && !req.usuario.aprovado) {
    throw erroHttp(403, 'Aguarde a aprovação do seu cadastro.');
  }
  const atualizada = await alterarStatus(entrega, texto(req.body.status, 40), req.usuario, req.body.descricao);
  res.json({ mensagem: 'Status da entrega atualizado.', entrega: atualizada });
});

const corrigirLocalizacao = asyncHandler(async (req, res) => {
  // Rota restrita a Administrador/Gestor no middleware: correção de dados de terceiros.
  const entrega = await Entrega.findByPk(req.params.id);
  if (!entrega) throw erroHttp(404, 'Entrega não encontrada.');
  if (['Entregue','Cancelada'].includes(entrega.status)) throw erroHttp(409, 'Não é possível alterar a localização de uma entrega concluída ou cancelada.');
  const latRaw=req.body?.latitude, lonRaw=req.body?.longitude;
  const manual = latRaw !== undefined || lonRaw !== undefined;
  let latitude,longitude,localizacao;
  if(manual){
    if(latRaw === undefined || lonRaw === undefined || latRaw === null || lonRaw === null || String(latRaw).trim()==='' || String(lonRaw).trim()==='') throw erroHttp(422,'Informe latitude e longitude juntas.');
    latitude=Number(latRaw);longitude=Number(lonRaw);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw erroHttp(422,'Coordenadas inválidas.');
    localizacao={status:'manual',mensagem:'Coordenadas atualizadas manualmente por um gestor.'};
  }else{
    localizacao=await geocodificarEndereco({destino:entrega.destino,bairro:entrega.bairro,cidade:entrega.cidade,cep_entrega:entrega.cep_entrega});
    if(!Number.isFinite(Number(localizacao.latitude)) || !Number.isFinite(Number(localizacao.longitude)) || localizacao.latitude === undefined || localizacao.longitude === undefined){
      throw erroHttp(422,localizacao.mensagem||'Não foi possível localizar o endereço. Informe um ponto manualmente.');
    }
    latitude=Number(localizacao.latitude);longitude=Number(localizacao.longitude);
  }
  await sequelize.transaction(async(transaction)=>{
    await entrega.update({destino_latitude:latitude,destino_longitude:longitude},{transaction});
    await EventoEntrega.create({entrega_id:entrega.id,usuario_id:req.usuario.id,status:entrega.status,
      descricao:manual?'Coordenadas do destino verificadas e ajustadas manualmente.':'Destino geocodificado novamente pelo gestor.'},{transaction});
  });
  res.json({mensagem:localizacao.mensagem,localizacao,entrega:await Entrega.findByPk(entrega.id)});
});

const atribuir = asyncHandler(async (req, res) => {
  const entrega = await Entrega.findByPk(req.params.id);
  if (!entrega) throw erroHttp(404, 'Entrega não encontrada.');
  await atribuirEntrega(entrega, Number(req.body.motorista_id), Number(req.body.veiculo_id), req.usuario);
  res.json({
    mensagem: 'Motorista e veículo atribuídos à entrega.',
    entrega: await Entrega.findByPk(entrega.id, { include: incluir })
  });
});

const excluir = asyncHandler(async (req, res) => {
  const entrega = await Entrega.findByPk(req.params.id);
  if (!entrega) throw erroHttp(404, 'Entrega não encontrada.');
  if (!['Pendente', 'Cancelada'].includes(entrega.status)) {
    throw erroHttp(409, 'Somente entregas pendentes ou canceladas podem ser removidas.');
  }
  await entrega.destroy();
  res.json({ mensagem: 'Entrega removida.' });
});

const rastrear = asyncHandler(async (req, res) => {
  const codigo = texto(req.params.codigo, 24).toUpperCase();
  const email = texto(req.query.email, 160).toLowerCase();
  if (!email) throw erroHttp(422, 'Informe o e-mail da conta que solicitou a entrega.');
  const entrega = await Entrega.findOne({ where: { codigo }, include: incluir });
  if (!entrega || entrega.cliente?.email !== email) {
    throw erroHttp(404, 'Não encontramos uma entrega com esses dados.');
  }
  res.json({ entrega });
});

const exportarCsv = asyncHandler(async (req, res) => {
  if (!['Administrador', 'Gestor'].includes(req.usuario.perfil)) {
    throw erroHttp(403, 'Apenas administradores e gestores podem exportar o relatório geral.');
  }
  const entregas = await Entrega.findAll({
    include: [
      { model: Usuario, as: 'cliente', attributes: ['nome'] },
      { model: Usuario, as: 'motorista', attributes: ['nome'] }
    ],
    order: [['createdAt', 'DESC']]
  });
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [
    ['Código', 'Cliente', 'Destino', 'Motorista', 'Status', 'Criada em'],
    ...entregas.map((e) => [e.codigo, e.cliente?.nome, e.destino, e.motorista?.nome, e.status, e.createdAt.toISOString()])
  ];
  const csv = '\uFEFF' + linhas.map((l) => l.map(escapeCsv).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="urbanlink-entregas.csv"');
  res.send(csv);
});

module.exports = { listar, criar, detalhar, atualizarStatus, corrigirLocalizacao, atribuir, excluir, rastrear, exportarCsv };
