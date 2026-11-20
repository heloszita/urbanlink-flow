# Guia completo de uso — UrbanLink Flow

MANUAL DE OPERAÇÃO

# Como usar o UrbanLink Flow

O caminho completo para cada perfil, da solicitação do cliente à entrega concluída. Consulte também os avisos sobre mapas e simulações.

**Conteúdo:** primeiros passos; cliente; administrador; motorista; mapas e rotas; simulações; erros comuns.

01

## Primeiros passos e acesso

1. Na tela inicial selecione **Cliente**, **Entregador** ou **Administrador**.
2. Crie a conta com um e-mail válido e senha exclusiva. Para entrar depois, use **Entrar** no topo.
3. O motorista envia a CNH e os dados do veículo; a operação fica bloqueada até aprovação do administrador. O administrador precisa de um código de convite definido no servidor.
4. Para sair, clique no **nome do perfil** no cabeçalho e escolha **Sair da conta**.

02

## Cliente — pedir e acompanhar entregas

1. Abra seu painel inicial e escolha **Nova entrega**.
2. Informe destinatário, endereço completo (rua, número, bairro, cidade, UF e CEP), tipo de veículo e os dados da carga.
3. Use **Localizar endereço** para conferir as coordenadas sugeridas. Se não houver resultado, complemente o endereço ou informe o ponto manualmente onde houver essa opção.
4. Envie a solicitação: ela entra como **Pendente**, ainda sem motorista.
5. Em **Acompanhamento**, consulte código, status e eventos; o mapa exibe a localização somente quando houver coordenadas válidas.
6. Se houver problema, abra **Atendimento**. A resposta do suporte aparece no histórico do chamado. Pedidos ainda não despachados podem ser cancelados pelas opções disponíveis.

03

## Administrador / Gestor — organizar a operação

1. Abra o **Painel inicial** para ver indicadores e ações rápidas.
2. Em **Gestão de entregas**, abra a aba **Sem motorista** e clique em **Atribuir motorista** em um pedido pendente.
3. Selecione um motorista **aprovado** e um veículo disponível e compatível com peso, volume e tipo exigido. Confirme a atribuição.
4. Analise motoristas pendentes e sua **CNH** nas ações administrativas; aprove somente após a conferência.
5. Em **Mapa e rotas**, localize pedidos, corrija os que estiverem sem coordenadas, selecione paradas do mesmo motorista e defina uma origem; depois clique em **Otimizar rota**.
6. Na área de **Simulações**, selecione entregas com coordenadas, informe uma origem, velocidade e congestionamento e compare os resultados.
7. Use **Mensagens** para ler e responder aos chamados; **Exportar CSV** em Gestão de entregas para obter os dados operacionais.

04

## Entregador — executar a rota

1. Após o cadastro, envie a CNH e registre o veículo. Aguarde a aprovação do administrador.
2. No painel **Rota de hoje**, veja pedidos atribuídos, próxima parada e sequência.
3. Clique em **Compartilhar posição** para enviar sua localização naquele momento; o sistema não acompanha o deslocamento continuamente.
4. Em **Mapa e rotas**, visualize os destinos, escolha a origem, selecione os pedidos e organize a sequência; **Como chegar** abre navegação externa.
5. Ao iniciar a operação, atualize os status na ordem permitida: **Aguardando coleta → Em trânsito → Saiu para entrega → Entregue**. Se houver ocorrência, use **Problema** quando disponível.
6. Use **Atendimento** se precisar se comunicar com a equipe.

05

## Mapa e rotas — passo a passo

1. Observe o resumo: entregas abertas, veículos com posição e quantidade de paradas selecionadas.
2. **Localize** uma entrega pela busca ou pelo filtro de status. Um pedido sem coordenadas não aparece como marcador.
3. Quando aparecer **Sem coordenadas**, o administrador pode usar **Corrigir localização**: o sistema tenta localizar novamente o endereço. Se falhar, informe manualmente latitude e longitude conferidas.
4. **Selecione** apenas entregas ativas do mesmo motorista e com localização válida. O administrador também deve ter atribuído um motorista antes de planejar uma rota.
5. **Defina a origem**: primeira coleta (se houver coordenadas de coleta), posição compartilhada do motorista, GPS do navegador (com permissão) ou clique no mapa.
6. Clique em **Otimizar rota**. A sequência é estimada pelo método do vizinho mais próximo. **Iniciar rota** registra o início operacional; **Ver todos** centraliza os marcadores.

**Limite importante:** otimização usa distâncias geográficas aproximadas; o traçado pelas ruas depende do OSRM e pode falhar. O mapa usa Leaflet/OpenStreetMap e necessita internet para carregar os tiles.

06

## Simulações — entender cenários logísticos

1. Entre como administrador ou gestor e abra **Simulações**.
2. Selecione de 1 a 50 entregas ativas **com coordenadas**. Se nenhuma aparecer, volte a Mapa e rotas para corrigir a localização dos pedidos.
3. Informe a latitude e longitude de partida, ou use **Usar minha localização** em localhost ou HTTPS.
4. Defina velocidade média e fator de congestionamento. Clique em **Calcular e salvar cenário**.
5. Compare a distância aproximada, tempo-base, tempo simulado e acréscimo; consulte o histórico salvo.

A simulação é didática e matemática. Ela **não** usa trânsito ao vivo e **não** é o jogo 3D descrito como frente complementar no resumo expandido.

07

## Erros comuns e solução

Endereço sem coordenadas
:   Informe endereço mais completo; tente o botão de localização; no mapa, o administrador pode corrigir pedidos antigos sem recriá-los. Uma consulta de terceiro pode estar indisponível.

Mapa em branco
:   Verifique internet, carregamento da biblioteca Leaflet e dos tiles OpenStreetMap.

Não consigo selecionar entrega
:   Confira se está ativa, possui latitude e longitude, tem motorista atribuído e está dentro dos filtros.

Simulação sem entregas
:   As opções exigem coordenadas válidas. Abra Mapa e rotas e corrija os destinos pendentes.

GPS não funciona
:   Permita acesso à localização do navegador e use localhost ou HTTPS; o compartilhamento do motorista requer aprovação.

O administrador não entra
:   Configure ADMIN\_INVITE\_CODE no arquivo .env no servidor, reinicie a aplicação e não utilize o código ilustrativo de .env.example.

Alterei o site e não mudou
:   Reinicie o servidor e use Ctrl+F5 para recarregar arquivos armazenados pelo navegador.

## Informações de implantação

Configure o MySQL no `.env` e reinicie o servidor após mudar variáveis. `GEOCODING_ENABLED=true`, `GEOCODING_PROVIDER=nominatim`, `GEOCODING_CONTACT_EMAIL=<email válido>` e `GEOCODING_API_KEY=` em testes. Nominatim público não é indicado para produção em escala. Use `npm test` antes de publicar.
