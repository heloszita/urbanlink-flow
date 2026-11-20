const express = require('express');
const { cadastrar, login } = require('../controllers/authController');
const { gerarCodigo, redefinirSenha } = require('../controllers/recuperacaoController');
const autenticar = require('../middlewares/auth');
const { asyncHandler } = require('../utils/http');
const { Usuario } = require('../models');
const router = express.Router();

router.post('/login', login);
router.post('/cadastro', cadastrar);
router.post('/codigo-recuperacao', autenticar, gerarCodigo);
router.post('/redefinir-senha', redefinirSenha);
router.get('/me', autenticar, asyncHandler(async (req, res) => {
  const usuario = await Usuario.findByPk(req.usuario.id);
  res.json({ usuario });
}));

module.exports = router;
