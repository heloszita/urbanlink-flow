const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const controller = require('../controllers/veiculoController');
const router = express.Router();

router.get('/veiculos', autenticar, controller.listar);
router.post('/veiculos', autenticar, permitir('Administrador', 'Gestor'), controller.cadastrar);
router.post('/veiculos/me', autenticar, permitir('Motorista'), controller.cadastrarMeuVeiculo);
router.get('/veiculos/:id', autenticar, controller.detalhar);
router.patch('/veiculos/:id', autenticar, permitir('Administrador', 'Gestor'), controller.atualizar);
router.delete('/veiculos/:id', autenticar, permitir('Administrador'), controller.excluir);
router.post('/veiculos/:id/posicoes', autenticar, permitir('Administrador', 'Gestor', 'Motorista'), controller.registrarPosicao);
router.get('/veiculos/:id/posicoes', autenticar, controller.listarPosicoes);

module.exports = router;
