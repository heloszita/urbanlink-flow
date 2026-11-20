const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { UniqueConstraintError } = require('sequelize');
const { segredoValido, conviteAdminValido } = require('../config/segredos');
const { Usuario } = require('../models');
const { asyncHandler, erroHttp, texto } = require('../utils/http');

function tokenPara(usuario) {
  if (!segredoValido(process.env.JWT_SECRET)) {
    throw erroHttp(500, 'JWT_SECRET precisa ter pelo menos 24 caracteres no arquivo .env.');
  }
  return jwt.sign({ id: usuario.id, perfil: usuario.perfil }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
}

const cadastrar = asyncHandler(async (req, res) => {
  const nome = texto(req.body.nome, 120);
  const email = texto(req.body.email, 160).toLowerCase();
  const senha = String(req.body.senha || '');
  const perfil = texto(req.body.perfil || 'Cliente', 30);
  const telefone = texto(req.body.telefone, 30) || null;
  const cpfCnpj = texto(req.body.cpf_cnpj, 20).replace(/[^0-9]/g, '') || null;

  if (!nome || !email || !senha) throw erroHttp(422, 'Informe nome, e-mail e senha.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw erroHttp(422, 'Informe um e-mail válido.');
  if (senha.length < 8) throw erroHttp(422, 'A senha deve ter pelo menos 8 caracteres.');
  if (!['Cliente', 'Motorista', 'Administrador'].includes(perfil)) throw erroHttp(422, 'Perfil de cadastro inválido.');
  if (perfil === 'Administrador') {
    const conviteConfigurado = String(process.env.ADMIN_INVITE_CODE || '').trim();
    const conviteInformado = String(req.body.codigo_convite || '').trim();
    if (!conviteAdminValido(conviteConfigurado)) {
      throw erroHttp(503, 'Cadastro administrativo indisponível: configure ADMIN_INVITE_CODE com um código privado de pelo menos 12 caracteres no servidor e reinicie a aplicação. O código do .env.example não é válido.');
    }
    if (conviteInformado !== conviteConfigurado) {
      throw erroHttp(403, 'Código de administrador incorreto. Verifique o código configurado no servidor (não no .env.example).');
    }
  }
  const documentoCnh = String(req.body.documento_cnh || '');
  if (perfil === 'Motorista') {
    if (!texto(req.body.cnh, 30)) throw erroHttp(422, 'Informe o número da CNH.');
    const arquivoValido = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(documentoCnh);
    if (!arquivoValido) throw erroHttp(422, 'Anexe a CNH em JPG, PNG, WEBP ou PDF antes de criar a conta.');
    const tamanhoBytes = Buffer.from(arquivoValido[3], 'base64').length;
    if (tamanhoBytes > 1024 * 1024) throw erroHttp(422, 'O arquivo da CNH deve ter até 1 MB.');
  }

  try {
    const usuario = await Usuario.create({
      nome,
      email,
      senha_hash: await bcrypt.hash(senha, 12),
      perfil,
      telefone,
      cpf_cnpj: cpfCnpj,
      cep: texto(req.body.cep, 12) || null,
      endereco_coleta: texto(req.body.endereco_coleta, 255) || null,
      cnh: texto(req.body.cnh, 30) || null,
      documento_cnh: perfil === 'Motorista' ? documentoCnh : null,
      aprovado: perfil !== 'Motorista',
      ativo: true
    });
    const token = tokenPara(usuario);
    return res.status(201).json({
      mensagem: perfil === 'Motorista'
        ? 'Cadastro criado com a CNH anexada. Seu perfil está pendente de análise e aprovação do administrador. Na próxima etapa, informe os dados do veículo para concluir a inscrição.'
        : 'Conta criada com sucesso.',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, aprovado: usuario.aprovado }
    });
  } catch (erro) {
    if (erro instanceof UniqueConstraintError) throw erroHttp(409, 'Já existe uma conta com esse e-mail ou documento.');
    throw erro;
  }
});

const login = asyncHandler(async (req, res) => {
  const email = texto(req.body.email, 160).toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha) throw erroHttp(422, 'Informe e-mail e senha.');
  const usuario = await Usuario.unscoped().findOne({ where: { email } });
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ mensagem: 'E-mail ou senha inválidos.' });
  }
  if (!usuario.ativo) return res.status(403).json({ mensagem: 'Sua conta está desativada. Entre em contato com o administrador.' });
  const perfilEsperado = texto(req.body.perfil, 30);
  if (perfilEsperado && perfilEsperado !== usuario.perfil) {
    return res.status(403).json({
      mensagem: `Esta tela é destinada ao perfil ${perfilEsperado}. Seu perfil cadastrado é ${usuario.perfil}.`
    });
  }
  return res.status(200).json({
    mensagem: 'Login realizado com sucesso.',
    token: tokenPara(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, aprovado: usuario.aprovado }
  });
});

module.exports = { cadastrar, login };
