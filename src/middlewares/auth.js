const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');
const { asyncHandler } = require('../utils/http');

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
  const usuario = await Usuario.findByPk(dados.id);
  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ mensagem: 'Conta não encontrada ou desativada.' });
  }
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
