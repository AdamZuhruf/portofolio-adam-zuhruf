import { z } from 'zod';

const emptyToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const EnvSchema = z.object({
  NODE_ENV: z.preprocess(emptyToUndefined, z.enum(['development', 'production', 'test']).default('production')),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  HOST: z.preprocess(emptyToUndefined, z.string().trim().min(1).default(process.platform === 'linux' ? '::' : '0.0.0.0')),
  PUBLIC_SITE_URL: z.preprocess(
    emptyToUndefined,
    z.string().trim().url().default('https://portofolio-adam-zuhruf.up.railway.app')
  ),
  PUBLIC_CONTACT_EMAIL: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().default('adamzuhrufanandaf@gmail.com')
  ),
  DATABASE_URL: z.string().trim().optional().default(''),
  DATABASE_PRIVATE_URL: z.string().trim().optional().default(''),
  DATABASE_PUBLIC_URL: z.string().trim().optional().default(''),
  POSTGRES_URL: z.string().trim().optional().default(''),
  PGHOST: z.string().trim().optional().default(''),
  PGPORT: z.string().trim().optional().default(''),
  PGUSER: z.string().trim().optional().default(''),
  PGPASSWORD: z.string().trim().optional().default(''),
  PGDATABASE: z.string().trim().optional().default(''),
  SQLITE_PATH: z.preprocess(emptyToUndefined, z.string().trim().default('./storage/portfolio.sqlite')),
  ADMIN_API_KEY: z.string().trim().optional().default(''),
  ADMIN_SESSION_SECRET: z.string().trim().optional().default(''),
  PQC_MASTER_SEED: z.string().trim().optional().default(''),
  GITHUB_USERNAME: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(60).default('AdamZuhruf')),
  GITHUB_TOKEN: z.string().trim().optional().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().trim().optional().default(''),
  RATE_LIMIT_MAX: z.preprocess(emptyToUndefined, z.coerce.number().int().min(20).max(2000).default(180)),
  ALLOWED_ORIGINS: z.string().default('')
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] Environment configuration error:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

function cleanEnvValue(raw) {
  return String(raw || '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim();
}

function resolveDatabaseUrl(env) {
  for (const rawCandidate of [env.DATABASE_URL, env.DATABASE_PRIVATE_URL, env.DATABASE_PUBLIC_URL, env.POSTGRES_URL]) {
    const candidate = cleanEnvValue(rawCandidate);
    if (candidate && /^postgres(?:ql)?:\/\//i.test(candidate)) {
      return candidate;
    }
  }
  const pgHost = cleanEnvValue(env.PGHOST);
  const pgUser = cleanEnvValue(env.PGUSER);
  const pgDb = cleanEnvValue(env.PGDATABASE);
  if (pgHost && pgUser && pgDb) {
    const port = cleanEnvValue(env.PGPORT) || '5432';
    const user = encodeURIComponent(pgUser);
    const passRaw = cleanEnvValue(env.PGPASSWORD);
    const pass = encodeURIComponent(passRaw);
    const auth = passRaw ? `${user}:${pass}` : user;
    return `postgresql://${auth}@${pgHost}:${port}/${encodeURIComponent(pgDb)}`;
  }
  return cleanEnvValue(env.DATABASE_URL);
}

const rawEnv = parsed.data;
const customOrigins = rawEnv.ALLOWED_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  nodeEnv: rawEnv.NODE_ENV,
  isProd: rawEnv.NODE_ENV === 'production',
  port: rawEnv.PORT,
  hasExplicitPort: Boolean(process.env.PORT && String(process.env.PORT).trim() !== ''),
  host: rawEnv.HOST,
  publicSiteUrl: rawEnv.PUBLIC_SITE_URL.replace(/\/+$/, ''),
  publicContactEmail: rawEnv.PUBLIC_CONTACT_EMAIL,
  databaseUrl: resolveDatabaseUrl(rawEnv),
  sqlitePath: rawEnv.SQLITE_PATH,
  adminApiKey: rawEnv.ADMIN_API_KEY,
  adminSessionSecret: rawEnv.ADMIN_SESSION_SECRET,
  pqcMasterSeed: rawEnv.PQC_MASTER_SEED,
  githubUsername: rawEnv.GITHUB_USERNAME,
  githubToken: rawEnv.GITHUB_TOKEN,
  githubWebhookSecret: rawEnv.GITHUB_WEBHOOK_SECRET,
  rateLimitMax: rawEnv.RATE_LIMIT_MAX,
  allowedOrigins: new Set([
    'https://adamzuhruf.github.io',
    'https://portofolio-adam-zuhruf.up.railway.app',
    rawEnv.PUBLIC_SITE_URL.replace(/\/+$/, ''),
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    ...customOrigins
  ])
};
