function permitir(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ mensagem: `Acesso negado. Perfil permitido: ${perfisPermitidos.join(', ')}.` });
    }
    next();
  };
}
function motoristaAprovado(req, res, next) {
  if (req.usuario?.perfil === 'Motorista' && !req.usuario.aprovado) {
    return res.status(403).json({ mensagem: 'Seu cadastro de motorista ainda aguarda aprovação do gestor.' });
  }
  next();
}
module.exports = permitir;
module.exports.motoristaAprovado = motoristaAprovado;
