const { Op } = require('sequelize');
const { Entrega, EventoEntrega, Usuario, Veiculo } = require('../models');
const sequelize = require('../config/database');
const { erroHttp, texto, numeroPositivo } = require('../utils/http');
const { geocodificarEndereco } = require('./geocodingService');

const TRANSICOES = {
  'Pendente': ['Aguardando coleta', 'Cancelada'],
  'Aguardando coleta': ['Em trânsito', 'Cancelada'],
  'Em trânsito': ['Saiu para entrega', 'Problema'],
  'Saiu para entrega': ['Entregue', 'Problema'],
  'Problema': ['Em trânsito', 'Saiu para entrega', 'Cancelada'],
  'Entregue': [],
  'Cancelada': []
};

function validarCoordenada(valor, min, max, nome) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) throw erroHttp(422, `${nome} está fora do intervalo válido.`);
  return n;
}

async function criarEntrega(dados, ator) {
  const clienteId = ator.perfil === 'Cliente' ? ator.id : Number(dados.cliente_id);
  if (!clienteId) throw erroHttp(422, 'Selecione o cliente da entrega.');
  const cliente = await Usuario.findByPk(clienteId);
  if (!cliente || cliente.perfil !== 'Cliente' || !cliente.ativo) throw erroHttp(422, 'Cliente informado não encontrado ou inativo.');

  const destino = texto(dados.destino, 255);
  const destinatario = texto(dados.destinatario_nome || cliente.nome, 120);
  const tipoVeiculo = texto(dados.tipo_veiculo || 'Moto', 20);
  if (!destino) throw erroHttp(422, 'Informe o endereço de entrega.');
  if (!destinatario) throw erroHttp(422, 'Informe o nome de quem receberá a entrega.');
  if (!['Moto', 'Carro', 'Van', 'Caminhão', 'Elétrico'].includes(tipoVeiculo)) throw erroHttp(422, 'Tipo de veículo inválido.');

  const quantidade = numeroPositivo(dados.quantidade_volumes ?? 1, 'quantidade de volumes', true);
  if (!Number.isInteger(quantidade) || quantidade < 1) throw erroHttp(422, 'A quantidade de volumes deve ser um número inteiro maior que zero.');
  const peso = numeroPositivo(dados.peso_kg, 'peso');
  const volume = numeroPositivo(dados.volume_m3, 'volume');
  if ((tipoVeiculo === 'Van' || tipoVeiculo === 'Caminhão') && (!peso || !volume)) {
    throw erroHttp(422, 'Para Van e Caminhão, informe o peso e o volume da carga.');
  }

  const latitudeInformada = validarCoordenada(dados.destino_latitude, -90, 90, 'Latitude de entrega');
  const longitudeInformada = validarCoordenada(dados.destino_longitude, -180, 180, 'Longitude de entrega');
  if ((latitudeInformada === null) !== (longitudeInformada === null)) {
    throw erroHttp(422, 'Informe latitude e longitude juntas ou deixe ambas vazias para localização automática.');
  }
  // A consulta externa acontece ANTES da transação para não prender locks do MySQL.
  const localizacao = latitudeInformada !== null
    ? { status: 'manual', latitude: latitudeInformada, longitude: longitudeInformada, mensagem: 'Ponto informado manualmente.' }
    : await geocodificarEndereco(dados);
  const destinoLatitude = localizacao.latitude ?? null;
  const destinoLongitude = localizacao.longitude ?? null;

  const entregaCriada = await sequelize.transaction(async (transaction) => {
  const entrega = await Entrega.create({
    cliente_id: clienteId,
    criada_por: ator.id,
    origem: texto(dados.origem, 255) || cliente.endereco_coleta || 'Centro de distribuição',
    origem_latitude: validarCoordenada(dados.origem_latitude, -90, 90, 'Latitude de coleta'),
    origem_longitude: validarCoordenada(dados.origem_longitude, -180, 180, 'Longitude de coleta'),
    destino,
    destino_latitude: destinoLatitude,
    destino_longitude: destinoLongitude,
    cep_entrega: texto(dados.cep_entrega, 12) || null,
    bairro: texto(dados.bairro, 100) || null,
    cidade: texto(dados.cidade, 100) || null,
    destinatario_nome: destinatario,
    destinatario_telefone: texto(dados.destinatario_telefone, 30) || null,
    tipo_veiculo: tipoVeiculo,
    tipo_carga: texto(dados.tipo_carga, 80) || 'Volumes gerais',
    quantidade_volumes: quantidade,
    peso_kg: peso,
    volume_m3: volume,
    janela_inicio: texto(dados.janela_inicio, 5) || null,
    janela_fim: texto(dados.janela_fim, 5) || null,
    observacoes: texto(dados.observacoes, 2000) || null,
    status: 'Pendente'
  }, { transaction });

  await EventoEntrega.create({
    entrega_id: entrega.id,
    usuario_id: ator.id,
    status: 'Pendente',
    descricao: 'Solicitação de entrega registrada.'
  }, { transaction });
  return entrega;
  });
  // Metadados transitórios retornados somente na confirmação do cadastro.
  entregaCriada._localizacao = localizacao;
  return entregaCriada;
}

async function alterarStatus(entrega, novoStatus, ator, descricao) {
  if (!Object.prototype.hasOwnProperty.call(TRANSICOES, novoStatus)) throw erroHttp(422, 'Status de entrega inválido.');
  return sequelize.transaction(async (transaction) => {
    const atual = await Entrega.findByPk(entrega.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!atual) throw erroHttp(404, 'Entrega não encontrada.');
    if (!TRANSICOES[atual.status].includes(novoStatus)) {
      throw erroHttp(422, `Não é possível alterar uma entrega de "${atual.status}" para "${novoStatus}".`);
    }
    if (!['Cancelada', 'Problema'].includes(novoStatus) && (!atual.motorista_id || !atual.veiculo_id)) {
      throw erroHttp(409, 'Atribua um motorista e um veículo antes de iniciar a operação.');
    }
    await atual.update({ status: novoStatus }, { transaction });
    await EventoEntrega.create({
      entrega_id: atual.id,
      usuario_id: ator.id,
      status: novoStatus,
      descricao: texto(descricao, 255) || `Status atualizado para ${novoStatus}.`
    }, { transaction });
    if (['Entregue', 'Cancelada'].includes(novoStatus) && atual.veiculo_id) {
      const veiculo = await Veiculo.findByPk(atual.veiculo_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (veiculo) {
        const ativas = await Entrega.count({
          where: { veiculo_id: veiculo.id, status: { [Op.notIn]: ['Entregue', 'Cancelada'] } }, transaction
        });
        if (!ativas && veiculo.status === 'Em Rota') await veiculo.update({ status: 'Disponivel' }, { transaction });
      }
    }
    return atual;
  });
}

async function atribuirEntrega(entrega, motoristaId, veiculoId, ator) {
  if (!Number.isInteger(motoristaId) || motoristaId < 1 || !Number.isInteger(veiculoId) || veiculoId < 1) {
    throw erroHttp(422, 'Informe motorista e veículo válidos.');
  }
  return sequelize.transaction(async (transaction) => {
    const atual = await Entrega.findByPk(entrega.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!atual) throw erroHttp(404, 'Entrega não encontrada.');
    if (!['Pendente', 'Aguardando coleta'].includes(atual.status)) {
      throw erroHttp(409, 'Só é possível atribuir motorista a entregas pendentes ou aguardando coleta.');
    }
    if (atual.motorista_id || atual.veiculo_id) {
      throw erroHttp(409, 'A entrega já tem motorista ou veículo atribuído. Conclua ou cancele a entrega antes de reutilizar o veículo.');
    }
    const motorista = await Usuario.findByPk(motoristaId, { transaction });
    if (!motorista || motorista.perfil !== 'Motorista' || !motorista.ativo || !motorista.aprovado) {
      throw erroHttp(422, 'O motorista precisa existir, estar ativo e ter o cadastro aprovado.');
    }
    // O lock impede que duas solicitações simultâneas atribuam o mesmo veículo.
    const veiculo = await Veiculo.findByPk(veiculoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!veiculo) throw erroHttp(404, 'Veículo não encontrado.');
    if (veiculo.status !== 'Disponivel') throw erroHttp(409, 'O veículo selecionado não está disponível.');
    if (veiculo.tipo !== atual.tipo_veiculo) {
      throw erroHttp(422, `O veículo escolhido é do tipo ${veiculo.tipo}, mas a entrega exige ${atual.tipo_veiculo}.`);
    }
    const peso = Number(atual.peso_kg || 0);
    const volume = Number(atual.volume_m3 || 0);
    if (Number(veiculo.capacidade_kg) > 0 && peso > Number(veiculo.capacidade_kg)) {
      throw erroHttp(422, 'O peso da carga excede a capacidade do veículo.');
    }
    if (veiculo.volume_m3 != null && volume > Number(veiculo.volume_m3)) {
      throw erroHttp(422, 'O volume da carga excede a capacidade do veículo.');
    }
    if (veiculo.motorista_id && Number(veiculo.motorista_id) !== motorista.id) {
      throw erroHttp(409, 'O veículo está vinculado a outro motorista.');
    }
    const outrasAtivas = await Entrega.count({
      where: { veiculo_id: veiculo.id, status: { [Op.notIn]: ['Entregue', 'Cancelada'] } }, transaction
    });
    if (outrasAtivas) throw erroHttp(409, 'Este veículo já tem uma entrega ativa.');
    await veiculo.update({ motorista_id: motorista.id, status: 'Em Rota' }, { transaction });
    await atual.update({ motorista_id: motorista.id, veiculo_id: veiculo.id, status: 'Aguardando coleta' }, { transaction });
    await EventoEntrega.create({
      entrega_id: atual.id,
      usuario_id: ator.id,
      status: 'Aguardando coleta',
      descricao: `Entrega atribuída ao motorista ${motorista.nome} e ao veículo ${veiculo.placa}.`
    }, { transaction });
    return atual;
  });
}

module.exports = { TRANSICOES, criarEntrega, alterarStatus, atribuirEntrega };
