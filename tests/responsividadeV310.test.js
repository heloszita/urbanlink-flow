const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = path => fs.readFileSync(require('node:path').join(root, path), 'utf8');
const pages = fs.readdirSync(path.join(root,'public')).filter(f => f.endsWith('.html'));

test('todas as páginas usam viewport e CSS de responsividade', () => {
  assert.equal(pages.length, 21);
  for (const file of pages) {
    const html = read('public/'+file);
    assert.match(html, /name="viewport"|name="viewport"\s*\//, file);
    assert.match(html, /css\/responsividade\.css\?v=(?:3\.10\.2|3\.12)/, file);
    assert.doesNotMatch(html, /css\/tema-v3[89]\.css/, file);
  }
});

test('tabelas viram cartões e não exigem arrastar horizontalmente no celular', () => {
  const css = read('public/css/responsividade.css');
  assert.match(css, /table\.tabela-pedidos tbody tr/);
  assert.match(css, /table\.sim-history-table tbody td/);
  assert.match(css, /min-width:0!important/);
  assert.match(css, /content:attr\(data-label\)/);
  const app = read('public/js/app.js');
  assert.match(app, /function enableResponsiveTableLabels\(/);
  assert.match(app, /new MutationObserver\(applyLabels\)/);
  assert.match(app, /enableResponsiveTableLabels\(\)/);
});

test('menus, formulários, filtros e controles de mapa quebram sem rolagem lateral', () => {
  const css = read('public/css/responsividade.css');
  for (const needle of [
    '.navegacao-topo', '.grid-contatos', '.opcoes-botoes', '.barra-filtros',
    '.driver-map-controls', '.mapa-toolbar-actions', '.abas-status', '.urbanlink-footer'
  ]) assert.ok(css.includes(needle), needle);
  assert.match(css, /flex-wrap:wrap!important/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
