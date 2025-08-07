const jwt = require('jsonwebtoken');

// Function to sign JWT tokens
function signToken(payload, rememberMe = false) {
  // Token expires in 30 days if rememberMe is true, otherwise in 1 day
  const expiresIn = rememberMe ? '30d' : '1d';

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
  });
}

module.exports = { signToken };
