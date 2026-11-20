const { asyncHandler } = require('../utils/http');
const { geocodificarEndereco } = require('../services/geocodingService');

const localizar = asyncHandler(async (req, res) => {
  const localizacao = await geocodificarEndereco(req.body || {});
  res.setHeader('Cache-Control', 'no-store');
  res.json({ localizacao });
});

module.exports = { localizar };
