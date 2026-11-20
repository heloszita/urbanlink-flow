const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const controller = require('../controllers/chamadoController');
const router = express.Router();

router.get('/chamados', autenticar, controller.listar);
router.post('/chamados', autenticar, controller.criar);
router.patch('/chamados/:id', autenticar, permitir('Administrador', 'Gestor'), controller.responder);

module.exports = router;
