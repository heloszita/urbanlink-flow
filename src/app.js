const express = require('express');
const sequelize = require('./config/database');

// Importa os ficheiros de rotas
const usuarioRoutes = require('./routes/usuarioRoutes');
const authRoutes = require('./routes/authRoutes');
const veiculoRoutes = require('./routes/veiculoRoutes'); // <-- NOVO

require('dotenv').config();

const app = express();

app.use(express.json());

// Registra as rotas na aplicação
app.use('/api', usuarioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', veiculoRoutes); // <-- NOVO

// Teste de conexão e Sincronização com o Banco MySQL
sequelize.authenticate()
  .then(() => console.log('Conectado ao banco MySQL do UrbanLink Flow com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao banco:', err));

// Sincroniza todas as tabelas (usuarios, veiculos, posicoes_veiculo)
sequelize.sync()
  .then(() => console.log('Tabelas de Usuários, Veículos e Posições sincronizadas!'))
  .catch(err => console.error('Erro ao sincronizar tabelas:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor UrbanLink Flow rodando na porta 3000`));