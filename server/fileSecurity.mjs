import crypto from 'node:crypto';
import path from 'node:path';
import { detectAiCyberPayload } from './aiDefenseShield.mjs';
import { detectAttackPayload } from './securityShield.mjs';

export const MAX_ASSET_BYTES = 6 * 1024 * 1024; // 6 MB per file

const FORBIDDEN_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'svg', 'svgz', 'xml',
  'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx',
  'php', 'php5', 'phtml', 'phar', 'asp', 'aspx', 'jsp',
  'py', 'rb', 'pl', 'cgi', 'sh', 'bash', 'zsh',
  'ps1', 'psm1', 'bat', 'cmd', 'vbs', 'hta',
  'exe', 'dll', 'msi', 'scr', 'com', 'pif',
  'jar', 'war', 'ear', 'apk', 'ipa', 'elf', 'so', 'dylib'
]);

const ALLOWED_TYPES = {
  png: { mime: 'image/png', isImage: true },
  jpg: { mime: 'image/jpeg', isImage: true },
  jpeg: { mime: 'image/jpeg', isImage: true },
  webp: { mime: 'image/webp', isImage: true },
  pdf: { mime: 'application/pdf', isImage: false },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', isImage: false },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', isImage: false },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', isImage: false },
  zip: { mime: 'application/zip', isImage: false },
  txt: { mime: 'text/plain; charset=utf-8', isImage: false },
  md: { mime: 'text/markdown; charset=utf-8', isImage: false }
};

function makeSecurityError(message, code = 'UNSAFE_UPLOAD') {
  const err = new Error(message);
  err.code = code;
  err.statusCode = 400;
  return err;
}

export function sanitizeSingleFilename(rawName) {
  const base = path.basename(String(rawName || '').trim()).replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, '-');
  const clean = base.replace(/\s+/g, ' ').trim();
  if (!clean || clean.startsWith('.')) {
    throw makeSecurityError('Nama file tidak valid atau berupa dotfile tersembunyi.');
  }

  const parts = clean.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) {
    throw makeSecurityError('File wajib memiliki ekstensi yang diizinkan (PNG, JPG, WebP, PDF, DOCX, ZIP, TXT, MD).');
  }

  for (let i = 1; i < parts.length; i += 1) {
    if (FORBIDDEN_EXTENSIONS.has(parts[i])) {
      throw makeSecurityError(`Ekstensi berbahaya ".${parts[i]}" diblokir oleh sistem keamanan.`);
    }
  }

  const ext = parts[parts.length - 1];
  if (!ALLOWED_TYPES[ext]) {
    throw makeSecurityError(`Tipe file ".${ext}" belum diizinkan. Gunakan PNG, JPG, WebP, PDF, DOCX, XLSX, PPTX, ZIP, TXT, atau MD.`);
  }

  return { safeName: clean.slice(0, 120), ext };
}

export function sanitizeFolderRelativePath(rawRel, fallbackName) {
  const normalized = String(rawRel || fallbackName || '')
    .replace(/\\/g, '/')
    .trim();
  if (!normalized || normalized.includes('\x00')) {
    return sanitizeSingleFilename(fallbackName).safeName;
  }
  const rawSegments = normalized.split('/').filter(Boolean);
  const safeSegments = [];
  for (const seg of rawSegments) {
    if (seg === '.' || seg === '..' || seg.startsWith('.')) {
      throw makeSecurityError('Path folder mengandung traversal atau dotfile tersembunyi.');
    }
    const cleanSeg = seg.replace(/[\x00-\x1f\x7f:*?"<>|]/g, '-').trim();
    if (!cleanSeg) continue;
    safeSegments.push(cleanSeg.slice(0, 80));
  }
  if (safeSegments.length === 0) {
    return sanitizeSingleFilename(fallbackName).safeName;
  }
  const last = sanitizeSingleFilename(safeSegments[safeSegments.length - 1]);
  safeSegments[safeSegments.length - 1] = last.safeName;
  return safeSegments.join('/').slice(0, 220);
}

function hasExecutableOrScriptHeader(buf) {
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return true; // PE / MZ (.exe/.dll)
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true; // ELF
  if (buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21) return true; // Shebang (#!)
  const headText = buf.subarray(0, Math.min(buf.length, 4096)).toString('utf8');
  if (/(?:<\s*script\b|<\?\s*php\b|<\s*!doctype\s+html|<\s*html\b|<\s*svg\b|javascript\s*:)/i.test(headText)) {
    return true;
  }
  return false;
}

function verifyMagicBytes(buf, ext) {
  if (ext === 'png') {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return buf.length >= 8 && sig.every((b, idx) => buf[idx] === b) && !hasExecutableOrScriptHeader(buf);
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff && !hasExecutableOrScriptHeader(buf);
  }
  if (ext === 'webp') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP' &&
      !hasExecutableOrScriptHeader(buf)
    );
  }
  if (ext === 'pdf') {
    if (buf.length < 5 || buf.subarray(0, 5).toString('ascii') !== '%PDF-') return false;
    const scanText = buf.subarray(0, Math.min(buf.length, 256 * 1024)).toString('latin1');
    if (/\/JavaScript\b|\/JS\b|\/Launch\b/i.test(scanText)) {
      throw makeSecurityError('File PDF mengandung aksi skrip aktif (/JavaScript atau /Launch) dan diblokir demi keamanan.');
    }
    return true;
  }
  if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || ext === 'zip') {
    const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05);
    if (!isZip) return false;
    const rawScan = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString('latin1');
    if (/\.(?:exe|dll|bat|cmd|ps1|vbs|js|html|php)\x00|\.(?:exe|dll|bat|ps1|vbs|scr)\b/i.test(rawScan)) {
      throw makeSecurityError('Arsip ZIP/Dokumen terdeteksi memuat file skrip atau executable terlarang.');
    }
    return true;
  }
  if (ext === 'txt' || ext === 'md') {
    if (buf.includes(0x00) || hasExecutableOrScriptHeader(buf)) return false;
    const text = buf.toString('utf8');
    if (detectAttackPayload(text) || detectAiCyberPayload(text)) {
      throw makeSecurityError('File teks terdeteksi mengandung skrip berbahaya atau payload prompt-injection.');
    }
    return true;
  }
  return false;
}

export function inspectAndSanitizeUpload({ fileName, relativePath, dataBase64 }) {
  const { safeName, ext } = sanitizeSingleFilename(fileName);
  const safeRel = sanitizeFolderRelativePath(relativePath, safeName);

  const cleanB64 = String(dataBase64 || '').replace(/^data:[^;]+;base64,/i, '').trim();
  if (!cleanB64) {
    throw makeSecurityError('Konten file kosong.');
  }

  const buffer = Buffer.from(cleanB64, 'base64');
  if (!buffer.length) {
    throw makeSecurityError('Data file tidak valid atau kosong.');
  }
  if (buffer.length > MAX_ASSET_BYTES) {
    throw makeSecurityError(`Ukuran file melebihi batas aman maksimal (${Math.round(MAX_ASSET_BYTES / (1024 * 1024))} MB).`);
  }

  if (!verifyMagicBytes(buffer, ext)) {
    throw makeSecurityError(`Tanda tangan biner (magic bytes) file ".${ext}" tidak cocok atau mengandung konten poliglot berbahaya.`);
  }

  const rule = ALLOWED_TYPES[ext];
  const sha3Digest = crypto.createHash('sha3-256').update(buffer).digest('hex');
  const assetId = `ast-${crypto.randomBytes(12).toString('hex')}`;

  return {
    assetId,
    safeName,
    relativePath: safeRel,
    ext,
    mimeType: rule.mime,
    isImage: rule.isImage,
    byteSize: buffer.length,
    sha3Digest,
    dataBase64: buffer.toString('base64')
  };
}

export function isSafePublicOrAssetUrl(rawUrl) {
  const val = String(rawUrl || '').trim();
  if (!val) return true;
  if (/^\.\/(?:assets|docs)\/[a-z0-9._\-\/]+$/i.test(val) && !val.includes('..')) return true;
  if (/^\.\/api\/assets\/ast-[0-9a-f]{24}$/.test(val)) return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
