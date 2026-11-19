import crypto from 'node:crypto';
import { config } from './config.mjs';
import { recordSecurityAudit } from './db.mjs';
import { revokeHybridSessionToken, sha3Hex, signHybridSessionToken, verifyHybridSessionToken } from './pqcCrypto.mjs';

const COOKIE_NAME = 'portfolio_admin_session';
const SESSION_TTL_SEC = 2 * 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const failedLoginMap = new Map();

export function isAdminConfigured() {
  return Boolean(config.adminApiKey && config.adminApiKey.length >= 24);
}

export function hashIp(ip) {
  return sha3Hex(String(ip || 'unknown')).slice(0, 20);
}

function timingSafeMatch(input, expected) {
  if (!input || !expected) return false;
  const a = crypto.createHash('sha3-256').update(String(input)).digest();
  const b = crypto.createHash('sha3-256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(cookieHeader) {
  const result = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      result[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return result;
}

export async function handleAdminLogin(req, reply) {
  if (!isAdminConfigured()) {
    return reply.code(503).send({
      ok: false,
      error: 'Admin API terkunci (fail-closed): set ADMIN_API_KEY (min 24 karakter) di Railway Variables.'
    });
  }

  const clientHash = hashIp(req.ip);
  const now = Date.now();
  const lockEntry = failedLoginMap.get(clientHash);
  if (lockEntry && lockEntry.lockedUntil > now) {
    const retryAfterSec = Math.ceil((lockEntry.lockedUntil - now) / 1000);
    reply.header('Retry-After', String(retryAfterSec));
    return reply.code(429).send({ ok: false, error: 'Terlalu banyak percobaan login gagal. Coba lagi nanti.' });
  }

  const candidate = String(req.body?.apiKey || '');
  if (!timingSafeMatch(candidate, config.adminApiKey)) {
    const prevCount = lockEntry && lockEntry.resetAt > now ? lockEntry.count : 0;
    const count = prevCount + 1;
    const lockedUntil = count >= MAX_FAILED_ATTEMPTS ? now + LOCK_WINDOW_MS : 0;
    failedLoginMap.set(clientHash, { count, resetAt: now + LOCK_WINDOW_MS, lockedUntil });
    if (failedLoginMap.size > 2000) failedLoginMap.clear();
    await recordSecurityAudit({
      eventType: 'ADMIN_LOGIN_FAILED',
      path: '/api/admin/login',
      severity: lockedUntil ? 'high' : 'medium',
      ipHash: clientHash,
      detail: `Failed attempt #${count}`
    });
    return reply.code(401).send({ ok: false, error: 'Kredensial admin tidak valid.' });
  }

  failedLoginMap.delete(clientHash);
  const sessionToken = signHybridSessionToken();
  const secureFlag = config.isProd && req.protocol === 'https' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_TTL_SEC}${secureFlag}`
  );
  reply.header('Cache-Control', 'no-store');
  await recordSecurityAudit({
    eventType: 'ADMIN_PQC_LOGIN_SUCCESS',
    path: '/api/admin/login',
    severity: 'info',
    ipHash: clientHash,
    detail: 'Hybrid ML-DSA-65 + HMAC-SHA3-256 session issued'
  });
  return { ok: true, algorithm: 'ML-DSA-65 + HMAC-SHA3-256', expiresInSec: SESSION_TTL_SEC };
}

export async function handleAdminLogout(req, reply) {
  const cookies = parseCookies(req.headers.cookie);
  revokeHybridSessionToken(cookies[COOKIE_NAME]);
  reply.header('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0`);
  reply.header('Cache-Control', 'no-store');
  return { ok: true };
}

export async function requireAdminAuth(req, reply) {
  if (!isAdminConfigured()) {
    return reply.code(503).send({
      ok: false,
      error: 'Admin API terkunci (fail-closed): ADMIN_API_KEY belum diset pada Railway Environment Variables.'
    });
  }

  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (timingSafeMatch(bearer, config.adminApiKey)) {
      return;
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  if (verifyHybridSessionToken(cookies[COOKIE_NAME])) {
    return;
  }

  return reply.code(401).send({ ok: false, error: 'Unauthorized: Sesi admin Post-Quantum diperlukan.' });
}

export function resetAdminAuthForTest() {
  failedLoginMap.clear();
}
