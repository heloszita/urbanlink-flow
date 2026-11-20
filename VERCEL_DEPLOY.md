# Publicação do UrbanLink Flow na Vercel

## Antes de publicar

- Envie o conteúdo desta pasta ao GitHub. Não envie `.env` nem `node_modules`.
- Na Vercel, importe o repositório e mantenha esta pasta como diretório raiz do projeto.
- A Vercel detectará `api/index.js` como função Node.js. O `vercel.json` encaminha `/api/*` para essa função; o conteúdo estático é publicado a partir de `public/`.

## Banco MySQL

O MySQL local do computador não pode ser usado pela aplicação publicada. Crie/contrate um MySQL acessível externamente e importe `database/schema.sql` no banco remoto. Depois configure as variáveis em Project Settings → Environment Variables:

- `DB_HOST`: host fornecido pelo provedor (não use `127.0.0.1`)
- `DB_PORT`: porta do MySQL, normalmente `3306`
- `DB_NAME`: nome do banco
- `DB_USER`: usuário do banco
- `DB_PASSWORD`: senha do banco
- `DB_SSL`: `true` se o provedor exigir TLS; caso contrário `false`
- `DB_POOL_MAX`: `2`
- `JWT_SECRET`: segredo aleatório forte, com pelo menos 24 caracteres
- `DB_SYNC`: `false`

Não configure `NODE_ENV` manualmente se a Vercel já estiver definindo `production`. Não copie valores reais para este arquivo ou para o GitHub. Após cadastrar variáveis, faça um novo deploy.

## Testes após deploy

1. Abra `https://SEU-DOMINIO/api/health` e confirme o JSON com `status: ok`.
2. Abra a página inicial, cadastre ou entre com um usuário de teste.
3. Teste cadastro, login, CRUD e permissões de cada perfil.
4. Na página Mapa e rotas, confirme que entregas com latitude/longitude aparecem. Autorize a localização do navegador para calcular uma rota a partir da sua posição.
5. Teste o mapa em celular e computador.

## Mapa e serviços externos

A interface usa Leaflet, mapas-base do OpenStreetMap e o serviço público OSRM para desenhar caminhos de rua. Esses serviços dependem de internet e de limites/ disponibilidade de terceiros. A otimização gravada pela API usa o algoritmo existente do projeto, que estima distância entre coordenadas; o traçado OSRM é uma visualização de percurso viário e não altera a distância persistida.

## Limitações a considerar

- O navegador precisa de HTTPS e permissão para obter geolocalização.
- Entregas sem coordenadas não podem ser plotadas nem incluídas na otimização.
- Veículos só aparecem quando há posição gravada por um motorista/usuário autorizado.
- O sistema guarda o documento de CNH em campo de banco de dados, mas a capacidade e o limite de tamanho devem ser verificados com o provedor MySQL escolhido.
- A pasta local `uploads/` não é armazenamento persistente na Vercel. Se futuramente a aplicação passar a gravar arquivos físicos ali, será necessário migrar esses arquivos para armazenamento de objetos externo.
