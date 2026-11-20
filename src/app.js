require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const sequelize = require('./config/database');
const { segredoValido } = require('./config/segredos');
require('./models');

const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const veiculoRoutes = require('./routes/veiculoRoutes');
const entregaRoutes = require('./routes/entregaRoutes');
const geocodingRoutes = require('./routes/geocodingRoutes');
const rotaRoutes = require('./routes/rotaRoutes');
const chamadoRoutes = require('./routes/chamadoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const simulacaoRoutes = require('./routes/simulacaoRoutes');

const app = express();
const raizProjeto = path.join(__dirname, '..');
const publicRaiz = path.join(raizProjeto, 'public');
const publicDir = publicRaiz;
let conexaoBanco = null;

async function garantirBanco() {
  if (!segredoValido(process.env.JWT_SECRET)) throw new Error('Configure JWT_SECRET com um segredo aleatório próprio (mínimo de 24 caracteres).');
  if (!conexaoBanco) {
    conexaoBanco = sequelize.authenticate().catch((erro) => { conexaoBanco = null; throw erro; });
  }
  await conexaoBanco;
}

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', banco: 'conectado', sistema: 'UrbanLink Flow', timestamp: new Date().toISOString() });
  } catch (_erro) {
    res.status(503).json({ status: 'indisponivel', banco: 'sem conexão', sistema: 'UrbanLink Flow' });
  }
});

// Contatos opcionais exibidos no atendimento; os valores vêm do .env do responsável.
app.get('/api/config/public', (_req, res) => res.json({
  telefoneAtendimento: process.env.SUPPORT_PHONE || '',
  emailAtendimento: process.env.SUPPORT_EMAIL || ''
}));

app.get('/api/docs', (_req, res) => {
  res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UrbanLink Flow API</title><style>body{font:16px Arial,sans-serif;max-width:900px;margin:48px auto;padding:0 20px;color:#1b1642}a{color:#f35b3f}code{background:#eef2f6;padding:3px 6px;border-radius:4px}li{margin:10px 0}</style><h1>UrbanLink Flow — API</h1><p>Documentação OpenAPI da API REST.</p><p><a href="/api/docs/openapi.json">Abrir especificação OpenAPI em JSON</a></p><ul><li><code>POST /api/auth/cadastro</code> — cadastro de cliente, motorista ou administrador com convite.</li><li><code>POST /api/auth/login</code> — autenticação JWT.</li><li><code>/api/usuarios</code> — gestão de usuários e aprovação de motoristas.</li><li><code>/api/veiculos</code> — cadastro, consulta e posição da frota.</li><li><code>/api/entregas</code> — CRUD e ciclo de status das entregas.</li><li><code>/api/rotas</code> — planejamento e otimização de rota por coordenadas.</li><li><code>/api/chamados</code> — atendimento e suporte.</li><li><code>GET /api/dashboard/resumo</code> — indicadores do painel.</li><li><code>/api/simulacoes</code> — criação, consulta e exclusão de simulações de cenários.</li></ul><p>As rotas protegidas usam <code>Authorization: Bearer TOKEN</code>.</p></html>`);
});

app.get('/api/docs/openapi.json', (_req, res) => {
  const spec = path.join(__dirname, '..', 'docs', 'openapi.json');
  if (!fs.existsSync(spec)) return res.status(404).json({ mensagem: 'Especificação não encontrada.' });
  res.sendFile(spec);
});

// A Vercel executa funções sob demanda: a conexão é reutilizada enquanto a instância estiver aquecida.
app.use('/api', async (req, res, next) => {
  try { await garantirBanco(); next(); } catch (erro) { next(erro); }
});

app.use('/api/auth', authRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', veiculoRoutes);
app.use('/api', entregaRoutes);
app.use('/api', geocodingRoutes);
app.use('/api', rotaRoutes);
app.use('/api', chamadoRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', simulacaoRoutes);

app.use(express.static(publicDir, { extensions: ['html'], index: 'index.html' }));
if (process.env.VERCEL !== '1') {
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { dotfiles: 'deny', index: false }));
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ mensagem: 'Endpoint não encontrado.' });
  const pagina404 = path.join(publicDir, '404.html');
  if (fs.existsSync(pagina404)) return res.status(404).sendFile(pagina404);
  res.status(404).type('text').send('Página não encontrada.');
});

app.use((erro, _req, res, _next) => {
  let status = Number(erro.status || 500);
  if (erro.name === 'SequelizeValidationError' || erro.name === 'SequelizeDatabaseError') {
    status = erro.name === 'SequelizeValidationError' ? 422 : 500;
  }
  if (status >= 500) console.error('[UrbanLink API]', erro);
  const mensagem = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor. Tente novamente mais tarde.'
    : (erro.message || 'Não foi possível concluir a solicitação.');
  res.status(status).json({ mensagem });
});

async function iniciarServidor() {
  if (!segredoValido(process.env.JWT_SECRET)) {
    throw new Error('Configure JWT_SECRET com um segredo aleatório próprio no arquivo .env.');
  }
  await garantirBanco();
  console.log('Conectado ao banco de dados MySQL do UrbanLink Flow.');
  const sincronizar = process.env.DB_SYNC === 'true' || (process.env.NODE_ENV !== 'production' && process.env.DB_SYNC !== 'false');
  if (sincronizar) {
    await sequelize.sync();
    console.log('Modelos e tabelas sincronizados.');
  }
  const port = Number(process.env.PORT || 3000);
  return app.listen(port, () => console.log(`UrbanLink Flow disponível em http://localhost:${port}`));
}

if (require.main === module) {
  iniciarServidor().catch((erro) => {
    console.error('Não foi possível iniciar o UrbanLink Flow:', erro.message);
    process.exit(1);
  });
}

module.exports = { app, iniciarServidor };
