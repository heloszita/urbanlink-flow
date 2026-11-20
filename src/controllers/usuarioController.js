const bcrypt = require('bcrypt');
const { Op, UniqueConstraintError } = require('sequelize');
const { Usuario, Veiculo } = require('../models');
const { asyncHandler, erroHttp, texto, paginacao } = require('../utils/http');

const listar = asyncHandler(async (req, res) => {
  const { pagina, limite, offset } = paginacao(req.query);
  const where = {};
  if (req.query.perfil) where.perfil = req.query.perfil;
  if (req.query.aprovado !== undefined) where.aprovado = req.query.aprovado === 'true';
  if (req.query.busca) {
    const busca = `%${texto(req.query.busca, 100)}%`;
    where[Op.or] = [{ nome: { [Op.like]: busca } }, { email: { [Op.like]: busca } }];
  }
  const resultado = await Usuario.findAndCountAll({ where, limit: limite, offset, order: [['createdAt', 'DESC']] });
  res.json({
    dados: resultado.rows,
    total: resultado.count,
    pagina,
    limite,
    totalPaginas: Math.ceil(resultado.count / limite)
  });
});


const detalhar = asyncHandler(async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw erroHttp(404, 'Usuário não encontrado.');
  res.json({ usuario });
});

// Apenas gestores autenticados podem baixar/visualizar o documento da CNH.
const visualizarCnh = asyncHandler(async (req, res) => {
  const usuario = await Usuario.unscoped().findByPk(req.params.id, {
    attributes: ['id', 'perfil', 'documento_cnh']
  });
  if (!usuario || usuario.perfil !== 'Motorista') throw erroHttp(404, 'Motorista não encontrado.');
  const match = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(usuario.documento_cnh || '');
  if (!match) throw erroHttp(404, 'CNH não anexada ou com formato inválido.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 1024 * 1024) throw erroHttp(422, 'Documento da CNH acima do limite permitido.');
  const contentType = match[1].toLowerCase();
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `inline; filename="cnh-${usuario.id}.${ext}"`);
  res.type(contentType).send(bytes);
});

const meuPerfil = asyncHandler(async (req, res) => {
  const usuario = await Usuario.findByPk(req.usuario.id);
  res.json({ usuario });
});

const atualizarMeuPerfil = asyncHandler(async (req, res) => {
  const usuario = await Usuario.findByPk(req.usuario.id);
  if (!usuario) throw erroHttp(404, 'Usuário não encontrado.');
  let dadosCnhAlterados = false;
  for (const campo of ['telefone', 'cep', 'endereco_coleta', 'cnh']) {
    if (req.body[campo] === undefined) continue;
    if (campo === 'cnh' && usuario.perfil !== 'Motorista') throw erroHttp(403, 'Somente motoristas podem alterar a CNH.');
    const valor = texto(req.body[campo], campo === 'endereco_coleta' ? 255 : 40) || null;
    if (campo === 'cnh' && valor !== usuario.cnh) dadosCnhAlterados = true;
    usuario[campo] = valor;
  }
  if (req.body.documento_cnh !== undefined) {
    if (usuario.perfil !== 'Motorista') throw erroHttp(403, 'Somente motoristas podem alterar a CNH.');
    const documento = String(req.body.documento_cnh || '');
    const match = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(documento);
    if (documento && (!match || Buffer.from(match[3], 'base64').length > 1024 * 1024)) {
      throw erroHttp(422, 'Envie a CNH em JPG, PNG, WEBP ou PDF, com até 1 MB.');
    }
    // O scope padrão oculta o documento; consulte o registro completo apenas para comparar.
    const original = await Usuario.unscoped().findByPk(usuario.id, { attributes: ['documento_cnh'] });
    if (documento !== (original.documento_cnh || '')) dadosCnhAlterados = true;
    usuario.documento_cnh = documento || null;
  }
  if (dadosCnhAlterados) usuario.aprovado = false;
  await usuario.save();
  res.json({ mensagem: dadosCnhAlterados ? 'CNH atualizada. Uma nova aprovação do gestor é necessária.' : 'Perfil atualizado.', usuario: await Usuario.findByPk(usuario.id) });
});

const criarGestor = asyncHandler(async (req, res) => {
  const nome = texto(req.body.nome, 120);
  const email = texto(req.body.email, 160).toLowerCase();
  const senha = String(req.body.senha || '');
  if (!nome || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 8) {
    throw erroHttp(422, 'Informe nome, e-mail válido e senha com no mínimo 8 caracteres.');
  }
  try {
    const usuario = await Usuario.create({
      nome, email, senha_hash: await bcrypt.hash(senha, 12), perfil: 'Gestor', aprovado: true
    });
    const { senha_hash: _senhaHash, ...dadosPublicos } = usuario.get({ plain: true });
    res.status(201).json({ mensagem: 'Gestor cadastrado.', usuario: dadosPublicos });
  } catch (erro) {
    if (erro instanceof UniqueConstraintError) throw erroHttp(409, 'Já existe uma conta com esse e-mail.');
    throw erro;
  }
});

const atualizarAprovacao = asyncHandler(async (req, res) => {
  const usuario = await Usuario.unscoped().findByPk(req.params.id, { attributes: { exclude: ['senha_hash'] } });
  if (!usuario || usuario.perfil !== 'Motorista') throw erroHttp(404, 'Motorista não encontrado.');
  if (typeof req.body.aprovado !== 'boolean') throw erroHttp(422, 'Informe aprovado como true ou false.');
  if (req.body.aprovado) {
    const veiculo = await Veiculo.findOne({ where: { motorista_id: usuario.id } });
    if (!usuario.cnh || !usuario.documento_cnh || !veiculo) {
      throw erroHttp(409, 'Para aprovar, o motorista precisa informar CNH, anexar o documento e cadastrar um veículo.');
    }
  }
  await usuario.update({ aprovado: req.body.aprovado });
  res.json({ mensagem: usuario.aprovado ? 'Motorista aprovado.' : 'Aprovação do motorista removida.', usuario: await Usuario.findByPk(usuario.id) });
});

const desativar = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.usuario.id) throw erroHttp(422, 'Você não pode desativar a própria conta.');
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw erroHttp(404, 'Usuário não encontrado.');
  await usuario.update({ ativo: false });
  res.json({ mensagem: 'Conta desativada. O histórico foi preservado.' });
});

module.exports = { listar, detalhar, visualizarCnh, meuPerfil, atualizarMeuPerfil, criarGestor, atualizarAprovacao, desativar };
