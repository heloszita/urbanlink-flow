const { erroHttp } = require('./http');

function calcularCenario({ distanciaKm, velocidadeBaseKmh, fatorCongestionamento }) {
  const distancia = Number(distanciaKm);
  const velocidade = Number(velocidadeBaseKmh);
  const fator = Number(fatorCongestionamento);

  if (!Number.isFinite(distancia) || distancia < 0) {
    throw erroHttp(422, 'A distância da simulação precisa ser válida.');
  }
  if (!Number.isFinite(velocidade) || velocidade < 5 || velocidade > 120) {
    throw erroHttp(422, 'A velocidade média deve estar entre 5 e 120 km/h.');
  }
  if (!Number.isFinite(fator) || fator < 1 || fator > 3) {
    throw erroHttp(422, 'O fator de congestionamento deve estar entre 1 e 3.');
  }

  const tempoBase = Math.ceil((distancia / velocidade) * 60);
  const tempoSimulado = Math.ceil(tempoBase * fator);
  return {
    distancia_total_km: Number(distancia.toFixed(2)),
    tempo_base_min: tempoBase,
    tempo_simulado_min: tempoSimulado,
    acrescimo_min: tempoSimulado - tempoBase
  };
}

module.exports = { calcularCenario };
