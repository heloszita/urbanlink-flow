const bcrypt = require('bcrypt');
const Usuario = require('../models/usuario');

async function cadastrar(req, res) {
  try {
    // 1. Recebe os dados do corpo da requisição
    const { nome, email, senha, perfil } = req.body;

    // 2. Criptografa a senha com bcrypt (fator de custo 10)
    const senhaCriptografada = await bcrypt.hash(senha, 10);

    // 3. Cria o usuário com os atributos do UrbanLink Flow
    const novoUsuario = await Usuario.create({
      nome,
      email,
      senha_hash: senhaCriptografada,
      perfil: perfil || 'Cliente' // Se não enviar perfil, define como Cliente
    });

    // 4. Responde com status 201 (Criado) sem expor a senha em momento algum
    return res.status(201).json({
      mensagem: 'Usuário do UrbanLink Flow cadastrado com sucesso!',
      usuario: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        perfil: novoUsuario.perfil,
        ativo: novoUsuario.ativo
      }
    });
  } catch (erro) {
    // Trata e-mails duplicados ou falhas no banco
    return res.status(400).json({
      mensagem: 'Erro ao cadastrar usuário no UrbanLink Flow',
      erro: erro.message
    });
  }
}

module.exports = { cadastrar };