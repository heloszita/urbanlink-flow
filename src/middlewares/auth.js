const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ mensagem: 'Token não fornecido. Acesso negado.' });
  }

  // O token vem no formato: "Bearer TOKEN_AQUI"
  const token = authHeader.split(' ')[1];

  try {
    // Decodifica o token usando a chave secreta do .env
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    
    // Anexa as informações do usuário (id e perfil) na requisição
    req.usuario = dados;
    
    next(); // Passa para a próxima etapa
  } catch (erro) {
    return res.status(401).json({ mensagem: 'Token inválido ou expirado' });
  }
}

module.exports = autenticar;