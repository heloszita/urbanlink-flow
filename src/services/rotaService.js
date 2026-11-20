const { Entrega, Rota, Veiculo, PosicaoVeiculo, Usuario } = require('../models');
const { erroHttp } = require('../utils/http');

const { haversineKm, otimizarParadas } = require('../utils/rotaMath');

async function criarRota({ entregaIds, origem, velocidadeMedia, motoristaId, criadorId }) {
  if (!Array.isArray(entregaIds) || entregaIds.length < 1 || entregaIds.length > 50) {
    throw erroHttp(422, 'Informe de 1 a 50 identificadores de entrega para montar a rota.');
  }
  const lat = Number(origem?.latitude);
  const lon = Number(origem?.longitude);
  if (origem == null || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw erroHttp(422, 'Informe latitude e longitude válidas para o ponto de partida.');
  }
  const velocidade = Number(velocidadeMedia || 30);
  if (!Number.isFinite(velocidade) || velocidade < 5 || velocidade > 120) {
    throw erroHttp(422, 'A velocidade média deve estar entre 5 e 120 km/h.');
  }

  const idsUnicos = [...new Set(entregaIds.map(Number))];
  if (idsUnicos.length !== entregaIds.length || idsUnicos.some(id => !Number.isSafeInteger(id) || id < 1)) {
    throw erroHttp(422, 'Informe identificadores de entrega positivos e sem duplicação.');
  }
  const entregas = await Entrega.findAll({ where: { id: idsUnicos } });
  if (entregas.length !== idsUnicos.length) throw erroHttp(404, 'Uma ou mais entregas não foram encontradas.');
  if (entregas.some(e => ['Entregue', 'Cancelada'].includes(e.status))) {
    throw erroHttp(422, 'Uma rota não pode incluir entregas concluídas ou canceladas.');
  }
  const motoristasDaRota = [...new Set(entregas.map(e => e.motorista_id).filter(Boolean).map(Number))];
  if (motoristasDaRota.length > 1 || (motoristasDaRota.length === 1 && entregas.some(e => !e.motorista_id))) {
    throw erroHttp(409, 'Uma rota não pode misturar entregas de motoristas diferentes ou entregas sem motorista.');
  }
  const motoristaRota = motoristasDaRota[0] || null;
  if (!motoristaRota) throw erroHttp(409, 'Atribua todas as entregas a um motorista antes de criar a rota.');
  if (motoristaId && Number(motoristaId) !== motoristaRota) {
    throw erroHttp(403, 'As entregas selecionadas não pertencem ao motorista informado.');
  }
  if (motoristaRota) {
    const motorista = await Usuario.findByPk(motoristaRota);
    if (!motorista || motorista.perfil !== 'Motorista' || !motorista.ativo || !motorista.aprovado) {
      throw erroHttp(409, 'O motorista responsável pela rota precisa estar ativo e aprovado.');
    }
  }
  const elegiveis = entregas;

  const resultado = otimizarParadas({ latitude: lat, longitude: lon }, elegiveis);
  const tempo = Math.ceil((resultado.distancia / velocidade) * 60);
  const rota = await Rota.create({
    nome: `Rota ${new Date().toLocaleDateString('pt-BR')}`,
    motorista_id: motoristaRota,
    criada_por: criadorId,
    entrega_ids: resultado.ordem.map((p) => p.entrega.id),
    distancia_total_km: resultado.distancia,
    tempo_estimado_min: tempo,
    velocidade_media_kmh: velocidade,
    origem_latitude: lat,
    origem_longitude: lon,
    status: 'Planejada'
  });
  return { rota, paradas: resultado.ordem.map((p, i) => ({ ordem: i + 1, entrega: p.entrega })) };
}

async function obterOrigemMotorista(motoristaId) {
  const veiculo = await Veiculo.findOne({ where: { motorista_id: motoristaId } });
  if (!veiculo) return null;
  return PosicaoVeiculo.findOne({ where: { veiculo_id: veiculo.id }, order: [['registrada_em', 'DESC']] });
}

module.exports = { haversineKm, otimizarParadas, criarRota, obterOrigemMotorista };
