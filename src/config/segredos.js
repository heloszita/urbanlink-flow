function segredoValido(segredo) {
  return typeof segredo === 'string' && segredo.length >= 24 &&
    !/^(troque-|change-|exemplo|example)/i.test(segredo) &&
    new Set(segredo).size >= 10;
}
function conviteAdminValido(convite) {
  return typeof convite === 'string' && convite.length >= 12 &&
    !/^(troque-|change-|exemplo|example)/i.test(convite);
}
module.exports = { segredoValido, conviteAdminValido };
