import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { config } from './config.mjs';

const ENC_PREFIX = 'enc:pqc-gcm:v1:';
const TOKEN_VERSION = 'pqc3';
const SESSION_TTL_SEC = 2 * 60 * 60;

let cachedState = null;
const activePqcSessions = new Map();

function resolveRootEntropyHex() {
  const envParts = [config.pqcMasterSeed, config.adminSessionSecret, config.adminApiKey].filter(Boolean);
  if (envParts.length > 0) {
    return crypto.createHash('sha3-512').update(envParts.join('::az-pqc-root-v2::')).digest('hex');
  }

  const runtimeDir = path.dirname(path.resolve(config.sqlitePath || './storage/portfolio.sqlite'));
  const keyFile = path.join(runtimeDir, '.pqc_runtime.seed');
  try {
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, 'utf8').trim();
      if (existing.length >= 64) return existing;
    }
    fs.mkdirSync(runtimeDir, { recursive: true });
    const generated = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync(keyFile, generated, { encoding: 'utf8', mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(64).toString('hex');
  }
}

function deriveKeyBytes(rootBuf, info, lengthBytes) {
  return Buffer.from(
    crypto.hkdfSync(
      'sha512',
      rootBuf,
      Buffer.from('adam-portfolio-pqc-salt-v2', 'utf8'),
      Buffer.from(info, 'utf8'),
      lengthBytes
    )
  );
}

export function initPqcEngine() {
  if (cachedState) return cachedState;

  const rootHex = resolveRootEntropyHex();
  const rootBuf = Buffer.from(rootHex.slice(0, 128).padEnd(128, '0'), 'hex');

  const dsaSeed = new Uint8Array(deriveKeyBytes(rootBuf, 'ml-dsa-65-identity-v1', 32));
  const kemSeed = new Uint8Array(deriveKeyBytes(rootBuf, 'ml-kem-768-identity-v1', 64));
  const hmacKey = deriveKeyBytes(rootBuf, 'hmac-sha3-256-session-v1', 32);
  const vaultAesKey = deriveKeyBytes(rootBuf, 'aes-256-gcm-inquiry-vault-v1', 32);

  const mlDsaKeys = ml_dsa65.keygen(dsaSeed);
  const mlKemKeys = ml_kem768.keygen(kemSeed);

  const keyId = crypto
    .createHash('sha3-256')
    .update(Buffer.concat([Buffer.from(mlDsaKeys.publicKey), Buffer.from(mlKemKeys.publicKey)]))
    .digest('hex')
    .slice(0, 16);

  cachedState = {
    keyId,
    mlDsaKeys,
    mlKemKeys,
    hmacKey,
    vaultAesKey,
    mlDsaPubFingerprint: crypto.createHash('sha3-256').update(mlDsaKeys.publicKey).digest('hex').slice(0, 24),
    mlKemPubFingerprint: crypto.createHash('sha3-256').update(mlKemKeys.publicKey).digest('hex').slice(0, 24)
  };
  return cachedState;
}

export function resetPqcEngineForTest() {
  cachedState = null;
  activePqcSessions.clear();
}

export function sha3Hex(input) {
  return crypto.createHash('sha3-256').update(String(input ?? ''), 'utf8').digest('hex');
}

export function getPublicPqcStatus() {
  const st = initPqcEngine();
  return {
    active: true,
    keyId: st.keyId,
    signatureAlgorithm: 'NIST FIPS 204 ML-DSA-65 + HMAC-SHA3-256',
    kemAlgorithm: 'NIST FIPS 203 ML-KEM-768',
    hashAlgorithm: 'SHA3-256',
    vaultEncryption: 'AES-256-GCM + HKDF-SHA512',
    mlDsaPublicKeyBytes: st.mlDsaKeys.publicKey.length,
    mlKemPublicKeyBytes: st.mlKemKeys.publicKey.length,
    mlDsaPubFingerprint: st.mlDsaPubFingerprint,
    mlKemPubFingerprint: st.mlKemPubFingerprint
  };
}

export function signHybridSessionToken() {
  const st = initPqcEngine();
  const sid = crypto.randomBytes(16).toString('hex');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_TTL_SEC;
  const payload = {
    v: TOKEN_VERSION,
    role: 'owner',
    kid: st.keyId,
    sid,
    iat,
    exp,
    nonce: crypto.randomBytes(12).toString('hex')
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const pqcSig = ml_dsa65.sign(new TextEncoder().encode(encoded), st.mlDsaKeys.secretKey);
  if (activePqcSessions.size > 1000) activePqcSessions.clear();
  activePqcSessions.set(sid, { encoded, pqcSig, exp });

  // Compact cookie wire token (< 140 bytes, safely below RFC 6265 / Chrome 4096-byte cookie limit)
  const expB36 = exp.toString(36);
  const wireHmac = crypto.createHmac('sha3-256', st.hmacKey).update(`${sid}.${expB36}`).digest('base64url');
  return `${sid}.${expB36}.${wireHmac}`;
}

export function verifyHybridSessionToken(token) {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;

  const st = initPqcEngine();
  const [sid, expB36, wireHmac] = parts;
  if (!/^[0-9a-f]{32}$/.test(sid)) return false;

  // 1. Classical HMAC-SHA3-256 constant-time check
  const expectedHmac = crypto.createHmac('sha3-256', st.hmacKey).update(`${sid}.${expB36}`).digest('base64url');
  const a = Buffer.from(wireHmac, 'utf8');
  const b = Buffer.from(expectedHmac, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const sess = activePqcSessions.get(sid);
  if (!sess || sess.exp <= nowSec) {
    activePqcSessions.delete(sid);
    return false;
  }

  // 2. Post-Quantum ML-DSA-65 signature verification on server-stored PQC envelope
  try {
    const msgBytes = new TextEncoder().encode(sess.encoded);
    if (!ml_dsa65.verify(sess.pqcSig, msgBytes, st.mlDsaKeys.publicKey)) {
      return false;
    }
    const payload = JSON.parse(Buffer.from(sess.encoded, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'owner' || payload.v !== TOKEN_VERSION || payload.sid !== sid) return false;
    return Number(payload.exp) > nowSec;
  } catch {
    return false;
  }
}

export function revokeHybridSessionToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length === 3 && /^[0-9a-f]{32}$/.test(parts[0])) {
    activePqcSessions.delete(parts[0]);
  }
}

export function signPortfolioIntegrityManifest(snapshotObj) {
  const st = initPqcEngine();
  const canonical = JSON.stringify({
    projectsCount: snapshotObj.projectsCount,
    experiencesCount: snapshotObj.experiencesCount,
    skillsCount: snapshotObj.skillsCount,
    socialsCount: snapshotObj.socialsCount,
    projectIds: (snapshotObj.projects || []).map((p) => p.id),
    skillIds: (snapshotObj.skills || []).map((s) => s.id),
    socialIds: (snapshotObj.socials || []).map((s) => s.id)
  });
  const sha3Digest = sha3Hex(canonical);
  const sigBytes = ml_dsa65.sign(new TextEncoder().encode(sha3Digest), st.mlDsaKeys.secretKey);
  return {
    keyId: st.keyId,
    algorithm: 'ML-DSA-65 + SHA3-256',
    issuedAt: new Date().toISOString(),
    sha3Digest,
    signatureB64Url: Buffer.from(sigBytes).toString('base64url'),
    mlDsaPublicKeyB64Url: Buffer.from(st.mlDsaKeys.publicKey).toString('base64url')
  };
}

export function verifyManifestDigestSignature(sha3Digest, signatureB64Url) {
  const st = initPqcEngine();
  try {
    const sigBytes = new Uint8Array(Buffer.from(String(signatureB64Url || ''), 'base64url'));
    const msgBytes = new TextEncoder().encode(String(sha3Digest || ''));
    return Boolean(ml_dsa65.verify(sigBytes, msgBytes, st.mlDsaKeys.publicKey));
  } catch {
    return false;
  }
}

export function signAssetDigest(sha3Digest, metadataStr) {
  const st = initPqcEngine();
  const payload = `${String(sha3Digest || '')}|${String(metadataStr || '')}`;
  const sig = ml_dsa65.sign(new TextEncoder().encode(payload), st.mlDsaKeys.secretKey);
  return Buffer.from(sig).toString('base64url');
}

export function verifyAssetDigest(sha3Digest, metadataStr, signatureB64Url) {
  const st = initPqcEngine();
  try {
    const sigBytes = new Uint8Array(Buffer.from(String(signatureB64Url || ''), 'base64url'));
    const payload = `${String(sha3Digest || '')}|${String(metadataStr || '')}`;
    return Boolean(ml_dsa65.verify(sigBytes, new TextEncoder().encode(payload), st.mlDsaKeys.publicKey));
  } catch {
    return false;
  }
}

export function encryptInquiryField(plainText) {
  const st = initPqcEngine();
  const text = String(plainText ?? '');
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', st.vaultAesKey, iv);
  cipher.setAAD(Buffer.from('portfolio-inquiry-aad-v1', 'utf8'));
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptInquiryField(storedValue) {
  const raw = String(storedValue ?? '');
  if (!raw.startsWith(ENC_PREFIX)) return raw;
  const st = initPqcEngine();
  try {
    const parts = raw.slice(ENC_PREFIX.length).split('.');
    if (parts.length !== 3) return '[Terenkripsi]';
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', st.vaultAesKey, Buffer.from(ivB64, 'base64url'));
    decipher.setAAD(Buffer.from('portfolio-inquiry-aad-v1', 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '[Kunci Vault Berbeda / Terproteksi]';
  }
}
