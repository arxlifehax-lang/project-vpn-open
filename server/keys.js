const crypto = require('crypto');

function generateKeys() {
  // 1. Generate UUID v4 for VLESS
  const uuid = crypto.randomUUID();

  // 2. Generate WireGuard keys (Curve25519)
  const clientWgKeys = crypto.generateKeyPairSync('x25519');
  const clientWgPrivate = clientWgKeys.privateKey.export({ type: 'pkcs8', format: 'der' }).slice(16).toString('base64');
  const clientWgPublic = clientWgKeys.publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('base64');

  const serverWgKeys = crypto.generateKeyPairSync('x25519');
  const serverWgPrivate = serverWgKeys.privateKey.export({ type: 'pkcs8', format: 'der' }).slice(16).toString('base64');
  const serverWgPublic = serverWgKeys.publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('base64');

  // 3. Generate Xray Reality keys (Curve25519)
  const realityKeys = crypto.generateKeyPairSync('x25519');
  const realityPrivate = realityKeys.privateKey.export({ type: 'pkcs8', format: 'der' }).slice(16).toString('base64url');
  const realityPublic = realityKeys.publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('base64url');

  // 4. Generate random short ID (8 bytes hex)
  const shortId = crypto.randomBytes(8).toString('hex');

  return {
    uuid,
    clientWg: { private: clientWgPrivate, public: clientWgPublic },
    serverWg: { private: serverWgPrivate, public: serverWgPublic },
    reality: { private: realityPrivate, public: realityPublic },
    shortId
  };
}

module.exports = generateKeys;

if (require.main === module) {
  console.log(JSON.stringify(generateKeys(), null, 2));
}
