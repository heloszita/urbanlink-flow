'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, '../src/controllers/authController.js'), 'utf8');
function moduleComMocks(mocks) {
  const mod = { exports: {} };
  const localRequire = name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw new Error(`Mock não disponível: ${name}`);
  };
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}
function erroHttp(status, mensagem) { return Object.assign(new Error(mensagem), { status }); }
function controlador() {
  const created = [];
  const controller = moduleComMocks({
    bcrypt: { hash: async () => 'hashed' },
    jsonwebtoken: { sign: () => 'jwt-test' },
    sequelize: { UniqueConstraintError: class UniqueConstraintError extends Error {} },
    '../config/segredos': require('../src/config/segredos'),
    '../utils/credencial': require('../src/utils/credencial'),
    '../models': { Usuario: { create: async data => { created.push(data); return { id: 1, ...data }; } } },
    '../utils/http': { asyncHandler: fn => fn, erroHttp, texto: (v, max) => String(v ?? '').trim().slice(0, max) }
  });
  return { controller, created };
}
const payload = { nome: 'Teste Admin', email: 'admin@example.org', senha: 'SenhaSegura123', perfil: 'Administrador' };
async function tentar(controller, codigo_convite) {
  const req = { body: { ...payload, codigo_convite } };
  const res = { status(s) { this.statusCode = s; return this; }, json(value) { this.value = value; return this; } };
  return controller.cadastrar(req, res);
}
function withCode(value, run) {
  const before = process.env.ADMIN_INVITE_CODE;
  const jwtBefore = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'b4F#mN5@gh68_0YtA!9zR2Qx';
  if (value == null) delete process.env.ADMIN_INVITE_CODE;
  else process.env.ADMIN_INVITE_CODE = value;
  return Promise.resolve().then(run).finally(() => {
    if (before === undefined) delete process.env.ADMIN_INVITE_CODE;
    else process.env.ADMIN_INVITE_CODE = before;
    if (jwtBefore === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtBefore;
  });
}
test('identifica quando o convite do servidor não está configurado', async () => {
  const { controller, created } = controlador();
  await withCode(undefined, async () => assert.rejects(tentar(controller, 'qualquer-valor'), { status: 503 }));
  assert.equal(created.length, 0);
});
test('não permite cadastrar usando o valor ilustrativo de .env.example', async () => {
  const { controller, created } = controlador();
  await withCode('troque-por-um-codigo-privado', async () => assert.rejects(tentar(controller, 'troque-por-um-codigo-privado'), { status: 503 }));
  assert.equal(created.length, 0);
});
test('retorna código incorreto quando há convite configurado e entrada não confere', async () => {
  const { controller, created } = controlador();
  await withCode('UL-Convite-Seguro-123', async () => assert.rejects(tentar(controller, 'outro-codigo'), { status: 403 }));
  assert.equal(created.length, 0);
});
test('permite cadastro com convite válido configurado, sem exigir o prefixo da variável', async () => {
  const { controller, created } = controlador();
  await withCode('UL-Convite-Seguro-123', async () => {
    const res = await tentar(controller, '  UL-Convite-Seguro-123  ');
    assert.equal(res.statusCode, 201);
    assert.equal(res.value.usuario.perfil, 'Administrador');
  });
  assert.equal(created.length, 1);
});
