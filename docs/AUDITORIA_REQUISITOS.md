# UrbanLink Flow — Auditoria de requisitos e limites

> Esta auditoria descreve a evolução da V3.7 e os requisitos avaliados. Na versão atual, as páginas de guia foram removidas do site, o manual existe apenas em `docs/GUIA_DE_USO.md` e o tema escuro não é oferecido.

**Escopo analisado:** código-fonte da V3.6; `EP 190 - URBANLINK - Desenvolvimento de Sistemas.pdf` (6 páginas); `Resumo Expandido - UrbanLink Flow (1).pdf` (3 páginas); e `UrbanLink Flow - Protótipo(1).zip`, que contém telas de referência, principalmente PDFs exportados e uma imagem PNG do painel administrativo.

**Objetivo da revisão:** alinhar interface e documentação à proposta pedagógica sem alterar silenciosamente o fluxo de negócio ou afirmar recursos de produção que não existem. A V3.7 parte da V3.6; os dados do banco não são apagados.

## 1. Alterações efetivamente realizadas

| Item | Local | Modificação | Por quê |
|---|---|---|---|
| 1 | `public/mapa-rotas.html`, `css/refino-v37.css` | Mapa reorganizado em 3 etapas visuais: localizar, selecionar e planejar; maior hierarquia, espaçamentos, resumo e áreas de ação agrupadas | Resolver confusão da operação logística à esquerda do mapa |
| 2 | `public/js/mapa.js` | Botão **Selecionar elegíveis** agrupa apenas entregas roteirizáveis de um mesmo motorista, com contagem visível | Evitar seleções incompatíveis e explicar o próximo passo |
| 3 | `public/js/mapa.js` | Pedidos sem localização exibem **Corrigir localização** para Administrador/Gestor; janela com consulta automática e opção de latitude/longitude manual | Permitir corrigir entregas antigas sem apagar pedidos e viabilizar simulações |
| 4 | `src/routes/entregaRoutes.js`, `src/controllers/entregaController.js` | Novo `PATCH /api/entregas/:id/localizacao` com autenticação e permissões restritas, validação de números, bloqueio de entregas finalizadas, atualização e evento de auditoria em transação | A alteração não pode ser feita apenas no navegador; dados persistem no MySQL |
| 5 | `public/simulacoes.html`, `public/js/app.js` | Mensagem específica de quantas entregas ativas estão sem coordenadas e acesso direto à correção no mapa | Explicar por que pedidos não aparecem no simulador |
| 6 | `public/inicial-motorista.html`, `css/refino-v37.css` | Operação ao lado do mapa dividida em cartões mais espaçosos, explicação da etapa, ações paralelas e sequência com legenda | Melhorar leitura da próxima parada e ações |
| 7 | `public/*.html`, `css/refino-v37.css` | Footer em todas as telas com marca e links úteis (sem link para guia interno) | Padronização e navegação consistente |
| 8 | `public/index.html`, `public/cadastro-*.html`, `public/assets/icon-*.png` | Ícones PNG extraídos da referência de seleção de perfis e aplicados aos cartões e etiquetas de cadastro; estilos fiéis à paleta azul-marinho, azul-claro e laranja | Aproximação do Figma exportado no ZIP (sem dependência de emojis) |
| 9 | `docs/GUIA_DE_USO.md` | Guia completo por perfil, mapa, simulações e solução de problemas, fornecido apenas como documento externo ao site | Ensinar a utilizar cada função sem incluir guias na interface |
| 10 | `docs/openapi.json`, `README.md` | Documentação do endpoint novo, novas orientações e versão 3.7 | Facilitar manutenção e demonstração |

**Fontes do protótipo:** os arquivos fornecidos representam majoritariamente PDFs de telas, não um repositório de fotos separadas. Três ícones foram recortados de uma tela de seleção de perfis fornecida no ZIP e salvos como `icon-cliente.png`, `icon-entregador.png` e `icon-administrador.png`. Não foram inventadas imagens nem substituídos conteúdos do usuário por fotos de banco de imagens.

## 2. Matriz comparativa com o enunciado EP 190

| Requisito do EP 190 | Situação verificada no código | Ação/pendência |
|---|---|---|
| Frontend responsivo com autenticação, painéis e mapa | **Implementado, refinado** | Reestilizado e documentado. Validar em dispositivos reais |
| Backend RESTful / regras de negócio / CRUD das entidades | **Implementado em parte conforme entidade** | Há cadastro/consulta, atualização de status, desativação, exclusões específicas; não existe um CRUD genérico completo para cada entidade. Rotas são geradas por ação de otimização, não por POST CRUD livre |
| Banco de dados relacional normalizado, PK/FK | **Implementado** | `database/schema.sql`, modelos Sequelize, relacionamentos. Rotas e simulações guardam lista de IDs em coluna JSON, o que não é relacionamento normalizado de paradas: modelar tabela de associação futuramente |
| Modelagem conceitual, lógica e física | **Parcial** | Modelo físico SQL presente; documentação conceitual/lógica deve ser expandida para entrega formal. Visão de entidades abaixo |
| Indicadores operacionais | **Implementado em parte** | Painéis e simulações contêm métricas; métricas de tráfego em tempo real não são inferidas automaticamente |
| Otimização de rotas e cálculo de tempo/distância | **Implementado, com limitação matemática** | Vizinho mais próximo e distância Haversine aproximada; desenho viário via serviço externo quando disponível, mas cálculo não representa trânsito real |
| Simulador de cenários | **Implementado como simulador matemático** | Velocidade e fator de congestionamento fornecidos manualmente; não usa dados reais de tráfego |
| Documentação técnica, README e OpenAPI | **Implementado em parte** | `README.md`, `docs/openapi.json`, esta auditoria e guia. Recomendado testar todos os endpoints em ferramenta de API e manter OpenAPI atualizado |
| Versionamento Git | **Não verificável no ZIP** | ZIP de distribuição não comprova histórico de commits; publicar repositório versionado e registrar branches/tags |
| Segurança/qualidade | **Implementado em parte** | JWT, perfis, validações e transações nas funções críticas. Ainda exige avaliação de segurança, testes integrados e política de documentos sensíveis antes de produção |

**Fonte:** `EP 190 - URBANLINK - Desenvolvimento de Sistemas.pdf`, páginas 2–5, especialmente exigências de frontend, API, banco, regras, mapas e testes.

## 3. Comparação com o resumo expandido

O `Resumo Expandido - UrbanLink Flow (1).pdf`, páginas 1–2, propõe três frentes: plataforma de logística com mapas e monitoramento; **jogo simulador educativo**; e identidade visual. A implementação entregue neste ZIP é a plataforma web e seu simulador matemático de cenários. **Não foi implementado um jogo independente**, personagens, fases ou experiência de jogo. Isso precisa permanecer como produto/eixo separado ou requisito futuro.

O resumo menciona “dados de trânsito em tempo real”, “monitoramento em tempo real” e otimização por condições urbanas. O sistema atual só apresenta a **última posição GPS compartilhada voluntariamente** pelo motorista e um modelo simulado de congestionamento. Não existe feed de tráfego em tempo real, nem acompanhamento contínuo em background, nem previsão real de chegada baseada em tráfego. Não apresentar no pitch como capacidades prontas sem implementar e testar essas integrações.

## 4. Entidades e relações principais observadas

- **Usuário**: Cliente, Motorista, Administrador, Gestor; aprovado/ativo, credenciais e contato; documento de CNH protegido no fluxo administrativo.
- **Veículo**: motorista vinculado, status, tipo, carga e posições geográficas compartilhadas.
- **Entrega**: cliente/autor, motorista e veículo opcionais, origem/destino, estado, histórico e localização.
- **Evento de entrega**: relacionamento com entrega e ator para trilha de ações.
- **Rota**: motorista/autor, origem, status, distância estimada e sequência de IDs em JSON.
- **Simulação**: criador, entregas selecionadas, origem, velocidade, congestionamento e resultados estimados.
- **Chamado**: autor, mensagem, resposta, estado.

O SQL físico e as chaves estrangeiras estão em `database/schema.sql`. Não se deve confundir essa lista de entidades com um DER formal completo.

## 5. Limitações técnicas e passos necessários para produção

1. **MySQL real**: ainda precisa de teste de ponta a ponta em ambiente com credenciais reais. Nunca incluir `.env` com segredos no ZIP distribuído.
2. **Endereços antigos**: correção individual no mapa; não fazemos varredura em massa para respeitar o provedor externo. Se o serviço falhar, informe coordenadas manuais verificadas.
3. **Geocodificação**: Nominatim público adequado apenas a baixo volume e sujeito a indisponibilidade; é necessário identificar o contato, manter limite de consultas e usar serviço apropriado para produção.
4. **Rotas**: distância matematicamente aproximada; desenho via OSRM depende de terceiro. Não prometer rota ideal pelo trânsito atual.
5. **GPS**: posição compartilhada ao clicar e mediante permissão; não há rastreamento em tempo real contínuo.
6. **Atendimento**: chamado e resposta, não chat multi-mensagens ilimitado; a interface visual se parece com chat.
7. **Simulação**: sem feed real de trânsito nem jogo independente. Mantida modelagem quantitativa para fins didáticos.
8. **Documentos pessoais**: CNH exige tratamento seguro, controle de acesso e política de retenção adequados; auditoria jurídica/LGPD ainda não feita.
9. **Qualidade visual**: o ZIP original inclui PDFs de telas, não assets editáveis de Figma. Para fidelidade pixel a pixel seria necessário o arquivo Figma original e design tokens; o resultado é uma aproximação consistente baseada nas referências disponibilizadas.
10. **Testes**: a suíte é predominantemente de lógica e estrutura; integrações externas e geolocalização real dependem de validação manual.

## 6. Como rodar e conferir a nova versão

1. Faça backup do banco e do `.env` original; não recrie o banco ao atualizar.
2. Extraia o ZIP e use a única pasta `public` de `urbanlink-flow-main`.
3. Configure `.env`: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, ADMIN_INVITE_CODE. Não copie os segredos de exemplo.
4. Para geocodificação de baixo volume: `GEOCODING_ENABLED=true`, `GEOCODING_PROVIDER=nominatim`, `GEOCODING_CONTACT_EMAIL=` com e-mail válido, `GEOCODING_API_KEY=` vazio.
5. Execute `npm install`, `npm test` e `npm start`; acesse `http://localhost:3000`.
6. Entre como administrador, abra Mapa e rotas, localize uma entrega antiga sem coordenadas, clique em **Corrigir localização**, confirme o resultado, volte a Simulações e confira se aparece na seleção.
7. Faça uma solicitação como cliente, atribua motorista/veículo na gestão e teste mapa e confirmação como motorista aprovado.

## 7. Checklist de aceite para demonstração

- [ ] O footer e o acesso ao guia aparecem em todas as páginas.
- [ ] A seleção de perfis mostra ícones PNG do protótipo, sem emojis.
- [ ] Layout do mapa tem etapas legíveis em desktop e mobile.
- [ ] Entrega sem coordenadas pode ser corrigida por Administrador/Gestor; motorista não tem permissão na API.
- [ ] Após correção, entrega válida aparece no mapa e no simulador (recarregar Simulações).
- [ ] Motorista aprovado compartilha GPS mediante autorização explícita; navegador exibe marcador da última posição.
- [ ] Operação da próxima parada mantém os botões legíveis e acessíveis.
- [ ] Nenhuma rota mistura motoristas; nenhum veículo ocupado recebe atribuição indevida.
- [ ] OpenAPI, README, guia e matrizes de requisitos incluídos no ZIP.
- [ ] Teste real com MySQL e browser passa antes de apresentar como produção.
