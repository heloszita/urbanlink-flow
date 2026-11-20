const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { geocodificarEndereco, prepararEndereco, validarResultado } = require('../src/services/geocodingService');

function respostaMock(resultado, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => resultado });
}

test('prepara rua, numero, municipio e CEP sem exigir coordenadas do cliente', () => {
  const e = prepararEndereco({ destino: 'Rua das Palmeiras, 25', bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'rj', cep_entrega: '20000-000' });
  assert.equal(e.contexto, true);
  assert.equal(e.uf, 'RJ');
  assert.equal(e.cep, '20000000');
  assert.match(e.consulta, /Rio de Janeiro, RJ, 20000000, Brasil/);
});

test('pesquisa endereco e retorna coordenadas exatas, sem chamada real à internet', async () => {
  let calls = 0;
  const resultado = await geocodificarEndereco({ destino: 'Rua das Palmeiras, 25', cidade: 'Rio de Janeiro', uf: 'RJ', cep: '20000-000' }, {
    provider: 'geoapify', apiKey: 'chave-de-teste',
    fetchImpl: async (url) => {
      calls++;
      assert.match(url, /api\.geoapify\.com/);
      return (await respostaMock({ results: [{ lat: -22.9068, lon: -43.1729, formatted: 'Rua das Palmeiras, 25, Rio de Janeiro', country_code: 'br', street: 'Rua das Palmeiras', housenumber: '25', city: 'Rio de Janeiro' }] }))();
    }
  });
  assert.equal(calls, 1);
  assert.equal(resultado.status, 'encontrado');
  assert.equal(resultado.latitude, -22.9068);
  assert.equal(resultado.longitude, -43.1729);
});

test('quando o numero nao e confirmado, classifica como aproximado', () => {
  const resultado = validarResultado({ lat: -22.9, lon: -43.17, address: { road: 'Rua das Oliveiras', city: 'Rio de Janeiro', country_code: 'br' } }, prepararEndereco({ destino: 'Rua das Oliveiras, 470', cidade: 'Rio de Janeiro' }));
  assert.equal(resultado.status, 'aproximado');
});

test('nao aceita candidato em outra cidade ou numero diferente', () => {
  const e = prepararEndereco({ destino: 'Rua das Oliveiras, 470', cidade: 'Rio de Janeiro' });
  assert.equal(validarResultado({ lat: -22.9, lon: -43.17, address: { road: 'Rua das Oliveiras', city: 'Niterói', house_number: '470', country_code: 'br' } }, e), null);
  assert.equal(validarResultado({ lat: -22.9, lon: -43.17, address: { road: 'Rua das Oliveiras', city: 'Rio de Janeiro', house_number: '800', country_code: 'br' } }, e), null);
});

test('nao pesquisa endereco insuficiente ou sem municipio e CEP', async () => {
  const resultado = await geocodificarEndereco({ destino: 'Rua Sem Referencia' }, { provider: 'geoapify', apiKey: 'teste', fetchImpl: () => { throw new Error('Nao deveria consultar'); } });
  assert.equal(resultado.status, 'incompleto');
});

test('trata falha do provedor sem comprometer o pedido', async () => {
  const resultado = await geocodificarEndereco({ destino: 'Rua da Testagem, 9129', cidade: 'Rio de Janeiro' }, {
    provider: 'geoapify', apiKey: 'teste', fetchImpl: respostaMock({}, 503)
  });
  assert.equal(resultado.status, 'indisponivel');
  assert.equal(resultado.latitude, undefined);
});

test('tela do motorista mantém as quatro ações na mesma linha', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/inicial-motorista.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../public/css/visual.css'), 'utf8');
  for (const id of ['driver-map-fit','driver-map-refresh','driver-map-share']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /class="driver-map-link"/);
  assert.match(css, /\.motorista-mapa-card\s+\.topo-mapa-info\s*>\s*\.driver-map-controls\s*\{[^}]*flex-direction:\s*row;[^}]*flex-wrap:\s*nowrap;/s);
  assert.match(css, /overflow-x:\s*auto;/);
});

test('acoes da proxima parada estao lado a lado em uma grade de duas colunas', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/inicial-motorista.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../public/css/visual.css'), 'utf8');
  assert.match(html, /<div class="acoes-parada-motorista">[\s\S]*?id="driver-arrival"[\s\S]*?id="driver-confirm"[\s\S]*?<\/div>/);
  assert.match(css, /\.acoes-parada-motorista\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
