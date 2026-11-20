const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const controller = require('../controllers/entregaController');
const router = express.Router();

router.get('/rastreamento/:codigo', controller.rastrear);
router.get('/entregas/exportar.csv', autenticar, permitir('Administrador', 'Gestor'), controller.exportarCsv);
router.get('/entregas', autenticar, controller.listar);
router.post('/entregas', autenticar, permitir('Cliente', 'Administrador', 'Gestor'), controller.criar);
router.get('/entregas/:id', autenticar, controller.detalhar);
router.patch('/entregas/:id/status', autenticar, permitir('Cliente', 'Administrador', 'Gestor', 'Motorista'), controller.atualizarStatus);
router.patch('/entregas/:id/localizacao', autenticar, permitir('Administrador', 'Gestor'), controller.corrigirLocalizacao);
router.patch('/entregas/:id/atribuicao', autenticar, permitir('Administrador', 'Gestor'), controller.atribuir);
router.delete('/entregas/:id', autenticar, permitir('Administrador'), controller.excluir);

module.exports = router;
