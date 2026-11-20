const jwt = require('jsonwebtoken');
const { Usuario, RecuperacaoConta } = require('../models');
const { asyncHandler } = require('../utils/http');
const { versaoDaSenha } = require('../utils/credencial');

const autenticar = asyncHandler(async (req, res, next) => {
  const [tipo, token] = String(req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensagem: 'Token não fornecido. Faça login para continuar.' });
  }
  let dados;
  try {
    dados = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_erro) {
    return res.status(401).json({ mensagem: 'Token inválido ou expirado. Faça login novamente.' });
  }
  const usuario = await Usuario.unscoped().findByPk(dados.id, {
    attributes: ['id', 'nome', 'email', 'senha_hash', 'perfil', 'ativo', 'aprovado', 'telefone']
  });
  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ mensagem: 'Conta não encontrada ou desativada.' });
  }
  // Tokens anteriores à atualização seguem válidos até expirar ou até a primeira redefinição.
  const sessaoValida = dados.sv
    ? dados.sv === versaoDaSenha(usuario.senha_hash)
    : !(await RecuperacaoConta.findByPk(usuario.id))?.senha_redefinida_em;
  if (!sessaoValida) return res.status(401).json({ mensagem: 'Sua senha mudou. Faça login novamente.' });
  req.usuario = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    aprovado: usuario.aprovado,
    telefone: usuario.telefone
  };
  next();
});

module.exports = autenticar;
