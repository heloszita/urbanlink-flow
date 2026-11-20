'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercita a própria função usada pelo navegador, sem precisar de banco de dados.
function prepararFormulario(dadosFormulario = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  const start = source.indexOf('  async function vehicleRegistrationPage(user) {');
  const end = source.indexOf('  async function carregarPerfil()', start);
  assert.ok(start >= 0 && end > start, 'A função de cadastro precisa continuar presente no frontend');
  const values = {
    modelo: 'Corsa', placa: 'ZZZ5Z55', cor: 'Preto', ano: '2016',
    'tipo-veiculo': 'Carro', capacidade: '30', tanque: '20', 'volume-m3': '12',
    ...dadosFormulario
  };
  let submit;
  const button = { disabled: false };
  const form = { addEventListener(name, listener) { if (name === 'submit') submit = listener; } };
  const sent = [];
  const notifications = [];
  let errorsRemoved = 0;
  const ctx = {
    $: (selector) => selector === '#form-veiculo' ? form : selector === 'button[type="submit"]' ? button : null,
    $$: (selector) => selector === '.mensagem-app.erro' ? [{ remove() { errorsRemoved++; } }] : [],
    val: id => values[id] || '',
    num: id => values[id] === '' ? null : Number(values[id]),
    message: (content, kind) => notifications.push({ content, kind }),
    request: async (path, options) => { sent.push({ path, options }); return { mensagem: 'Veículo cadastrado.' }; },
    setTimeout() {},
    window: { location: { href: '' } }
  };
  vm.runInNewContext(source.slice(start, end) + '\nglobalThis.testarCadastro = vehicleRegistrationPage;', ctx);
  return { init: ctx.testarCadastro, submit: async () => {
    assert.equal(typeof submit, 'function', 'O listener de submit deve ser registrado');
    await submit({ preventDefault() {} });
  }, sent, notifications, button, get errorsRemoved() { return errorsRemoved; } };
}

test('cadastro do motorista envia o tipo Carro para a API sem ReferenceError', async () => {
  const page = prepararFormulario();
  await page.init({ aprovado: false });
  await page.submit();
  assert.equal(page.sent.length, 1);
  assert.equal(page.sent[0].path, '/veiculos/me');
  assert.equal(page.sent[0].options.body.tipo, 'Carro');
  assert.equal(page.sent[0].options.body.capacidade_kg, 30);
  assert.ok(page.notifications.some(x => x.kind === 'sucesso'));
  assert.ok(!page.notifications.some(x => x.content.includes('is not defined')));
  assert.equal(page.errorsRemoved, 1);
  assert.equal(page.button.disabled, false);
});

test('cadastro de veículo inválido é bloqueado antes da API', async () => {
  const page = prepararFormulario({ 'tipo-veiculo': 'Bicicleta' });
  await page.init({ aprovado: false });
  await page.submit();
  assert.equal(page.sent.length, 0);
  assert.ok(page.notifications.some(x => x.kind === 'erro' && x.content.includes('Tipo de veículo inválido')));
});
