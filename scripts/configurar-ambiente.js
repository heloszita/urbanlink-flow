'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { conviteAdminValido, segredoValido } = require('../src/config/segredos');
const raiz = path.join(__dirname, '..');
const arquivoEnv = path.join(raiz, '.env');
const arquivoModelo = path.join(raiz, '.env.example');

if (fs.existsSync(arquivoEnv)) {
  console.log('O arquivo .env já existe e não foi sobrescrito.');
  console.log('Execute npm run verificar-config para conferir a configuração, ou edite ADMIN_INVITE_CODE manualmente.');
  process.exit(0);
}
if (!fs.existsSync(arquivoModelo)) {
  console.error('Arquivo .env.example não encontrado.');
  process.exitCode = 1;
} else {
  const jwt = crypto.randomBytes(32).toString('hex');
  const admin = 'ul-' + crypto.randomBytes(18).toString('hex');
  if (!segredoValido(jwt) || !conviteAdminValido(admin)) throw new Error('Falha ao gerar segredos seguros.');
  let modelo = fs.readFileSync(arquivoModelo, 'utf8');
  modelo = modelo.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwt}`);
  modelo = modelo.replace(/^ADMIN_INVITE_CODE=.*$/m, `ADMIN_INVITE_CODE=${admin}`);
  fs.writeFileSync(arquivoEnv, modelo, { flag: 'wx', mode: 0o600 });
  console.log('Arquivo .env criado com JWT_SECRET e ADMIN_INVITE_CODE exclusivos.');
  console.log('IMPORTANTE: configure os campos DB_* no .env conforme seu banco MySQL.');
  console.log('Código para cadastrar administrador (guarde em local privado): ' + admin);
  console.log('Este código não é a senha de login e não deve ser publicado.');
}
