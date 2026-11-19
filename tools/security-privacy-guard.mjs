import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const FORBIDDEN_TRACKED_FILES = [
  /^\.env($|\.(?!example$))/i,
  /\.pem$|\.key$|\.p12$|\.pfx$|\.kdbx$/i,
  /(^|\/)(id_rsa|id_ed25519|id_ecdsa)$/i
];

const SECRET_PATTERNS = [
  { name: 'GitHub Token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: 'Google / Gemini API Key', regex: /\bAIza[0-9A-Za-z\-_]{30,}\b/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Railway Token', regex: /\bRAILWAY_(?:API_)?TOKEN\s*[:=]\s*['"]?[A-Za-z0-9\-_]{16,}['"]?/i },
  { name: 'Live Payment Key', regex: /\b(?:sk_live|rk_live|Mid-server|xnd_production)_[A-Za-z0-9\-_]{12,}\b/ },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { name: 'Embedded DB/Redis Password URL', regex: /\b(?:postgres|postgresql|redis|mysql):\/\/[^:\s"']+:(?!\$\{)[^@\s"'<>{}]{6,}@[^\s"'<>{}]+/i },
  { name: 'Hardcoded JWT / Bearer Secret', regex: /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/ }
];

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.txt', '.xml', '.yml', '.yaml', '.toml', '.webmanifest', '.example'
]);

function getTargetFiles() {
  try {
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' });
    return [...new Set([...tracked.split(/\r?\n/), ...untracked.split(/\r?\n/)].map((s) => s.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

const files = getTargetFiles();
const violations = [];

for (const rel of files) {
  const posix = rel.replace(/\\/g, '/');
  if (posix.startsWith('vendor/') || posix === 'package-lock.json' || posix === 'tools/security-privacy-guard.mjs') {
    continue;
  }

  for (const rule of FORBIDDEN_TRACKED_FILES) {
    if (rule.test(posix)) {
      violations.push(`[FORBIDDEN_FILE] File sensitif tidak boleh dipublikasikan: ${posix}`);
    }
  }

  const ext = path.extname(posix).toLowerCase();
  const base = path.basename(posix);
  if (!TEXT_EXTENSIONS.has(ext) && base !== 'Dockerfile') continue;

  const fullPath = path.join(ROOT, posix);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');

  for (const pat of SECRET_PATTERNS) {
    if (pat.regex.test(content)) {
      violations.push(`[SECRET_LEAK] Terdeteksi "${pat.name}" di file: ${posix}`);
    }
  }
}

if (violations.length > 0) {
  console.error('SECURITY PRIVACY GUARD GAGAL:');
  for (const v of violations) console.error(' -', v);
  process.exit(1);
}

console.log(`PASS [guard:security] Memindai ${files.length} file proyek: 0 kredensial bocor atau file sensitif.`);
