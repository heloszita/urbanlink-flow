const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const wcagContrast = (one,two) => {
  const lum = h => {
    let c = h.replace('#',''); if(c.length===3)c=[...c].map(x=>x+x).join('');
    const [r,g,b] = [0,2,4].map(i => parseInt(c.slice(i,i+2),16)/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return 0.2126*r+0.7152*g+0.0722*b;
  };
  const a=lum(one),b=lum(two);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
test('combinações de cores do tema cumprem contraste mínimo em texto normal',()=>{
  for(const [text,bg] of [
    ['#edf3fc','#1b2a3d'], ['#b9c9df','#1b2a3d'],
    ['#f1f5fd','#132237'],['#b6c4d7','#132237'],
    ['#e5edfa','#2a3c54'],['#ffc2ad','#1b2a3d'],
    ['#ffffff','#b64934'],['#b8c9de','#172437'],
  ]) assert.ok(wcagContrast(text,bg)>=4.5,`${text}/${bg}: ${wcagContrast(text,bg)}`);
});
test('o site não aplica tema escuro nem inverte as camadas do mapa',()=>{
  const css = read('public/css/identidade.css');
  assert.match(css,/color-scheme:light/);
  assert.doesNotMatch(css,/filter\s*:\s*invert\(/);
  assert.doesNotMatch(read('public/js/app.js'),/function applyTheme\(/);
  assert.ok(!fs.existsSync(path.join(root,'public/css/tema-v39.css')));
});
test('formulários mantêm estrutura V3.6, rótulos sem ícones e navegação sem guias',()=>{
  for(const file of ['login.html','login-motorista.html','login-adm.html','cadastro-cliente.html','cadastro-motorista.html','cadastro-adm.html']){
    const html=read('public/'+file);
    assert.doesNotMatch(html,/css\/refino-v37\.css/,file);
    assert.match(html,/css\/autenticacao.css/,file);
    assert.doesNotMatch(html,/cabecalho-cadastro-ilustrado/,file);
    assert.match(html,/css\/identidade.css\?v=3\.10\.1/,file);
  }
  for(const [name,icon] of [['cadastro-cliente.html','cliente'],['cadastro-motorista.html','entregador'],['cadastro-adm.html','administrador']]){
    assert.doesNotMatch(read('public/'+name),new RegExp(`icon-${icon}\\.png`));
  }
  assert.ok(!fs.existsSync(path.join(root,'public/guia.html')));
  assert.ok(!fs.existsSync(path.join(root,'public/guia-uso.html')));
  assert.doesNotMatch(read('public/js/app.js'),/\['Guia',\s*'guia\.html'\]/);
});
