const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');

// Rota POST para login de usuários
router.post('/login', login);

module.exports = router;