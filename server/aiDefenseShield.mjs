const AI_PROMPT_INJECTION_PATTERNS = [
  {
    name: 'AI_PROMPT_OVERRIDE',
    points: 85,
    regex: /(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|disregard\s+(?:system|all)\s+prompts?|you\s+are\s+now\s+(?:DAN|unrestricted|developer\s+mode))/i
  },
  {
    name: 'AI_CHATML_DELIM_INJECTION',
    points: 90,
    regex: /(?:<\|im_start\|>|<\|im_end\|>|<\|system\|>|\[INST\]|<<SYS>>|\n###\s*(?:System|Assistant|Developer)\s*:)/i
  },
  {
    name: 'AI_SECRET_EXFIL_PROBE',
    points: 85,
    regex: /(?:reveal|print|dump|output|exfiltrate)\s+(?:your\s+)?(?:ADMIN_API_KEY|DATABASE_URL|PQC_MASTER_SEED|process\.env|system\s+prompt|private\s+key)/i
  }
];

const BURST_WINDOW_MS = 12 * 1000;
const BURST_UNIQUE_PATH_LIMIT = 5;
const burstMap = new Map();

export function detectAiCyberPayload(input) {
  const str = String(input || '');
  for (const pat of AI_PROMPT_INJECTION_PATTERNS) {
    if (pat.regex.test(str)) {
      return pat;
    }
  }
  return null;
}

export function trackAiFuzzerBurst(ipHash, pathStr, now = Date.now()) {
  if (burstMap.size > 3000) burstMap.clear();
  let entry = burstMap.get(ipHash);
  if (!entry || entry.expiresAt <= now) {
    entry = { paths: new Set(), hits: 0, expiresAt: now + BURST_WINDOW_MS };
  }
  entry.hits += 1;
  entry.paths.add(String(pathStr || '/').slice(0, 80));
  burstMap.set(ipHash, entry);

  if (entry.paths.size >= BURST_UNIQUE_PATH_LIMIT || entry.hits >= 15) {
    return { isBurst: true, uniquePaths: entry.paths.size, hits: entry.hits };
  }
  return { isBurst: false, uniquePaths: entry.paths.size, hits: entry.hits };
}

export function resetAiDefenseForTest() {
  burstMap.clear();
}
