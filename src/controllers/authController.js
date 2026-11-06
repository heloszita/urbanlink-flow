const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario');

async function login(req, res) {
  try {
    const { email, senha } = req.body;

    // 1. Procura o usuário pelo e-mail
    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ mensagem: 'Email ou senha inválidos' });
    }

    // 2. Verifica se a conta está ativa no sistema
    if (!usuario.ativo) {
      return res.status(403).json({ mensagem: 'Conta desativada no sistema' });
    }

    // 3. Compara a senha digitada com a senha_hash gravada no banco
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ mensagem: 'Email ou senha inválidos' });
    }

    // 4. Gera o Token JWT contendo o ID e o Perfil do UrbanLink Flow
    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 5. Devolve o token e os dados básicos do usuário
    return res.status(200).json({
      mensagem: 'Autenticado com sucesso na plataforma UrbanLink Flow!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      }
    });
  } catch (erro) {
    return res.status(500).json({
      mensagem: 'Erro no servidor ao realizar login',
      erro: erro.message
    });
  }
}

module.exports = { login };