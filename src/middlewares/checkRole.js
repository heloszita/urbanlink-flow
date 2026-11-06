// Permite passar apenas quem tiver um dos perfis autorizados
function permitir(...perfisPermitidos) {
    return (req, res, next) => {
      // Confere se o perfil do usuário logado está na lista permitida
      if (!perfisPermitidos.includes(req.usuario.perfil)) {
        return res.status(403).json({ 
          mensagem: `Acesso negado. Apenas o(s) perfil(is) [${perfisPermitidos.join(', ')}] podem realizar esta ação.` 
        });
      }
      next();
    };
  }
  
  module.exports = permitir;