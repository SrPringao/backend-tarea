// Descarga de archivos guardados en disco (cuando no hay Supabase Storage).
// La URL lleva firma HMAC y expiración, igual que las URLs firmadas de Supabase.
const storage = require('../services/storage');

async function download(req, res) {
  const target = storage.resolveLocal(req.validated.query);
  // El archivo se muestra pero nunca se ejecuta como página (CSP sandbox)
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.set('Cache-Control', 'private, max-age=3600');
  return res.sendFile(target);
}

module.exports = { download };
