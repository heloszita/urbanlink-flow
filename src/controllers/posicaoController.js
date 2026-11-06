const PosicaoVeiculo = require('../models/posicaoVeiculo');
const Veiculo = require('../models/veiculo');

async function registrarPosicao(req, res) {
  try {
    const { veiculo_id, latitude, longitude, novo_status } = req.body;

    // 1. Verifica se o veículo existe na base de dados (FindByPk)
    const veiculo = await Veiculo.findByPk(veiculo_id);
    if (!veiculo) {
      return res.status(404).json({ mensagem: 'Veículo não encontrado' });
    }

    // 2. Se for passado um novo status (ex: 'Em Rota'), atualiza o veículo (Update)
    if (novo_status) {
      await veiculo.update({ status: novo_status });
    }

    // 3. Regista a nova posição no histórico (Create)
    const posicao = await PosicaoVeiculo.create({
      veiculo_id,
      latitude,
      longitude
    });

    return res.status(201).json({
      mensagem: 'Posição do veículo registrada e status atualizado!',
      posicao,
      veiculo_status_atual: veiculo.status
    });
  } catch (erro) {
    return res.status(400).json({
      mensagem: 'Erro ao registrar posição do veículo',
      erro: erro.message
    });
  }
}

module.exports = { registrarPosicao };