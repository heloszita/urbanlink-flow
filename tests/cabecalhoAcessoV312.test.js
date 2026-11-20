const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const auth=['cadastro-cliente.html','cadastro-motorista.html','cadastro-adm.html','login.html','login-motorista.html','login-adm.html','info-motorista.html'];
test('todas as telas de cadastro/login/veículo exibem logo UrbanLink no cabeçalho',()=>{
  for(const filename of auth){
    const html=read('public/'+filename);
    assert.match(html,/<header class="auth-topbar auth-header"/,filename);
    assert.match(html,/class="auth-header-brand" href="index\.html"[^>]*><img src="\.\/assets\/logo\.png"/,filename);
    assert.match(html,/<\/header>\s*<main class="area-autenticacao">/,filename);
  }
});
test('faixas de cadastro não exibem imagens de perfil; index mantém ícones',()=>{
  for(const filename of auth.slice(0,3)) {
    assert.doesNotMatch(read('public/'+filename),/<div class="etiqueta-tipo-usuario">\s*<img/);
  }
  const home=read('public/index.html');
  for(const role of ['cliente','entregador','administrador']) assert.ok(home.includes(`./assets/icon-${role}.png`));
});
test('cabeçalho tem espaçamento, quebra de linha e os campos continuam com ids originais',()=>{
  const css=read('public/css/responsividade.css');
  assert.match(css,/\.auth-header \+ \.area-autenticacao\s*\{\s*padding-top:clamp\(66px/);
  assert.match(css,/\.auth-topbar\.auth-header\s*\{/);
  assert.match(css,/@media \(max-width:610px\)/);
  for(const name of auth.slice(0,3)) {
    const html=read('public/'+name);
    for(const id of ['form-cadastro','nome','email','senha'])assert.ok(html.includes(`id="${id}"`));
  }
});
