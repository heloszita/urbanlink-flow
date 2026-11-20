const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const publicDir = path.join(base, 'public');

function read(file) { return fs.readFileSync(path.join(base, file), 'utf8'); }

test('estrutura limpa mantém um frontend, documentação essencial e imagens ativas', () => {
  assert.ok(fs.statSync(publicDir).isDirectory());
  assert.ok(!fs.existsSync(path.join(base, 'src/public')));
  assert.ok(!fs.existsSync(path.join(base,'node_modules')));
  for (const filename of ['mapa-esquematico.svg','logo-positiva.png','logo-negativa.png']) {
    assert.ok(!fs.existsSync(path.join(publicDir,'assets',filename)), filename);
  }
  const docs = fs.readdirSync(path.join(base, 'docs')).sort();
  assert.deepEqual(docs, [
    'AUDITORIA_REQUISITOS.md',
    'GUIA_DE_USO.md',
    'LOCALIZACAO_AUTOMATICA.md',
    'RELATORIO_LIMPEZA.md',
    'openapi.json'
  ]);
  assert.ok(!fs.existsSync(path.join(publicDir, 'guia.html')));
  assert.ok(!fs.existsSync(path.join(publicDir, 'guia-uso.html')));
  for (const file of ['public/css/refino-v37.css','public/css/visual.css']) {
    assert.doesNotMatch(read(file), /(?:\.guide-header|\.guide-page|\.guia-main|\.guia-hero)/);
  }
});

test('páginas HTML não apontam para arquivos estáticos locais inexistentes', () => {
  const pages = fs.readdirSync(publicDir).filter(name => name.endsWith('.html'));
  for (const file of pages) {
    const html=read('public/'+file);
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const ref=match[1];
      if (!ref.startsWith('./') || !/\.(?:html|css|js|png|jpg|jpeg|svg|ico|txt)(?:\?.*)?$/i.test(ref)) continue;
      const rel=ref.split('?')[0];
      assert.ok(fs.existsSync(path.join(publicDir,rel)),`${file}: referência inexistente ${rel}`);
    }
  }
});
