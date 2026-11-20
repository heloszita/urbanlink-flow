const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularCenario } = require('../src/utils/simulacaoMath');

test('calcula tempo simulado com fator de congestionamento', () => {
  const result = calcularCenario({
    distanciaKm: 30,
    velocidadeBaseKmh: 30,
    fatorCongestionamento: 1.5
  });
  assert.equal(result.distancia_total_km, 30);
  assert.equal(result.tempo_base_min, 60);
  assert.equal(result.tempo_simulado_min, 90);
  assert.equal(result.acrescimo_min, 30);
});

test('rejeita velocidade e fator de congestionamento fora do intervalo', () => {
  assert.throws(() => calcularCenario({
    distanciaKm: 30, velocidadeBaseKmh: 3, fatorCongestionamento: 1
  }), /velocidade média/);
  assert.throws(() => calcularCenario({
    distanciaKm: 30, velocidadeBaseKmh: 30, fatorCongestionamento: 4
  }), /fator de congestionamento/);
});
