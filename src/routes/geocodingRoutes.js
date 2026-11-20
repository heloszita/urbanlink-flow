const express = require('express');
const autenticar = require('../middlewares/auth');
const permitir = require('../middlewares/checkRole');
const { localizar } = require('../controllers/geocodingController');
const router = express.Router();
// Consulta somente ao clicar em "Localizar endereço"; não oferece autocomplete.
router.post('/geocodificar', autenticar, permitir('Cliente', 'Administrador', 'Gestor'), localizar);
module.exports = router;
