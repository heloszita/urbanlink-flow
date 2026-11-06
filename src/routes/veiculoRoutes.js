const express = require('express');
const router = express.Router();
const { cadastrar, listar } = require('../controllers/veiculoController');
const { registrarPosicao } = require('../controllers/posicaoController');

// Importa os middlewares de autenticação e perfil do Módulo 3
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');

// Rotas de Veículos (Apenas Admin e Gestor podem cadastrar; Motorista/Cliente podem consultar)
router.post('/veiculos', autenticar, permitir('Administrador', 'Gestor'), cadastrar);
router.get('/veiculos', autenticar, listar);

// Rota para Registrar Posição GPS/Status do Veículo
router.post('/veiculos/posicao', autenticar, permitir('Administrador', 'Gestor', 'Motorista'), registrarPosicao);

module.exports = router;