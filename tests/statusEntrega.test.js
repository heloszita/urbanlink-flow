const test = require('node:test');
const assert = require('node:assert/strict');

const transicoes = {
  'Pendente': ['Aguardando coleta', 'Cancelada'],
  'Aguardando coleta': ['Em trânsito', 'Cancelada'],
  'Em trânsito': ['Saiu para entrega', 'Problema'],
  'Saiu para entrega': ['Entregue', 'Problema'],
  'Problema': ['Em trânsito', 'Saiu para entrega', 'Cancelada'],
  'Entregue': [],
  'Cancelada': []
};

test('permite somente transições de status previstas', () => {
  assert.ok(transicoes.Pendente.includes('Aguardando coleta'));
  assert.ok(transicoes['Saiu para entrega'].includes('Entregue'));
  assert.ok(!transicoes.Entregue.includes('Em trânsito'));
  assert.ok(!transicoes.Cancelada.includes('Aguardando coleta'));
});
