const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const { Usuario, RecuperacaoConta } = require('../models');
const { asyncHandler, erroHttp, texto } = require('../utils/http');

const hashCodigo = codigo => createHash('sha256').update(codigo).digest('hex');
const codigoInvalido = () => erroHttp(422, 'E-mail ou código de recuperação inválido ou já utilizado.');
const camposUsuario = ['id', 'email', 'senha_hash', 'ativo'];

const gerarCodigo = asyncHandler(async (req, res) => {
  const { senha } = req.body || {};
  if (typeof senha !== 'string' || !senha) throw erroHttp(422, 'Informe sua senha atual.');

  const usuario = await Usuario.unscoped().findByPk(req.usuario.id, { attributes: camposUsuario });
  if (!usuario?.ativo || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    throw erroHttp(403, 'Senha atual incorreta.');
  }

  const codigo = randomBytes(24).toString('hex');
  await sequelize.transaction(async transaction => {
    const atual = await Usuario.unscoped().findByPk(usuario.id, {
      attributes: camposUsuario, transaction, lock: transaction.LOCK.UPDATE
    });
    if (!atual?.ativo || atual.senha_hash !== usuario.senha_hash) {
      throw erroHttp(409, 'A conta foi alterada. Entre novamente para gerar um código.');
    }
    const recuperacao = await RecuperacaoConta.findByPk(usuario.id, { transaction });
    if (recuperacao) {
      await recuperacao.update({ codigo_hash: hashCodigo(codigo) }, { transaction });
    } else {
      await RecuperacaoConta.create({ usuario_id: usuario.id, codigo_hash: hashCodigo(codigo) }, { transaction });
    }
  });

  res.set('Cache-Control', 'no-store').status(201).json({ codigo: codigo.match(/.{8}/g).join('-') });
});

const redefinirSenha = asyncHandler(async (req, res) => {
  const dados = req.body || {};
  const email = texto(dados.email, 160).toLowerCase();
  const codigo = texto(dados.codigo, 100).toLowerCase().replace(/[\s-]/g, '');
  const { senha } = dados;
  if (!/^[a-f0-9]{48}$/.test(codigo) || !email) throw codigoInvalido();
  if (typeof senha !== 'string' || senha.trim() !== senha || senha.length < 8 || Buffer.byteLength(senha) > 72) {
    throw erroHttp(422, 'Use de 8 caracteres a 72 bytes, sem espaços no início ou no fim.');
  }

  const codigo_hash = hashCodigo(codigo);
  const recuperacao = await RecuperacaoConta.findOne({ where: { codigo_hash } });
  if (!recuperacao) throw codigoInvalido();
  const usuario = await Usuario.unscoped().findByPk(recuperacao.usuario_id, { attributes: camposUsuario });
  if (!usuario?.ativo || usuario.email.toLowerCase() !== email) throw codigoInvalido();

  const senha_hash = await bcrypt.hash(senha, 12);
  await sequelize.transaction(async transaction => {
    const atual = await Usuario.unscoped().findByPk(usuario.id, {
      attributes: camposUsuario, transaction, lock: transaction.LOCK.UPDATE
    });
    if (!atual?.ativo || atual.email.toLowerCase() !== email) throw codigoInvalido();
    const [consumidos] = await RecuperacaoConta.update(
      { codigo_hash: null, senha_redefinida_em: new Date() },
      { where: { usuario_id: usuario.id, codigo_hash }, transaction }
    );
    if (!consumidos) throw codigoInvalido();
    await atual.update({ senha_hash }, { transaction });
  });

  res.set('Cache-Control', 'no-store').json({ mensagem: 'Senha redefinida. Entre com a nova senha.' });
});

module.exports = { gerarCodigo, redefinirSenha };
