'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { conviteAdminValido, segredoValido } = require('../src/config/segredos');
const arquivoEnv = path.join(__dirname, '..', '.env');
if (!fs.existsSync(arquivoEnv)) {
  console.error('ERRO: não existe .env. Rode `npm run configurar` ou copie .env.example para .env e edite seus valores.');
  process.exitCode = 1;
} else {
  // Consulta o arquivo diretamente, sem dependências nem conexão ao banco.
  const raw = fs.readFileSync(arquivoEnv, 'utf8');
  const get = name => {
    const line = raw.split(/\r?\n/).find(line => new RegExp(`^\\s*${name}\\s*=`).test(line));
    if (!line) return '';
    let value = line.slice(line.indexOf('=') + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return value;
  };
  const jwtOk = segredoValido(get('JWT_SECRET'));
  const codigoOk = conviteAdminValido(get('ADMIN_INVITE_CODE'));
  console.log('JWT_SECRET:', jwtOk ? 'válido' : 'INVÁLIDO ou de exemplo');
  console.log('ADMIN_INVITE_CODE:', codigoOk ? 'válido' : 'INVÁLIDO ou de exemplo');
  console.log('DB_HOST:', get('DB_HOST') ? 'definido' : 'não definido');
  console.log('DB_NAME:', get('DB_NAME') ? 'definido' : 'não definido');
  console.log('Nenhum segredo foi exibido. Esta verificação não testa a conexão MySQL.');
  if (!jwtOk || !codigoOk) {
    console.error('Corrija os valores no .env, salve e reinicie a aplicação.');
    process.exitCode = 1;
  }
}
