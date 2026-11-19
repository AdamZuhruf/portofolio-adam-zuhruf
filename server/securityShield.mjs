import { detectAiCyberPayload, resetAiDefenseForTest, trackAiFuzzerBurst } from './aiDefenseShield.mjs';
import { recordSecurityAudit } from './db.mjs';
import { sha3Hex } from './pqcCrypto.mjs';

const QUARANTINE_THRESHOLD = 100;
const SCORE_WINDOW_MS = 10 * 60 * 1000;
const QUARANTINE_TTL_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 3000;

const scoreMap = new Map();
const quarantineMap = new Map();

export const shieldMetrics = {
  blockedTotal: 0,
  honeypotHits: 0,
  injectionBlocks: 0,
  aiDefenseBlocks: 0,
  quarantinesIssued: 0,
  lastBlockedAt: null
};

const BLOCKED_EXACT_PATHS = new Set([
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.env.example',
  '/.gitignore',
  '/.nojekyll',
  '/.git/config',
  '/.git/head',
  '/.aws/credentials',
  '/package.json',
  '/package-lock.json',
  '/server.mjs',
  '/dockerfile',
  '/railway.toml',
  '/vercel.json',
  '/netlify.toml',
  '/gemini.md',
  '/readme.md',
  '/wp-login.php',
  '/wp-admin',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/pma',
  '/graphql',
  '/swagger.json',
  '/openapi.json',
  '/actuator/env',
  '/actuator/heapdump',
  '/server-status',
  '/api/v1/secrets',
  '/api/debug/env'
]);

const BLOCKED_PREFIXES = [
  '/.env',
  '/.git',
  '/.vscode',
  '/.github',
  '/server/',
  '/storage/',
  '/tools/',
  '/nginx/',
  '/node_modules/',
  '/api/internal',
  '/wp-',
  '/cgi-bin/'
];

const PUBLIC_STATIC_EXACT = new Set([
  '/',
  '/index.html',
  '/admin',
  '/admin.html',
  '/cv',
  '/cv.html',
  '/manifest.webmanifest',
  '/sw.js',
  '/robots.txt',
  '/sitemap.xml'
]);

const PUBLIC_STATIC_PREFIXES = [
  '/assets/',
  '/styles/',
  '/scripts/',
  '/data/',
  '/vendor/'
];

const MALICIOUS_UA_REGEX = /\b(sqlmap|nikto|acunetix|nuclei|masscan|zgrab|gobuster|dirbuster|wfuzz|ffuf|hydra|commix|havij|nessus|openvas|metasploit|burp)\b/i;

const ATTACK_SIGNATURES = [
  { name: 'NULL_BYTE_OR_TRAVERSAL', points: 70, regex: /(\x00|%00|(?:^|[\\/])\.\.(?:[\\/]|%2f|%5c))/i },
  { name: 'JNDI_OR_SSTI_PROBE', points: 85, regex: /(\$\{\s*jndi\s*:|\{\{\s*7\s*\*\s*7\s*\}\}|<%=\s*[^%]+%>)/i },
  { name: 'SQL_INJECTION_PROBE', points: 75, regex: /(\bunion\s+(?:all\s+)?select\b|'\s*(?:or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+|\b(?:pg_sleep|waitfor\s+delay)\b)/i },
  { name: 'XSS_SCRIPT_PROBE', points: 65, regex: /(<\s*script\b|javascript\s*:|on(?:error|load|mouseover|focus)\s*=)/i },
  { name: 'COMMAND_INJECTION_PROBE', points: 85, regex: /(;\s*(?:cat|whoami|curl|wget|bash|nc|powershell)\b|\|\s*(?:bash|sh|cmd)\b)/i },
  { name: 'CLOUD_METADATA_SSRF_PROBE', points: 90, regex: /(?:169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)/i }
];

function pruneMaps(now = Date.now()) {
  if (scoreMap.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of scoreMap.entries()) {
      if (!v || v.expiresAt <= now) scoreMap.delete(k);
    }
    if (scoreMap.size > MAX_TRACKED_KEYS) scoreMap.clear();
  }
  if (quarantineMap.size > MAX_TRACKED_KEYS) {
    for (const [k, exp] of quarantineMap.entries()) {
      if (!exp || exp <= now) quarantineMap.delete(k);
    }
    if (quarantineMap.size > MAX_TRACKED_KEYS) quarantineMap.clear();
  }
}

function hashClientIp(ip) {
  return sha3Hex(String(ip || 'unknown')).slice(0, 20);
}

function recordThreat(ip, points, category, path = '/', detail = '') {
  const now = Date.now();
  pruneMaps(now);
  const key = hashClientIp(ip);
  const prev = scoreMap.get(key);
  const current = prev && prev.expiresAt > now ? prev.score : 0;
  const nextScore = current + points;

  scoreMap.set(key, { score: nextScore, expiresAt: now + SCORE_WINDOW_MS });
  shieldMetrics.blockedTotal += 1;
  shieldMetrics.lastBlockedAt = new Date(now).toISOString();
  if (category === 'honeypot') shieldMetrics.honeypotHits += 1;
  if (category === 'injection') shieldMetrics.injectionBlocks += 1;
  if (category === 'ai-cyber') shieldMetrics.aiDefenseBlocks += 1;

  if (nextScore >= QUARANTINE_THRESHOLD && !quarantineMap.has(key)) {
    quarantineMap.set(key, now + QUARANTINE_TTL_MS);
    shieldMetrics.quarantinesIssued += 1;
  }

  recordSecurityAudit({
    eventType: category.toUpperCase(),
    path,
    severity: points >= 80 ? 'high' : 'medium',
    ipHash: key,
    detail: detail || `score=${nextScore}`
  });
}

export function isPublicAssetPath(urlPath) {
  if (PUBLIC_STATIC_EXACT.has(urlPath)) return true;
  return PUBLIC_STATIC_PREFIXES.some((prefix) => urlPath.startsWith(prefix));
}

export function stripUnsafeText(value) {
  return String(value || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function detectAttackPayload(input) {
  let str = String(input || '');
  for (let pass = 0; pass < 3; pass += 1) {
    for (const sig of ATTACK_SIGNATURES) {
      if (sig.regex.test(str)) {
        return sig;
      }
    }
    const aiSig = detectAiCyberPayload(str);
    if (aiSig) {
      return { ...aiSig, isAi: true };
    }
    try {
      const next = decodeURIComponent(str);
      if (next === str) break;
      str = next;
    } catch {
      break;
    }
  }
  return null;
}

export async function securityShieldPreHandler(req, reply) {
  const clientIp = req.ip || 'unknown';
  const ipHash = hashClientIp(clientIp);
  const now = Date.now();

  const quarantinedUntil = quarantineMap.get(ipHash) || 0;
  if (quarantinedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((quarantinedUntil - now) / 1000));
    reply.header('Retry-After', String(retryAfter));
    return reply.code(429).send({ error: 'Too Many Suspicious Requests' });
  }
  if (quarantinedUntil) quarantineMap.delete(ipHash);

  const rawUrl = String(req.raw.url || '/');
  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(rawUrl.split('?')[0]).toLowerCase();
  } catch {
    recordThreat(clientIp, 70, 'injection', rawUrl, 'Malformed URI');
    return reply.code(400).send({ error: 'Bad Request' });
  }

  // 1. Block malformed User-Agents typical of vulnerability scanners & exploit bots
  const ua = String(req.headers['user-agent'] || '');
  if (MALICIOUS_UA_REGEX.test(ua)) {
    recordThreat(clientIp, 100, 'ai-cyber', decodedPath, 'Automated scanner UA');
    return reply.code(403).send({ error: 'Forbidden' });
  }

  // 2. Scan raw and URL-decoded URL & Query for attack/traversal/AI-prompt-injection patterns
  const sigUrl = detectAttackPayload(rawUrl);
  if (sigUrl) {
    recordThreat(clientIp, sigUrl.points, sigUrl.isAi ? 'ai-cyber' : 'injection', decodedPath, sigUrl.name);
    return reply.code(400).send({ error: 'Blocked Unsafe Request Pattern' });
  }

  // 3. Honeypot & source/config exfiltration blocks
  if (
    BLOCKED_EXACT_PATHS.has(decodedPath) ||
    BLOCKED_PREFIXES.some((prefix) => decodedPath.startsWith(prefix))
  ) {
    recordThreat(clientIp, 55, 'honeypot', decodedPath, 'Sensitive path honeypot trap');
    return reply.code(404).send({ error: 'Not Found' });
  }

  // 4. Reject unknown non-API, non-allowlisted file probes & detect AI burst fuzzer sweeps
  const isHealthOrApi =
    decodedPath === '/healthz' ||
    decodedPath === '/api/health' ||
    decodedPath.startsWith('/api/');
  if (!isHealthOrApi && !isPublicAssetPath(decodedPath)) {
    const burst = trackAiFuzzerBurst(ipHash, decodedPath, now);
    if (burst.isBurst) {
      recordThreat(clientIp, 100, 'ai-cyber', decodedPath, `AI/Bot directory fuzzing burst (${burst.uniquePaths} paths)`);
      return reply.code(429).send({ error: 'Too Many Unknown Probes' });
    }
    return reply.code(404).send({ error: 'Not Found' });
  }
}

export function resetSecurityShieldForTest() {
  scoreMap.clear();
  quarantineMap.clear();
  resetAiDefenseForTest();
  shieldMetrics.blockedTotal = 0;
  shieldMetrics.honeypotHits = 0;
  shieldMetrics.injectionBlocks = 0;
  shieldMetrics.aiDefenseBlocks = 0;
  shieldMetrics.quarantinesIssued = 0;
  shieldMetrics.lastBlockedAt = null;
}
