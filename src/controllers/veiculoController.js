const Veiculo = require('../models/veiculo');

// 1. Cadastrar um novo veículo na frota
async function cadastrar(req, res) {
  try {
    const { placa, tipo_combustivel, capacidade, status } = req.body;

    const veiculo = await Veiculo.create({
      placa,
      tipo_combustivel,
      capacidade,
      status: status || 'Disponivel'
    });

    return res.status(201).json({
      mensagem: 'Veículo cadastrado na frota com sucesso!',
      veiculo
    });
  } catch (erro) {
    return res.status(400).json({
      mensagem: 'Erro ao cadastrar veículo',
      erro: erro.message
    });
  }
}

// 2. Listar todos os veículos
async function listar(req, res) {
  try {
    const veiculos = await Veiculo.findAll();
    return res.status(200).json(veiculos);
  } catch (erro) {
    return res.status(400).json({
      mensagem: 'Erro ao listar veículos',
      erro: erro.message
    });
  }
}

module.exports = { cadastrar, listar };