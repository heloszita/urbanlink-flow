const test = require('node:test');
const assert = require('node:assert/strict');
const { haversineKm, otimizarParadas } = require('../src/utils/rotaMath');

test('calcula distância geográfica aproximada entre pontos', () => {
  const distancia = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
  assert.ok(distancia > 111 && distancia < 112);
});

test('ordena paradas escolhendo sempre a mais próxima da posição atual', () => {
  const entregas = [
    { id: 1, destino_latitude: 0, destino_longitude: 2 },
    { id: 2, destino_latitude: 0, destino_longitude: 1 },
    { id: 3, destino_latitude: 0, destino_longitude: 3 }
  ];
  const resultado = otimizarParadas({ latitude: 0, longitude: 0 }, entregas);
  assert.deepEqual(resultado.ordem.map((p) => p.entrega.id), [2, 1, 3]);
  assert.ok(resultado.distancia > 300 && resultado.distancia < 400);
});

test('não otimiza entrega sem coordenadas', () => {
  assert.throws(() => otimizarParadas({ latitude: 0, longitude: 0 }, [
    { id: 9, destino_latitude: null, destino_longitude: null }
  ]), /latitude e longitude/);
});

test('rejeita coordenadas nulas, vazias e fora dos limites', () => {
  assert.throws(
    () => otimizarParadas({ latitude: 0, longitude: 0 }, [
      { id: 1, destino_latitude: null, destino_longitude: '' }
    ]),
    /latitude e longitude válidas/
  );
  assert.throws(
    () => otimizarParadas({ latitude: 91, longitude: 0 }, [
      { id: 1, destino_latitude: -22.9, destino_longitude: -43.2 }
    ]),
    /ponto de partida/
  );
});
