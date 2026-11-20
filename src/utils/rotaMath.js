const { erroHttp } = require('./http');

function haversineKm(a, b) {
  const rad = (graus) => (graus * Math.PI) / 180;
  const dLat = rad(Number(b.latitude) - Number(a.latitude));
  const dLon = rad(Number(b.longitude) - Number(a.longitude));
  const lat1 = rad(Number(a.latitude));
  const lat2 = rad(Number(b.latitude));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function coordenadaValida(valor, minimo, maximo) {
  if (valor === null || valor === undefined || valor === '') return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= minimo && numero <= maximo;
}

function otimizarParadas(origem, entregas) {
  if (!origem || !coordenadaValida(origem.latitude, -90, 90) ||
      !coordenadaValida(origem.longitude, -180, 180)) {
    throw erroHttp(422, 'Informe latitude e longitude válidas para o ponto de partida.');
  }
  const pendentes = entregas.map((entrega) => ({
    entrega,
    latitude: Number(entrega.destino_latitude),
    longitude: Number(entrega.destino_longitude)
  }));
  if (pendentes.some((p) => !coordenadaValida(p.entrega.destino_latitude, -90, 90) ||
      !coordenadaValida(p.entrega.destino_longitude, -180, 180))) {
    throw erroHttp(422, 'Todas as entregas precisam ter latitude e longitude válidas para otimizar a rota.');
  }
  const ordem = [];
  let atual = { latitude: Number(origem.latitude), longitude: Number(origem.longitude) };
  let distancia = 0;
  while (pendentes.length) {
    let melhorIndice = 0;
    let melhorDistancia = haversineKm(atual, pendentes[0]);
    for (let i = 1; i < pendentes.length; i += 1) {
      const d = haversineKm(atual, pendentes[i]);
      if (d < melhorDistancia) { melhorDistancia = d; melhorIndice = i; }
    }
    const [proxima] = pendentes.splice(melhorIndice, 1);
    distancia += melhorDistancia;
    ordem.push(proxima);
    atual = proxima;
  }
  return { ordem, distancia: Number(distancia.toFixed(2)) };
}

module.exports = { haversineKm, otimizarParadas };
