const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const controller = require('../controllers/simulacaoController');

const router = express.Router();
router.use(autenticar, permitir('Administrador', 'Gestor'));
router.get('/simulacoes', controller.listar);
router.post('/simulacoes', controller.criar);
router.get('/simulacoes/:id', controller.detalhar);
router.delete('/simulacoes/:id', controller.excluir);

module.exports = router;
