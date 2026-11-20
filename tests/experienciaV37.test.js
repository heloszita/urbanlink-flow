const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=(f)=>fs.readFileSync(path.join(root,f),'utf8');
test('todas as páginas têm footer padrão e nenhuma página de guia é publicada',()=>{
  const htmls=fs.readdirSync(path.join(root,'public')).filter(f=>f.endsWith('.html'));
  assert.ok(htmls.length>=18);
  for (const name of htmls){
    const html=file('public/'+name);
    assert.match(html,/class="urbanlink-footer"/,name);
    assert.match(html,/identidade\.css\?v=3\.10\.1/,name);
    assert.match(html,/instagram\.com\/urban\.linkflow/,name);
    assert.doesNotMatch(html,/href="guia(?:-uso)?\.html"/,name);
  }
  assert.ok(!fs.existsSync(path.join(root,'public/guia.html')));
  assert.ok(!fs.existsSync(path.join(root,'public/guia-uso.html')));
  assert.doesNotMatch(file('public/js/app.js'),/\['Guia',\s*'guia\.html'\]/);
});
test('os três ícones em PNG do protótipo aparecem somente no index',()=>{
  for(const name of ['cliente','entregador','administrador'])assert.ok(fs.statSync(path.join(root,'public/assets/icon-'+name+'.png')).size>500);
  const home = file('public/index.html');
  for (const name of ['cliente','entregador','administrador']) assert.match(home, new RegExp(`assets/icon-${name}\\.png`));
  for (const name of ['cliente','motorista','adm']) assert.doesNotMatch(file(`public/cadastro-${name}.html`),/icon-(?:cliente|entregador|administrador)\.png/);
  assert.doesNotMatch(file('public/index.html'),/🚚|🏢|👤/);
});
test('painel de mapa tem etapas, seleção e diálogo de reparo',()=>{
  const html=file('public/mapa-rotas.html');const js=file('public/js/mapa.js');
  for(const id of ['map-search','map-status','map-origin-mode','map-optimize','map-delivery-list','map-select-eligible','map-fix-location','map-fix-auto','map-fix-save'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(js,/openLocationFix/);assert.match(js,/repairLocation/);assert.match(js,/\/localizacao/);
  assert.match(file('public/css/refino-v37.css'),/grid-template-columns:minmax\(345px,380px\)/);
});
test('reparo de destino é restrito a gestor e administrador, validado e transacional',()=>{
  const routes=file('src/routes/entregaRoutes.js');const controller=file('src/controllers/entregaController.js');
  assert.match(routes,/router\.patch\('\/entregas\/:id\/localizacao', autenticar, permitir\('Administrador', 'Gestor'\)/);
  assert.match(controller,/const corrigirLocalizacao = asyncHandler/);assert.match(controller,/sequelize.transaction/);assert.match(controller,/Number.isFinite/);assert.match(controller,/EventoEntrega.create/);
});
test('simulação explica a falta de coordenadas e indica solução',()=>{
  assert.match(file('public/simulacoes.html'),/sim-location-alert/);
  assert.match(file('public/js/app.js'),/pendentesLocalizacao/);
  assert.match(file('public/simulacoes.html'),/Corrigir coordenadas de entregas no mapa/);
});
