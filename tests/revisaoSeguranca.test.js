const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { segredoValido, conviteAdminValido } = require('../src/config/segredos');

function carregarComMocks(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const mod = { exports: {} };
  const localRequire = name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw new Error(`Dependência de teste não simulada: ${name}`);
  };
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  return mod.exports;
}
function erroHttp(status, message) { return Object.assign(new Error(message), { status }); }

test('rejeita segredos e convites do arquivo de exemplo', () => {
  assert.equal(segredoValido('troque-por-um-segredo-aleatorio-com-mais-de-24-caracteres'), false);
  assert.equal(conviteAdminValido('troque-por-um-codigo-privado'), false);
  assert.equal(segredoValido('b4F#mN5@gh68_0YtA!9zR2Qx'), true);
  assert.equal(conviteAdminValido('C0d1go-Privado-Novo'), true);
});

function montarServiceRota(entregas) {
  const criadas = [];
  const Service = carregarComMocks('src/services/rotaService.js', {
    '../models': {
      Entrega: { findAll: async ({ where }) => entregas.filter(e => where.id.includes(e.id)) },
      Rota: { create: async attrs => { criadas.push(attrs); return { id: 10, ...attrs }; } },
      Usuario: { findByPk: async id => ({ id, perfil: 'Motorista', ativo: true, aprovado: true }) },
      Veiculo: {}, PosicaoVeiculo: {}
    },
    '../utils/http': { erroHttp },
    '../utils/rotaMath': {
      haversineKm: () => 0,
      otimizarParadas: (_origin, rows) => ({ distancia: 5, ordem: rows.map(entrega => ({ entrega })) })
    }
  });
  return { Service, criadas };
}
const parametros = { entregaIds: [1, 2], origem: { latitude: -22.9, longitude: -43.2 }, velocidadeMedia: 30, criadorId: 99 };
const entrega = (id, motorista_id, status = 'Aguardando coleta') => ({ id, motorista_id, status });

test('não mistura motoristas numa mesma rota', async () => {
  const { Service, criadas } = montarServiceRota([entrega(1, 7), entrega(2, 8)]);
  await assert.rejects(Service.criarRota({ ...parametros }), { status: 409 });
  assert.equal(criadas.length, 0);
});

test('não mistura entrega atribuída e não atribuída', async () => {
  const { Service } = montarServiceRota([entrega(1, 7), entrega(2, null)]);
  await assert.rejects(Service.criarRota({ ...parametros }), { status: 409 });
});

test('motorista só planeja rota com suas entregas', async () => {
  const { Service } = montarServiceRota([entrega(1, 7), entrega(2, 7)]);
  await assert.rejects(Service.criarRota({ ...parametros, motoristaId: 8 }), { status: 403 });
});

test('permite rota consistente de um único motorista', async () => {
  const { Service, criadas } = montarServiceRota([entrega(1, 7), entrega(2, 7)]);
  const result = await Service.criarRota({ ...parametros, motoristaId: 7 });
  assert.equal(result.rota.motorista_id, 7);
  assert.deepEqual(criadas[0].entrega_ids, [1, 2]);
});

test('rejeita entrega concluída e identificadores duplicados na rota', async () => {
  const { Service } = montarServiceRota([entrega(1, null, 'Entregue'), entrega(2, null)]);
  await assert.rejects(Service.criarRota({ ...parametros }), { status: 422 });
  await assert.rejects(Service.criarRota({ ...parametros, entregaIds: [1, 1] }), { status: 422 });
});

test('pop-ups do mapa usam conteúdo DOM e não concatenam endereço em HTML', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/js/mapa.js'), 'utf8');
  assert.match(code, /function popupSeguro\(/);
  assert.match(code, /document\.createTextNode\(/);
  assert.doesNotMatch(code, /\$\{delivery\.destino\}<br>/);
});

test('há apenas uma pasta pública, servida diretamente pelo Express', () => {
  const base = path.join(__dirname, '..');
  assert.equal(fs.existsSync(path.join(base, 'public/js/app.js')), true);
  assert.equal(fs.existsSync(path.join(base, 'src/public')), false);
  const code = fs.readFileSync(path.join(base, 'src/app.js'), 'utf8');
  assert.match(code, /const publicDir = publicRaiz;/);
});

test('perfil exibe menu suspenso com ação de logout explícita', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert.match(js, /function setupProfileLogout/);
  assert.match(js, /menu-perfil/);
  assert.match(js, /Sair da conta/);
  assert.match(js, /clearSession\(\);/);
});

test('cadastro de motorista recebe mensagem de análise e etapa de veículo', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert.match(js, /Sua conta está em análise!/);
  assert.match(js, /Continuar para o cadastro do veículo/);
  assert.match(js, /driverRegistrationConfirmation\(\)/);
});

test('CNH possui endpoint autenticado restrito e visualização integrada', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/usuarioRoutes.js'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert.match(routes, /'\/usuarios\/:id\/cnh', autenticar, permitir\('Administrador', 'Gestor'\)/);
  assert.match(js, /function visualizarDocumentoCnh/);
  assert.match(js, /cnh-viewer/);
});

test('fonte sem serifa padronizada em todas as telas', () => {
  const base = path.join(__dirname, '..');
  assert.equal(fs.existsSync(path.join(base, 'public/css/tema-escuro.css')), false);
  const css = fs.readFileSync(path.join(base, 'public/css/visual.css'), 'utf8');
  assert.match(css, /DM Sans/);
  for (const file of fs.readdirSync(path.join(base, 'public')).filter(item => item.endsWith('.html'))) {
    assert.match(fs.readFileSync(path.join(base, 'public', file), 'utf8'), /css\/visual\.css/, file);
  }
});

test('mapa preserva seleção, permite origem da coleta ou manual e não compartilha GPS ao otimizar', () => {
  const map = fs.readFileSync(path.join(__dirname, '../public/js/mapa.js'), 'utf8');
  assert.match(map, /selectedIds: new Set\(\)/);
  assert.match(map, /manualOrigin/);
  assert.match(map, /mode === 'mapa'/);
  assert.match(map, /mode === 'coleta'|else \{\s*const coleta/);
  const optimize = map.slice(map.indexOf('async function optimizeRoute'), map.indexOf('async function startRoute'));
  assert.doesNotMatch(optimize, /shareDriverPosition\(origin\)/);
});

test('criação de entrega e evento compartilham a mesma transação', async () => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const chamadas = [];
  const usuario = { id: 3, nome: 'Cliente', endereco_coleta: 'Centro', perfil: 'Cliente', ativo: true };
  const service = carregarComMocks('src/services/entregaService.js', {
    sequelize: { Op: { notIn: Symbol('notIn') } },
    '../models': {
      Usuario: { findByPk: async () => usuario },
      Entrega: { create: async (dados, options) => { chamadas.push(['entrega', options.transaction]); return { id: 4, ...dados }; } },
      EventoEntrega: { create: async (dados, options) => { chamadas.push(['evento', options.transaction]); } },
      Veiculo: {}
    },
    '../config/database': { transaction: async callback => callback(transaction) },
    './geocodingService': { geocodificarEndereco: async () => ({ status: 'incompleto' }) },
    '../utils/http': {
      erroHttp, texto: (valor, max) => String(valor ?? '').trim().slice(0, max),
      numeroPositivo: (valor) => Number(valor || 0)
    }
  });
  const resultado = await service.criarEntrega({ destino: 'Rua 1', tipo_veiculo: 'Moto' }, usuario);
  assert.equal(resultado.status, 'Pendente');
  assert.deepEqual(chamadas, [['entrega', transaction], ['evento', transaction]]);
});

test('atribuição de entrega valida ocupação antes de gravar e é transacional', async () => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let ativas = 1;
  const gravacoes = [];
  const entrega = { id: 7, tipo_veiculo: 'Moto', status: 'Pendente', motorista_id: null, veiculo_id: null, update: async (_dados, { transaction: trx }) => gravacoes.push(['entrega', trx]) };
  const veiculo = { id: 10, tipo: 'Moto', status: 'Disponivel', motorista_id: 4, placa: 'ABC1234', capacidade_kg: 0, volume_m3: null, update: async (_dados, { transaction: trx }) => gravacoes.push(['veiculo', trx]) };
  const service = carregarComMocks('src/services/entregaService.js', {
    sequelize: { Op: { notIn: Symbol('notIn') } },
    '../models': {
      Usuario: { findByPk: async () => ({ id: 4, nome: 'Motorista', perfil: 'Motorista', ativo: true, aprovado: true }) },
      Entrega: { findByPk: async () => entrega, count: async () => ativas },
      Veiculo: { findByPk: async () => veiculo },
      EventoEntrega: { create: async (_dados, { transaction: trx }) => gravacoes.push(['evento', trx]) }
    },
    '../config/database': { transaction: async callback => callback(transaction) },
    './geocodingService': { geocodificarEndereco: async () => ({ status: 'incompleto' }) },
    '../utils/http': { erroHttp, texto: v => v, numeroPositivo: v => v }
  });
  await assert.rejects(service.atribuirEntrega(entrega, 4, 10, { id: 99 }), { status: 409 });
  assert.equal(gravacoes.length, 0);
  ativas = 0;
  const result = await service.atribuirEntrega(entrega, 4, 10, { id: 99 });
  assert.equal(result.id, 7);
  assert.deepEqual(gravacoes, [['veiculo', transaction], ['entrega', transaction], ['evento', transaction]]);
});
