const express = require('express');
const router = express.Router();
const { cadastrar } = require('../controllers/usuarioController');

// Rota POST para cadastrar usuários
router.post('/usuarios', cadastrar);

module.exports = router;