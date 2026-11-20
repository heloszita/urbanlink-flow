# UrbanLink Flow — Limpeza conservadora (V3.11)

## Escopo

Base: V3.10.2. Esta revisão é limitada a arquivos não usados, documentação, ícones de aba e estilos específicos de páginas de guia removidas. **Não foram alterados controladores, modelos, rotas, serviços, migrações, regras de negócio, estruturas de formulários ou a lógica do frontend.**

## Alterações

- Favicon UrbanLink mantido em `public/index.html`; as outras páginas definem um favicon vazio com `href="data:,"` para não reutilizar o símbolo. Os ícones dos cartões e das telas permanecem.
- Removidos `public/assets/mapa-esquematico.svg`, `public/assets/logo-positiva.png` e `public/assets/logo-negativa.png`: não eram referenciados por HTML, JavaScript ou CSS ativos. Mantidos `logo.png`, PNGs de perfis, `avatar.svg` e ícones da aba usados na `index.html`.
- Removidas exclusivamente regras CSS para páginas de guia que já não existem, de `refino-v37.css` e `visual.css`. **Os demais arquivos CSS foram mantidos**, pois podem conter regras sobrepostas cuja remoção sem teste visual poderia mudar a aplicação.
- Eliminados relatórios de versões antigas e um guia DOCX redundante do pacote. Permaneceram manual de uso externo (`docs/GUIA_DE_USO.md`), auditoria de requisitos, orientação de geocodificação, contrato `docs/openapi.json` e este relatório.
- `README.md` refeito em formato de documentação atual, sem afirmações e links de versões descontinuadas. A versão do pacote em `package.json` e `package-lock.json` foi sincronizada para `3.11.0`, sem mudar dependências.

## O que permanece inalterado

- API REST, banco MySQL e Sequelize, scripts de configuração, autenticação e permissões.
- Cadastro de cliente, administrador e motorista, CNH, aprovação, atribuição e atualização de entregas.
- Mapa interativo, geocodificação, rotas, simulações, atendimento e patrocinadores.
- Rodapé, favicon apenas no index, fontes, cores, responsividade e tema claro.

## Validação e limites

A suíte automatizada do projeto e o teste estrutural de referências locais devem ser executados com `npm test`. Verificações automatizadas **não substituem** testes de ponta a ponta com MySQL, navegador e serviços externos configurados. Nenhuma migração de banco é necessária. Preserve o `.env` existente e o banco de dados ao atualizar.
# Ajustes visuais de autenticação — V3.12

- Removidos os ícones dentro das faixas **Cliente**, **Entregador** e **Administrador** nas páginas de cadastro; os ícones de perfil continuam apenas nos cartões do `index.html`.
- Inserido cabeçalho com logotipo **UrbanLink Flow** no canto esquerdo das 3 páginas de cadastro, 3 páginas de login e etapa de informações do veículo, usando o mesmo arquivo `assets/logo.png` do index.
- Mantido o acesso **Entrar** à direita no cadastro; páginas de login oferecem **Criar conta** e a etapa de veículo apresenta **Meu painel**.
- Aumentado o espaçamento entre cabeçalho e formulários; layout fluido inclusive em telas estreitas.
- Nenhuma rota de API, schema do banco de dados, JavaScript funcional ou lógica dos formulários foi modificada.

## Verificações

Execute `npm test` na pasta do projeto. Após atualizar, use Ctrl+F5 para atualizar os estilos em cache. Verifique as telas de cadastro e login em desktop e celular.


## Ajuste V3.13 — favicon

O favicon da UrbanLink foi restaurado em todas as páginas HTML. O pedido anterior referia-se aos ícones decorativos das faixas de cadastro, e não ao ícone da aba do navegador. Os ícones decorativos continuam exclusivos dos cartões de seleção do `index.html`. Nenhuma rota, script funcional ou banco de dados foi alterado.
