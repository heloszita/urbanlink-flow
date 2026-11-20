/**
 * Geocodificação sob demanda para entregas (nunca autocomplete).
 * Nominatim público: somente baixo volume, limite de 1 consulta/segundo,
 * User-Agent identificável e cache. Para produção, configure Geoapify ou serviço próprio.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_ERRO_MS = 15 * 60 * 1000;
const cache = new Map();
const pendentes = new Map();
let fila = Promise.resolve();
let ultimaConsulta = 0;

function texto(valor, limite = 255) {
  return typeof valor === 'string' ? valor.trim().slice(0, limite) : '';
}

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(rua|avenida|av|travessa|alameda|estrada|praca)\.?\s+/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function prepararEndereco(campos = {}) {
  const destino = texto(campos.destino || campos.endereco);
  const bairro = texto(campos.bairro, 100);
  const cidade = texto(campos.cidade, 100);
  const uf = texto(campos.uf, 2).toUpperCase();
  const cep = texto(campos.cep_entrega || campos.cep, 12).replace(/\D/g, '');
  const partes = [destino, bairro, cidade, uf, cep.length === 8 ? cep : '', 'Brasil'].filter(Boolean);
  const consulta = partes.join(', ');
  // Evita pesquisas nacionais ambíguas (Rua X existe em centenas de municípios).
  const destinoCompleto = destino.split(',').length >= 3 || /\b\d{5}-?\d{3}\b/.test(destino) || /(?:,|\s-\s)\s*[A-Z]{2}\b/i.test(destino);
  const contexto = Boolean(cidade || (cep.length === 8) || (uf && destinoCompleto) || destinoCompleto);
  return { destino, bairro, cidade, uf, cep, consulta, contexto };
}

function validarResultado(item, endereco) {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  const a = item.address || {};
  if (a.country_code && a.country_code !== 'br') return null;
  // Não marcar o centro da cidade/estado como endereço de uma entrega.
  const via = texto(a.road || a.pedestrian || a.residential || a.footway || a.street || a.path || a.square);
  if (!via && !a.house_number) return null;
  const viaInformada = endereco.destino.split(',')[0].split(' - ')[0].replace(/\s+\d{1,6}(?:\b.*)?$/, '').trim();
  if (viaInformada.length > 3 && via) {
    const esperado = normalizar(viaInformada);
    const encontrado = normalizar(via);
    if (esperado && encontrado && !encontrado.includes(esperado) && !esperado.includes(encontrado)) return null;
  }
  if (endereco.cidade) {
    const cidadeNoResultado = [a.city, a.town, a.village, a.municipality, a.city_district].filter(Boolean).map(normalizar);
    const cidadeEsperada = normalizar(endereco.cidade);
    if (cidadeNoResultado.length && !cidadeNoResultado.some(c => c === cidadeEsperada || c.includes(cidadeEsperada) || cidadeEsperada.includes(c))) return null;
  }
  const numeroPedido = endereco.destino.match(/,\s*(\d{1,6})\b/)?.[1];
  const numeroRetornado = texto(a.house_number, 24).match(/\d{1,6}/)?.[0];
  if (numeroPedido && numeroRetornado && numeroPedido !== numeroRetornado) return null;
  return {
    status: numeroPedido && numeroRetornado === numeroPedido ? 'encontrado' : 'aproximado',
    latitude, longitude,
    descricao: texto(item.display_name, 300),
    mensagem: numeroPedido && numeroRetornado === numeroPedido
      ? 'Endereço localizado automaticamente. Confira o ponto indicado no mapa.'
      : 'A rua foi localizada, mas o número exato pode não estar disponível. Confira a posição antes da entrega.'
  };
}

function requisitarComIntervalo(fn) {
  const tarefa = fila.then(async () => {
    const espera = Math.max(0, ultimaConsulta + 1100 - Date.now());
    if (espera) await new Promise(resolve => setTimeout(resolve, espera));
    ultimaConsulta = Date.now();
    return fn();
  });
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function consultarProvedor(query, provider, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('O servidor não oferece HTTP fetch.');
  let url;
  const headers = { Accept: 'application/json', 'Accept-Language': 'pt-BR' };
  if (provider === 'geoapify') {
    const key = options.apiKey ?? process.env.GEOCODING_API_KEY;
    if (!key) throw new Error('Configure GEOCODING_API_KEY para utilizar Geoapify.');
    url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.searchParams.set('text', query);
    url.searchParams.set('filter', 'countrycode:br');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'pt');
    url.searchParams.set('apiKey', key);
  } else if (provider === 'nominatim') {
    url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'br');
    const contato = texto(process.env.GEOCODING_CONTACT_EMAIL, 120);
    headers['User-Agent'] = `UrbanLinkFlow/3.6 (consulta de endereco para entrega${contato ? `; contato: ${contato}` : ''})`;
    if (contato) url.searchParams.set('email', contato);
  } else throw new Error('Provedor de geocodificação não suportado.');
  const response = await fetchImpl(url.toString(), { headers, signal: AbortSignal.timeout(5500) });
  if (!response.ok) throw new Error(`Serviço de localização indisponível (HTTP ${response.status}).`);
  const dados = await response.json();
  if (provider === 'geoapify') return (Array.isArray(dados.results) ? dados.results : []).map(r => ({
    lat: r.lat, lon: r.lon,
    display_name: r.formatted,
    address: { road: r.street, house_number: r.housenumber, city: r.city, town: r.town, municipality: r.county, country_code: r.country_code, postcode: r.postcode }
  }));
  return Array.isArray(dados) ? dados : [];
}

async function geocodificarEndereco(campos, options = {}) {
  const e = prepararEndereco(campos);
  if (!e.destino || e.destino.length < 6 || !e.contexto) {
    return { status: 'incompleto', mensagem: 'Informe rua, número e cidade/UF ou CEP completo para localizar o destino.' };
  }
  if (process.env.GEOCODING_ENABLED === 'false') return { status: 'indisponivel', mensagem: 'Busca automática desativada no servidor.' };
  const provider = options.provider || process.env.GEOCODING_PROVIDER || 'nominatim';
  const chave = `${provider}:${normalizar(e.consulta)}`;
  const agora = Date.now();
  const emCache = cache.get(chave);
  if (emCache && emCache.validade > agora) return { ...emCache.valor };
  if (pendentes.has(chave)) return { ...(await pendentes.get(chave)) };
  const consulta = (async () => {
    let resultado;
    try {
      // A segunda tentativa ignora o CEP, caso o provedor não o reconheça.
      const alternativas = [e.consulta];
      if (e.cep) alternativas.push([e.destino, e.bairro, e.cidade, e.uf, 'Brasil'].filter(Boolean).join(', '));
      for (const query of alternativas) {
        const pedir = () => consultarProvedor(query, provider, options);
        const candidatos = provider === 'nominatim' && !options.skipRateLimit ? await requisitarComIntervalo(pedir) : await pedir();
        resultado = candidatos.map(item => validarResultado(item, e)).find(Boolean);
        if (resultado) break;
      }
      if (!resultado) resultado = { status: 'nao_encontrado', mensagem: 'Não foi possível identificar com segurança esse endereço. Confira rua, número, cidade e CEP ou informe o ponto manualmente.' };
    } catch (_) {
      resultado = { status: 'indisponivel', mensagem: 'O serviço de localização não respondeu. A entrega pode ser registrada, mas o ponto não aparecerá no mapa até ser informado.' };
    }
    // Cache limitado em memória. Para alto volume/serverless, use cache compartilhado e provedor contratado.
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(chave, { validade: Date.now() + (resultado.latitude == null ? CACHE_ERRO_MS : CACHE_TTL_MS), valor: resultado });
    return resultado;
  })();
  pendentes.set(chave, consulta);
  try { return { ...(await consulta) }; } finally { pendentes.delete(chave); }
}

module.exports = { geocodificarEndereco, prepararEndereco, validarResultado, normalizar };
