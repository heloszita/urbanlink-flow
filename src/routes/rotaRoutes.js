const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const controller = require('../controllers/rotaController');
const router = express.Router();

router.get('/rotas', autenticar, permitir('Administrador', 'Gestor', 'Motorista'), controller.minhasRotas);
router.post('/rotas/otimizar', autenticar, permitir('Administrador', 'Gestor', 'Motorista'), controller.otimizar);
router.patch('/rotas/:id/status', autenticar, permitir('Administrador', 'Gestor', 'Motorista'), controller.atualizarStatus);

module.exports = router;
