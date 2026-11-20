function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function erroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}
function texto(valor, max = 255) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}
function numeroPositivo(valor, nome, obrigatorio = false) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) throw erroHttp(422, `O campo ${nome} é obrigatório.`);
    return null;
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) throw erroHttp(422, `O campo ${nome} deve ser um número válido maior ou igual a zero.`);
  return n;
}
function paginacao(query) {
  const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1);
  const limite = Math.min(100, Math.max(1, Number.parseInt(query.limite, 10) || 10));
  return { pagina, limite, offset: (pagina - 1) * limite };
}
module.exports = { asyncHandler, erroHttp, texto, numeroPositivo, paginacao };
