const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const controller = require('../controllers/usuarioController');
const router = express.Router();

router.get('/usuarios', autenticar, permitir('Administrador', 'Gestor'), controller.listar);
router.get('/usuarios/me', autenticar, controller.meuPerfil);
router.patch('/usuarios/me', autenticar, controller.atualizarMeuPerfil);
router.get('/usuarios/:id/cnh', autenticar, permitir('Administrador', 'Gestor'), controller.visualizarCnh);
router.get('/usuarios/:id', autenticar, permitir('Administrador', 'Gestor'), controller.detalhar);
router.post('/usuarios/gestores', autenticar, permitir('Administrador'), controller.criarGestor);
router.patch('/usuarios/:id/aprovacao', autenticar, permitir('Administrador', 'Gestor'), controller.atualizarAprovacao);
router.patch('/usuarios/:id/desativar', autenticar, permitir('Administrador'), controller.desativar);

module.exports = router;
