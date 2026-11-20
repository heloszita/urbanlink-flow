# UrbanLink Flow — instalação e operação

Plataforma web para gestão de entregas urbanas, com front-end HTML/CSS/JavaScript, API Node.js/Express, banco MySQL/Sequelize, mapas Leaflet/OpenStreetMap, otimização aproximada de rotas e simulação de cenários. A interface funciona exclusivamente em **tema claro**.

## Requisitos

- Node.js 20 ou superior, npm e MySQL 8 (ou compatível com Sequelize 6).
- Internet para carregar os mapas e consultar o serviço de geocodificação/rotas.
- Navegador atualizado. Para compartilhar posição GPS, use `localhost` ou HTTPS e conceda a permissão de localização.

## Instalação e configuração

1. Extraia o projeto e abra a pasta `urbanlink-flow-main` no terminal.
2. Execute `npm install`.
3. Crie o banco `urbanlink_flow` e execute `database/schema.sql` no MySQL Workbench. Com `DB_SYNC=true`, o Sequelize também pode criar tabelas ao iniciar, conforme a configuração do ambiente.
4. Crie `.env` com base em `.env.example` (`Copy-Item .env.example .env` no PowerShell). **Não publique o `.env`**, pois contém credenciais.
5. Ajuste os campos `DB_*` para seu MySQL e configure `JWT_SECRET` com ao menos 24 caracteres aleatórios e `ADMIN_INVITE_CODE` privado com pelo menos 12 caracteres. Os valores ilustrativos do `.env.example` são rejeitados. Para instalações novas, `npm run configurar` pode gerar os segredos sem sobrescrever um `.env` existente. `npm run verificar-config` valida a configuração.
6. Para localizar endereços por rua/número, configure no `.env`:

   ```env
   GEOCODING_ENABLED=true
   GEOCODING_PROVIDER=nominatim
   GEOCODING_CONTACT_EMAIL=contato-valido@exemplo.com
   GEOCODING_API_KEY=
   ```

   Use seu e-mail de contato e confira `docs/LOCALIZACAO_AUTOMATICA.md`. O Nominatim público é adequado apenas para baixo volume e exige respeito à política de utilização; em produção configure provedor apropriado. A busca depende de internet e pode não encontrar todos os endereços.

7. Execute `npm start` e acesse `http://localhost:3000`. Verifique `/api/health` e `/api/docs`.
8. Rode `npm test` para testar as regras e a estrutura do projeto. Os testes automatizados não substituem integração real com MySQL.

Ao atualizar uma versão existente, preserve o `.env` e o banco de dados. **Não apague nem recrie tabelas** apenas para aplicar esta limpeza.

## Perfis e fluxo principal

1. **Cliente:** cria conta, solicita entrega e acompanha status, localização disponível e atendimento.
2. **Administrador/Gestor:** cria ou gerencia a operação, analisa CNH e aprova motoristas, atribui motoristas/veículos a pedidos e acessa indicadores, mapas, relatórios, mensagens e simulações. Gestor pode ser criado por administrador pela API.
3. **Motorista:** anexa CNH, cadastra veículo e aguarda aprovação; depois vê pedidos atribuídos, compartilha posição manualmente e atualiza as etapas das entregas.

Fluxo: **Cliente solicita → Administrador atribui motorista e veículo → Motorista executa → Cliente acompanha**. Situação habitual: `Pendente → Aguardando coleta → Em trânsito → Saiu para entrega → Entregue`. O sistema valida transições e permissões no backend.

### Limites do mapa e das simulações

- O mapa é interativo e exibe entregas com coordenadas e últimas posições compartilhadas; exige conexão para os mapas e serviços externos.
- A sequência de paradas utiliza vizinho mais próximo / distância de Haversine, **não** trânsito em tempo real.
- O traçado viário pode depender do OSRM e não equivale à otimização de deslocamento com dados atuais de tráfego.
- Pedidos antigos ou endereços não localizados podem permanecer sem coordenadas; o administrador pode tentar corrigir em **Mapa e rotas**.
- Simulações usam velocidade e fator de congestionamento definidos pelo usuário; não são medições de trânsito ao vivo.

## Estrutura do projeto

| Pasta ou arquivo | Finalidade |
|---|---|
| `public/` | Única pasta pública: páginas, estilos, scripts e assets |
| `src/` | Controladores, serviços, modelos, middlewares, rotas e API |
| `database/schema.sql` | Estrutura inicial do banco MySQL |
| `api/index.js` | Entrada para implantação serverless |
| `tests/` | Testes automatizados (`npm test`) |
| `scripts/` | Configuração e checagem do `.env` |
| `docs/GUIA_DE_USO.md` | Manual de uso por perfil, **fora do site** |
| `docs/AUDITORIA_REQUISITOS.md` | Comparação com requisitos do projeto e limites conhecidos |
| `docs/LOCALIZACAO_AUTOMATICA.md` | Geocodificação e cuidados com provedores externos |
| `docs/openapi.json` | Contrato OpenAPI (acessível por `/api/docs/openapi.json`) |
| `docs/RELATORIO_LIMPEZA.md` | O que foi removido e preservado nesta versão |

## Regras importantes

- O `.env` é privado. Não inclua códigos de administrador, JWT ou senhas de banco em commits ou em capturas compartilhadas.
- A conta do motorista precisa ser aprovada antes de operações restritas.
- No modelo atual, apenas uma entrega ativa pode ocupar um veículo por vez.
- A criação ou alteração de uma entrega registra histórico; as operações críticas usam transações quando cabível.
- O favicon com símbolo UrbanLink é exibido **somente em `index.html`**; as páginas internas não usam esse ícone na aba. Os ícones dentro da interface continuam.
- Não há páginas de guia dentro do site; o documento de uso está apenas em `docs/GUIA_DE_USO.md`.

Para rotas e payloads da API, consulte `docs/openapi.json` ou acesse `/api/docs` com o servidor iniciado.
