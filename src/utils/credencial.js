const { createHmac } = require('node:crypto');

function versaoDaSenha(senhaHash) {
  return createHmac('sha256', process.env.JWT_SECRET)
    .update('urbanlink:senha:')
    .update(senhaHash)
    .digest('base64url');
}

module.exports = { versaoDaSenha };
