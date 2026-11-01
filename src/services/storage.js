// Almacenamiento de archivos (imagen de tarjeta y comprobantes).
//  - Con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: Supabase Storage, bucket privado y URLs firmadas que expiran.
//  - Sin Supabase (p. ej. en la máquina del profesor): carpeta local y URLs firmadas con HMAC servidas por la API.
// En ambos casos el tipo real del archivo se valida por sus primeros bytes, no por la extensión.
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const URL_TTL_SECONDS = 60 * 60;

const SIGNATURES = [
  { type: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'application/pdf', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

// Solo se usa el cliente de Storage (no supabase-js completo, que exige WebSocket nativo de Node 22+)
let storageClient = null;
function supabaseStorage() {
  if (!storageClient) {
    const { StorageClient } = require('@supabase/storage-js');
    const key = config.storage.supabaseKey;
    storageClient = new StorageClient(`${config.storage.supabaseUrl}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` });
  }
  return storageClient;
}

const useSupabase = () => Boolean(config.storage.supabaseUrl) && !config.isTest;

function detectType(buffer, allowed) {
  const match = SIGNATURES.find((s) => s.bytes.every((b, i) => buffer[i] === b));
  if (!match || !allowed.includes(match.type)) {
    const names = allowed.map((t) => t.split('/')[1].toUpperCase()).join(', ');
    throw ApiError.badRequest(`Tipo de archivo no permitido; se aceptan: ${names}`);
  }
  return match;
}

// file: objeto File de GraphQL Yoga (multipart). folder: 'accounts' o 'receipts'.
async function save(userId, folder, file, allowed) {
  if (!file || typeof file.arrayBuffer !== 'function') throw ApiError.badRequest('Falta el archivo');
  if (file.size > config.storage.maxBytes) {
    throw ApiError.badRequest(`El archivo supera el máximo de ${config.storage.maxBytes / (1024 * 1024)} MB`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { type, ext } = detectType(buffer, allowed);
  // Nombre aleatorio: no se usa el nombre original para evitar rutas maliciosas (../)
  const objectPath = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;

  if (useSupabase()) {
    const { error } = await supabaseStorage().from(config.storage.bucket).upload(objectPath, buffer, { contentType: type });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
  } else {
    const target = path.join(config.storage.localDir, objectPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  }
  return objectPath;
}

async function remove(objectPath) {
  if (!objectPath) return;
  try {
    if (useSupabase()) {
      await supabaseStorage().from(config.storage.bucket).remove([objectPath]);
    } else {
      await fs.rm(path.join(config.storage.localDir, objectPath), { force: true });
    }
  } catch (error) {
    console.error('[ARCHIVOS] No se pudo borrar', objectPath, error.message);
  }
}

const localSignature = (objectPath, expires) =>
  crypto.createHmac('sha256', config.jwt.secret).update(`${objectPath}:${expires}`).digest('base64url');

// URL temporal para descargar un archivo privado
async function signedUrl(objectPath) {
  if (!objectPath) return null;
  if (useSupabase()) {
    const { data, error } = await supabaseStorage().from(config.storage.bucket).createSignedUrl(objectPath, URL_TTL_SECONDS);
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    return data.signedUrl;
  }
  const expires = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
  const query = new URLSearchParams({ path: objectPath, expires: String(expires), sig: localSignature(objectPath, expires) });
  return `${config.publicUrl}/api/files?${query}`;
}

// Valida una URL firmada local y devuelve la ruta absoluta del archivo
function resolveLocal({ path: objectPath, expires, sig }) {
  const expected = Buffer.from(localSignature(objectPath, expires));
  const received = Buffer.from(String(sig));
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw ApiError.forbidden('Firma inválida');
  }
  if (Number(expires) < Date.now() / 1000) throw ApiError.forbidden('El enlace expiró');

  const target = path.resolve(config.storage.localDir, objectPath);
  if (!target.startsWith(config.storage.localDir + path.sep)) throw ApiError.forbidden('Ruta inválida');
  return target;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

module.exports = { save, remove, signedUrl, resolveLocal, useSupabase, supabaseStorage, IMAGE_TYPES, RECEIPT_TYPES };
