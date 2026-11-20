# Como rodar o UrbanLink Flow na sua máquina

## 1. Instale os pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou superior, com npm. Na entrega, a instalação foi verificada com Node.js 24.
- [MySQL Community Server](https://dev.mysql.com/downloads/mysql/8.4.html) 8.4 LTS ou posterior e, se preferir uma interface gráfica, [MySQL Workbench](https://dev.mysql.com/downloads/workbench/).
- Um navegador atualizado. Conecte-se à internet para carregar o mapa e consultar as rotas externas.

Inicie o serviço do MySQL e confira a porta e o usuário definidos na instalação. O Workbench é um cliente para acessar o servidor. Mantenha ambos instalados se quiser seguir as instruções gráficas.

## 2. Extraia e instale o projeto

Extraia todo o ZIP. Abra o terminal na pasta que contém o arquivo `package.json` e execute:

```sh
node --version
npm --version
npm ci
npm run configurar
```

O último comando cria o arquivo `.env` com um segredo JWT e um código privado de convite de administrador. Se existir um `.env`, o comando o preserva. Guarde esse arquivo localmente.

## 3. Prepare o MySQL

No Workbench, conecte-se ao MySQL local com uma conta que possa criar bancos e tabelas. Use **File → Open SQL Script** para abrir `database/schema.sql`. Execute todo o arquivo com o botão de raio. O script cria o banco `urbanlink_flow` e suas tabelas.

Você também pode importar pelo terminal a partir da raiz do projeto. Abra o cliente MySQL, informe a senha quando solicitada e execute:

```sh
mysql -h 127.0.0.1 -P 3306 -u root -p
```

```sql
SOURCE database/schema.sql
SHOW TABLES;
EXIT;
```

O script pode ser reaplicado a uma instalação anterior com o banco padrão `urbanlink_flow`. A tabela `recuperacao_conta` será criada e as tabelas e registros existentes serão preservados. Faça um backup antes de atualizar o ambiente do curso.

## 4. Configure e inicie o servidor

Abra o `.env` e preencha os campos do banco com os dados da conexão que acabou de testar:

| Campo | Valor para rodar localmente |
| --- | --- |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | Porta do MySQL, geralmente `3306` |
| `DB_NAME` | `urbanlink_flow` |
| `DB_USER` | Usuário com acesso ao banco |
| `DB_PASSWORD` | Senha do usuário do MySQL |
| `DB_SSL` | `false` para o MySQL local padrão |
| `DB_SYNC` | `false` após a importação do script |
| `PORT` | Porta do site, padrão `3000` |

Se a senha do MySQL contiver espaços ou `#`, coloque-a entre aspas no `.env`. Mantenha os valores gerados de `JWT_SECRET` e `ADMIN_INVITE_CODE`. Considere configurar `SUPPORT_PHONE` e `SUPPORT_EMAIL` se quiser exibir os contatos do curso nas páginas de atendimento.

Para testar a localização automática de endereços em baixo volume, mantenha `GEOCODING_ENABLED=true` e `GEOCODING_PROVIDER=nominatim` e preencha `GEOCODING_CONTACT_EMAIL` com um e-mail válido. Para uma demonstração sem geocodificação externa, use `GEOCODING_ENABLED=false`. A gestão pode inserir coordenadas verificadas em **Mapa e rotas**.

```sh
npm run verificar-config
npm start
```

Abra [o UrbanLink Flow](http://localhost:3000) e confira se [a API está conectada ao banco](http://localhost:3000/api/health). O resultado deve conter `"status":"ok"` e `"banco":"conectado"`. Mantenha o terminal aberto durante a demonstração e pressione Ctrl+C para parar o servidor. Se alterar `PORT`, ajuste as URLs.

## 5. Confira a demonstração

Use dados fictícios e contas com e-mails diferentes. Mantenha o MySQL e o servidor em execução.

1. Na página inicial, cadastre **Cliente**, **Entregador** e **Administrador**. No cadastro administrativo, use o valor de `ADMIN_INVITE_CODE` do seu `.env`. No cadastro do entregador, anexe um arquivo de CNH fictício aceito pela tela e conclua a etapa de cadastro do veículo.
2. Entre como administrador e aprove o motorista após verificar o arquivo na área de análise.
3. Entre como cliente, solicite uma entrega e guarde o código gerado. Consulte a entrega em **Acompanhamento**.
4. Na **Gestão de entregas** do administrador, atribua o pedido a um motorista aprovado e a um veículo disponível.
5. Entre como motorista e avance pelas etapas da entrega. Confira o histórico no perfil do cliente. Se quiser testar GPS, mantenha o acesso por `localhost` e permita a localização quando o navegador solicitar.
6. Para testar o atendimento, envie uma mensagem pelo perfil do cliente e responda em **Mensagens** no perfil administrativo. Confira também **Mapa e rotas** e **Simulações** com entregas que tenham latitude e longitude.
7. No menu do perfil, alterne **Modo escuro** e recarregue a página para verificar a preferência. O mesmo menu contém **Sair da conta**.
8. Para testar a recuperação, abra **Código de recuperação** no menu do perfil, confirme a senha atual e guarde o código. Saia da conta, abra **Esqueci minha senha** no login e use o e-mail e o código para definir uma nova senha. Após o uso, gere outro código para uma futura recuperação.

Em outro terminal, execute `npm test` na raiz para rodar os testes automatizados.

## 6. Resolva problemas de inicialização

- **Falha de conexão com o MySQL.** Confirme que o servidor MySQL está ativo. Teste o host, a porta, o usuário e a senha no Workbench ou no cliente `mysql`, e compare com o `.env`.
- **Banco ou tabela inexistente.** Importe todo o `database/schema.sql` e confira `DB_NAME` no `.env`.
- **Segredo ou convite inválido.** Execute `npm run verificar-config` e confira os valores gerados em `.env`. Use o convite do `.env` no cadastro administrativo.
- **Porta do site ocupada.** Ajuste `PORT` no `.env`, reinicie o servidor e abra o endereço com a nova porta.
- **Mapa sem ponto para uma entrega.** Confira a internet, o endereço e a geocodificação. A gestão pode corrigir a localização manualmente e salvar latitude e longitude em **Mapa e rotas**.
