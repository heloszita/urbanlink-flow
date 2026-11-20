# UrbanLink Flow — Localização automática e controles do motorista

## O que foi feito
- O cliente informa destino, bairro/cidade/UF ou CEP, sem obrigação de digitar latitude/longitude.
- `POST /api/entregas` consulta o serviço de localização **no backend** antes de salvar a entrega. As coordenadas resultantes são salvas nos campos existentes do MySQL (`destino_latitude` e `destino_longitude`). Não é necessária alteração do esquema.
- O cliente e o administrador podem usar **Localizar endereço** antes de enviar o formulário. O link abre o ponto pesquisado no OpenStreetMap.
- A interface diferencia localização exata, aproximada, incompleta ou indisponível. As coordenadas continuam disponíveis em **Ajustar coordenadas manualmente**, para casos não encontrados.
- Os botões **Ver todos**, **Atualizar mapa**, **Compartilhar posição** e **Mapa completo** agora ficam lado a lado abaixo do status no mapa inicial do motorista. Em telas estreitas, os controles se reorganizam conforme as regras responsivas atuais, sem gerar rolagem horizontal da página. As ações **Cheguei ao destino** e **Confirmar entrega** da próxima parada também são exibidas em duas colunas.

## Configuração
Na raiz do projeto, mantenha `.env` com as credenciais de seu MySQL e JWT, e configure opcionalmente:

```env
GEOCODING_ENABLED=true
GEOCODING_PROVIDER=nominatim
GEOCODING_CONTACT_EMAIL=seu-contato@exemplo.com
```

O Nominatim público serve para testes e tráfego moderado, com no máximo 1 requisição por segundo **para a aplicação inteira**, User-Agent identificável, cache, atribuição e sem autocomplete. O código mantém fila de 1 consulta a cada 1,1 s **por processo**, cache em memória e consulta apenas quando o usuário aciona o botão ou registra uma entrega. Essas garantias não são globais entre múltiplos servidores / instâncias serverless. **Para produção em escala**, use um provedor contratado ou instância própria, com cota/rate limit adequado. Regras oficiais: https://operations.osmfoundation.org/policies/nominatim/.

Para trocar o provedor:
```env
GEOCODING_PROVIDER=geoapify
GEOCODING_API_KEY=sua-chave-privada
```

A chave deve ficar somente no `.env` do **backend** (não no frontend). Ao consultar o serviço externo, o endereço informado será enviado a ele; confirme a política de privacidade aplicável.

## Validação e limitações
Execute `npm test`. Há testes mockados de endereço localizado, aproximado, incompatível e erro externo, além da verificação estrutural dos controles. **Não foram executados testes reais com MySQL, serviços externos ou navegador neste ambiente**.

Se o endereço não tiver identificação suficiente ou não for reconhecido, o pedido ainda poderá ser salvo, mas ficará **sem marcador no mapa** até que a coordenada seja corrigida. Não é correto inventar uma posição ou colocar o marcador no centro da cidade. Em localizações aproximadas, confira o número do imóvel antes de despachar.
