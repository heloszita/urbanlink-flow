const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const publicDir = path.join(base, 'public');
const read = item => fs.readFileSync(path.join(base, item), 'utf8');

test('favicon UrbanLink aparece em todas as páginas, sem interferir nos ícones dos perfis', () => {
  const icon = fs.readFileSync(path.join(publicDir, 'assets/favicon-32.png'));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  for (const iconName of ['favicon.ico', 'apple-touch-icon.png']) {
    assert.ok(fs.statSync(path.join(publicDir, 'assets', iconName)).size > 200, iconName);
  }
  const pages = fs.readdirSync(publicDir).filter(name => name.endsWith('.html'));
  assert.ok(pages.length >= 18);
  for (const pageName of pages) {
    const page = read('public/' + pageName);
    assert.match(page, /favicon-32\.png/, pageName);
    assert.match(page, /favicon\.ico/, pageName);
    assert.doesNotMatch(page, /rel="icon" href="data:,"/, pageName);
    if (pageName === 'index.html') assert.match(page, /rel="apple-touch-icon"/, pageName);
    assert.match(page, /css\/identidade\.css\?v=3\.10\.1/, pageName);
    assert.doesNotMatch(page, /css\/tema-v3[89]\.css|localStorage\.getItem\('urbanlink_tema'\)/, pageName);
  }
});

test('tema escuro removido de todos os arquivos e o logout permanece', () => {
  const script = read('public/js/app.js');
  assert.doesNotMatch(script, /function applyTheme\(|Ativar modo escuro|Ativar modo claro|menu-tema|dataset\.theme = nextTheme/);
  assert.match(script, /clearSession\(\)/);
  assert.match(script, /removeItem\('urbanlink_tema'\)/);
  assert.match(script, /menu\.append\(logout\)/);
  assert.ok(!fs.existsSync(path.join(publicDir,'css/tema-v38.css')));
  assert.ok(!fs.existsSync(path.join(publicDir,'css/tema-v39.css')));
});

test('os botões de seleção de perfil são neutros por padrão e laranja somente no hover', () => {
  const css = read('public/css/identidade.css');
  assert.match(css, /\.cartao-destaque \.profile-cta \{[\s\S]*?background-color: #fff/);
  assert.match(css, /\.cartao-destaque \.profile-cta:hover \{[\s\S]*?background-color: #f35b3f/);
  const home = read('public/index.html');
  assert.equal((home.match(/class="botao botao-primario profile-cta"/g) || []).length,3);
  assert.match(home,/identidade\.css\?v=3\.10\.1/);
});

test('patrocinadores: uma marca em destaque e outras três, todas como demonstração', () => {
  const sponsor = read('public/patrocinadores.html');
  assert.equal((sponsor.match(/class="sponsor-featured"/g) || []).length, 1);
  assert.equal((sponsor.match(/class="sponsor-company"/g) || []).length, 3);
  assert.match(sponsor, /Empresa demonstrativa/);
  assert.doesNotMatch(sponsor, /sponsor-demo-notice/);
  for (const brand of ['RotaNexa', 'VerdeCarga', 'PulsoVia', 'NuvemPátio']) {
    assert.match(sponsor, new RegExp(brand));
  }
  assert.match(read('public/css/identidade.css'), /\.sponsor-grid/);
});
