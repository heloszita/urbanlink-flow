const { Chamado, Usuario } = require('../models');
const { asyncHandler, erroHttp, texto, paginacao } = require('../utils/http');

const criar = asyncHandler(async (req, res) => {
  const assunto = texto(req.body.assunto, 120);
  const mensagem = texto(req.body.mensagem, 3000);
  if (!assunto || mensagem.length < 8) {
    throw erroHttp(422, 'Informe o assunto e descreva a solicitação com pelo menos 8 caracteres.');
  }
  const chamado = await Chamado.create({ usuario_id: req.usuario.id, assunto, mensagem });
  res.status(201).json({ mensagem: 'Chamado enviado ao atendimento.', chamado });
});

const listar = asyncHandler(async (req, res) => {
  const { pagina, limite, offset } = paginacao(req.query);
  const gerente = ['Administrador', 'Gestor'].includes(req.usuario.perfil);
  const where = gerente ? {} : { usuario_id: req.usuario.id };
  const perfil = gerente && req.query.perfil === 'Cliente' ? 'Cliente' : null;
  const resultado = await Chamado.findAndCountAll({
    where,
    include: [{ model: Usuario, as: 'usuario',
      attributes: ['id', 'nome', 'email', 'perfil'],
      ...(perfil ? { where: { perfil }, required: true } : {}) }],
    order: [['createdAt', 'DESC']], limit: limite, offset, distinct: true
  });
  res.json({ dados: resultado.rows, total: resultado.count, pagina, limite, totalPaginas: Math.ceil(resultado.count / limite) });
});

const responder = asyncHandler(async (req, res) => {
  const chamado = await Chamado.findByPk(req.params.id);
  if (!chamado) throw erroHttp(404, 'Chamado não encontrado.');
  const resposta = texto(req.body.resposta, 3000);
  if (!resposta) throw erroHttp(422, 'Informe a resposta do chamado.');
  const status = req.body.status || 'Em atendimento';
  if (!['Em atendimento', 'Resolvido'].includes(status)) throw erroHttp(422, 'Status de chamado inválido.');
  await chamado.update({ resposta, status });
  res.json({ mensagem: 'Chamado atualizado.', chamado });
});

module.exports = { criar, listar, responder };
