'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/entrega-motorista.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
const helperStart = script.indexOf('  function configurarLocalizacaoDestino(form, campos) {');
const helperEnd = script.indexOf('  async function customerDeliveryPage(user) {', helperStart);
const start = script.indexOf('  async function manageDeliveriesPage(user) {');
const end = script.indexOf('  function fillSelect(select,', start);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.ok(start >= 0 && end > start);

class Elemento {
  constructor(tag = 'div', cls = '', text = '') {
    this.tag = tag;
    this.className = cls;
    this.textContent = text;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.classList = { toggle: () => {} };
  }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, cb) { this.listeners[event] = cb; }
  focus() { this.focused = true; }
  reset() { this.value = ''; }
}

function ambiente(cenario = {}) {
  const pedido = {
    id: 31, codigo: 'UL-31', tipo_veiculo: 'Carro', peso_kg: 25, volume_m3: 2,
    status: 'Pendente', motorista_id: null, veiculo_id: null,
    origem: 'Centro', destino: 'Rua A', cliente: { nome: 'Cliente teste' },
    ...cenario.pedido
  };
  const drivers = [
    { id: 7, nome: 'Motorista A', ativo: true, aprovado: true },
    { id: 8, nome: 'Motorista B', ativo: true, aprovado: true }
  ];
  const vehicles = [
    { id: 9, tipo: 'Carro', placa: 'ABC1234', modelo: 'Corsa', motorista_id: 7, capacidade_kg: 50, volume_m3: 4, status: 'Disponivel' },
    { id: 10, tipo: 'Moto', placa: 'DEF1111', modelo: 'Moto', motorista_id: 7, capacidade_kg: 50, status: 'Disponivel' },
    { id: 11, tipo: 'Carro', placa: 'GHI1111', modelo: 'Outro', motorista_id: 8, capacidade_kg: 100, status: 'Disponivel' },
    { id: 12, tipo: 'Carro', placa: 'JKL1111', modelo: 'Pequeno', motorista_id: 7, capacidade_kg: 10, status: 'Disponivel' }
  ];
  const selectors = new Map();
  const el = (tag, cls, value) => new Elemento(tag, cls, value);
  const get = (selector) => {
    if (!selectors.has(selector)) selectors.set(selector, new Elemento());
    return selectors.get(selector);
  };
  const tabs = ['todos', 'sem-motorista', 'Pendente', 'Em trânsito', 'Entregue', 'Cancelada'].map(value => {
    const tab = new Elemento('button', 'aba');
    tab.dataset.filtro = value;
    tab.counter = new Elemento('span', 'contador-aba');
    return tab;
  });
  const sent = [];
  const notices = [];
  const ctx = {
    $: (selector, scope) => selector === '.contador-aba' && scope ? scope.counter : get(selector),
    $$: (selector) => selector === '.abas-status .aba' ? tabs : [],
    el,
    statusBadge: value => new Elemento('span', 'badge-status', value),
    val: (id) => get(`#${id}`).value,
    fillSelect: (select, items, placeholder) => {
      select.entries = items.map(x => x.id);
      select.placeholder = placeholder;
      select.value = '';
    },
    requestTodasPaginas: async endpoint => {
      if (endpoint === '/entregas') return { dados: [pedido] };
      if (endpoint.startsWith('/usuarios?perfil=Cliente')) return { dados: [{id: 20, nome: 'Cliente teste'}] };
      if (endpoint.startsWith('/usuarios?perfil=Motorista')) return { dados: drivers };
      if (endpoint === '/veiculos') return { dados: vehicles };
      throw new Error('unexpected request ' + endpoint);
    },
    request: async (endpoint, options) => {
      sent.push({ endpoint, options });
      if (cenario.fail) throw new Error('Veículo indisponível no servidor');
      return { entrega: { ...pedido, motorista_id: options.body.motorista_id, veiculo_id: options.body.veiculo_id, status: 'Aguardando coleta', motorista: { nome: 'Motorista A' } } };
    },
    message: (value, type) => notices.push({ value, type }),
    exportCsv: () => {},
    motoristaDeliveriesPage: () => {},
    setTimeout: () => {},
    window: { location: { reload() {} } },
    document: { addEventListener: () => {} }
  };
  vm.runInNewContext(script.slice(helperStart, helperEnd) + script.slice(start, end) + '\nglobalThis.testarGestao = manageDeliveriesPage;', ctx);
  return {
    inicializar: () => ctx.testarGestao({ perfil: 'Administrador' }),
    get,
    tabs,
    sent,
    notices,
    pedido,
    linhas: () => get('#entregas-admin-body').children,
    formulario: get('#form-atribuir-entrega')
  };
}

function procurar(node, nomeClasse) {
  if (node.className === nomeClasse) return node;
  for (const child of node.children) {
    const found = procurar(child, nomeClasse);
    if (found) return found;
  }
  return null;
}

test('gestão exibe pedidos sem motorista e modal de atribuição', async () => {
  assert.match(html, /data-filtro="sem-motorista"/);
  assert.match(html, /id="modalAtribuirEntrega"/);
  assert.match(html, /id="atribuir-veiculo"/);
  const ui = ambiente();
  await ui.inicializar();
  assert.equal(ui.get('#contador-sem-motorista').textContent, '1 aguardando atribuição');
  const button = procurar(ui.linhas()[0], 'botao-atribuir-motorista');
  assert.ok(button, 'O pedido pendente deve ter botão de atribuição');
  button.listeners.click();
  assert.equal(ui.get('#modalAtribuirEntrega').style.display, 'flex');
  assert.equal(ui.get('#atribuir-codigo').textContent, 'UL-31');
  assert.equal(ui.get('#atribuir-veiculo').disabled, true);
  assert.equal(ui.get('#atribuir-motorista').entries.length, 2);
});

test('escolhe motorista e apenas veículos compatíveis; atribui via API', async () => {
  const ui = ambiente();
  await ui.inicializar();
  procurar(ui.linhas()[0], 'botao-atribuir-motorista').listeners.click();
  ui.get('#atribuir-motorista').value = '7';
  ui.get('#atribuir-motorista').listeners.change();
  assert.deepEqual(Array.from(ui.get('#atribuir-veiculo').entries), [9]);
  ui.get('#atribuir-veiculo').value = '9';
  await ui.formulario.listeners.submit({ preventDefault() {} });
  assert.equal(ui.sent.length, 1);
  assert.equal(ui.sent[0].endpoint, '/entregas/31/atribuicao');
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent[0].options.body)), { motorista_id: 7, veiculo_id: 9 });
  assert.equal(ui.get('#contador-sem-motorista').textContent, '0 aguardando atribuição');
  assert.equal(ui.get('#modalAtribuirEntrega').style.display, 'none');
  assert.ok(ui.notices.some(x => x.type === 'sucesso'));
});

test('bloqueia motorista/veículo incompatíveis e trata erro do servidor', async () => {
  const ui = ambiente({ fail: true });
  await ui.inicializar();
  procurar(ui.linhas()[0], 'botao-atribuir-motorista').listeners.click();
  await ui.formulario.listeners.submit({ preventDefault() {} });
  assert.equal(ui.sent.length, 0);
  assert.equal(ui.get('#atribuir-mensagem').hidden, false);
  ui.get('#atribuir-motorista').value = '8';
  ui.get('#atribuir-motorista').listeners.change();
  assert.deepEqual(Array.from(ui.get('#atribuir-veiculo').entries), [11]);
  ui.get('#atribuir-veiculo').value = '11';
  await ui.formulario.listeners.submit({ preventDefault() {} });
  assert.equal(ui.sent.length, 1);
  assert.match(ui.get('#atribuir-mensagem').textContent, /indisponível no servidor/);
  assert.equal(ui.get('#modalAtribuirEntrega').style.display, 'flex');
  assert.equal(ui.get('#confirmar-atribuicao').disabled, false);
});

test('pedidos atribuídos ou finalizados não exibem botão de atribuição', async () => {
  for (const pedido of [{status:'Entregue'}, {status:'Aguardando coleta', motorista_id:7, veiculo_id:9}, {status:'Cancelada'}]) {
    const ui = ambiente({ pedido });
    await ui.inicializar();
    assert.equal(procurar(ui.linhas()[0], 'botao-atribuir-motorista'), null);
  }
});
