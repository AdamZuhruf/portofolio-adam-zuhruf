import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

import {
  CELERATES_MODULES,
  CERTIFICATES,
  PROFILE,
  PROJECTS,
  SKILLS,
  SOCIAL_LINKS,
  STATS,
  TIMELINE
} from '../data/portfolio-data.js';
import { config } from './config.mjs';
import { decryptInquiryField, encryptInquiryField } from './pqcCrypto.mjs';

const { Pool } = pg;

let engineType = 'sqlite';
let pgPool = null;
let sqliteDb = null;
let memStore = null;

function toPgPlaceholders(sqliteSql) {
  let idx = 0;
  return sqliteSql.replace(/\?/g, () => `$${++idx}`);
}

async function execQuery(sqliteSql, params = []) {
  if (engineType === 'postgresql' && pgPool) {
    const pgSql = toPgPlaceholders(sqliteSql);
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  }
  const stmt = sqliteDb.prepare(sqliteSql);
  if (/^\s*(SELECT|PRAGMA)/i.test(sqliteSql)) {
    return stmt.all(...params);
  }
  stmt.run(...params);
  return [];
}

async function createTables() {
  if (engineType === 'postgresql') {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_projects (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        year TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        summary TEXT NOT NULL,
        stack_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        highlights_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        repo_url TEXT,
        repo_label TEXT,
        preview_image TEXT,
        gallery_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        interactive_type TEXT NOT NULL DEFAULT 'case-study',
        sort_order INTEGER NOT NULL DEFAULT 100,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS work_experiences (
        id TEXT PRIMARY KEY,
        period TEXT NOT NULL,
        role TEXT NOT NULL,
        detail TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 100,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS technical_skills (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        level TEXT NOT NULL,
        evidence TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 100,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        badge TEXT NOT NULL,
        title TEXT NOT NULL,
        issuer TEXT NOT NULL,
        issued_date TEXT NOT NULL,
        image_url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 100,
        is_published BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS social_channels (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        code TEXT NOT NULL,
        handle TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        url TEXT NOT NULL,
        secondary_label TEXT,
        secondary_url TEXT,
        copy_handle TEXT,
        cta_label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 100,
        is_published BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS contact_inquiries (
        id TEXT PRIMARY KEY,
        sender_name TEXT NOT NULL,
        organization TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        path TEXT NOT NULL,
        severity TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS uploaded_assets (
        id TEXT PRIMARY KEY,
        owner_scope TEXT NOT NULL,
        file_name TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        sha3_digest TEXT NOT NULL,
        pqc_sig TEXT NOT NULL,
        data_b64 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS showcase_cards (
        id TEXT PRIMARY KEY,
        card_kind TEXT NOT NULL,
        badge_label TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        cover_url TEXT,
        external_url TEXT,
        external_label TEXT,
        files_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 10,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    return;
  }

  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS portfolio_projects (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      year TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      summary TEXT NOT NULL,
      stack_json TEXT NOT NULL DEFAULT '[]',
      highlights_json TEXT NOT NULL DEFAULT '[]',
      repo_url TEXT,
      repo_label TEXT,
      preview_image TEXT,
      gallery_json TEXT NOT NULL DEFAULT '[]',
      interactive_type TEXT NOT NULL DEFAULT 'case-study',
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS work_experiences (
      id TEXT PRIMARY KEY,
      period TEXT NOT NULL,
      role TEXT NOT NULL,
      detail TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS technical_skills (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      evidence TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      badge TEXT NOT NULL,
      title TEXT NOT NULL,
      issuer TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_published INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS social_channels (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      code TEXT NOT NULL,
      handle TEXT NOT NULL,
      channel_type TEXT NOT NULL,
      url TEXT NOT NULL,
      secondary_label TEXT,
      secondary_url TEXT,
      copy_handle TEXT,
      cta_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_published INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id TEXT PRIMARY KEY,
      sender_name TEXT NOT NULL,
      organization TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      path TEXT NOT NULL,
      severity TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS uploaded_assets (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL,
      file_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      sha3_digest TEXT NOT NULL,
      pqc_sig TEXT NOT NULL,
      data_b64 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS showcase_cards (
      id TEXT PRIMARY KEY,
      card_kind TEXT NOT NULL,
      badge_label TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      cover_url TEXT,
      external_url TEXT,
      external_label TEXT,
      files_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 10,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const cols = sqliteDb.prepare(`PRAGMA table_info(portfolio_projects)`).all();
  if (!cols.some((c) => c.name === 'attachments_json')) {
    sqliteDb.exec(`ALTER TABLE portfolio_projects ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]';`);
  }
}

function safeJsonParse(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return fallback;
  }
}

async function seedIfEmpty() {
  const projCount = await execQuery('SELECT COUNT(*) AS cnt FROM portfolio_projects');
  if (Number(projCount[0]?.cnt || 0) === 0) {
    for (let i = 0; i < PROJECTS.length; i += 1) {
      const p = PROJECTS[i];
      await execQuery(
        `INSERT INTO portfolio_projects (id, category, category_label, year, title, subtitle, summary, stack_json, highlights_json, repo_url, repo_label, preview_image, gallery_json, interactive_type, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.category,
          p.categoryLabel,
          p.year,
          p.title,
          p.subtitle,
          p.summary,
          JSON.stringify(p.stack || []),
          JSON.stringify(p.highlights || []),
          p.repoUrl || null,
          p.repoLabel || null,
          p.previewImage || null,
          JSON.stringify(p.gallery || []),
          p.interactiveType || 'case-study',
          i + 1
        ]
      );
    }
  } else {
    const kb = PROJECTS.find((p) => p.id === 'karya-berdua');
    if (kb) {
      const highlightsCol = engineType === 'postgresql' ? 'highlights_json::text' : 'highlights_json';
      await execQuery(
        `UPDATE portfolio_projects SET summary = ?, highlights_json = ? WHERE id = ? AND ${highlightsCol} LIKE '%Optical HUD%'`,
        [kb.summary, JSON.stringify(kb.highlights), 'karya-berdua']
      ).catch(() => {});
    }
  }

  const expCount = await execQuery('SELECT COUNT(*) AS cnt FROM work_experiences');
  if (Number(expCount[0]?.cnt || 0) === 0) {
    for (let i = 0; i < TIMELINE.length; i += 1) {
      const t = TIMELINE[i];
      await execQuery(
        `INSERT INTO work_experiences (id, period, role, detail, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [`exp-${i + 1}`, t.period, t.role, t.detail, i + 1]
      );
    }
  }

  const skillCount = await execQuery('SELECT COUNT(*) AS cnt FROM technical_skills');
  if (Number(skillCount[0]?.cnt || 0) === 0) {
    for (let i = 0; i < SKILLS.length; i += 1) {
      const s = SKILLS[i];
      await execQuery(
        `INSERT INTO technical_skills (id, category, name, level, evidence, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.category, s.name, s.level, s.evidence, i + 1]
      );
    }
  }

  const certCount = await execQuery('SELECT COUNT(*) AS cnt FROM certificates');
  if (Number(certCount[0]?.cnt || 0) === 0) {
    for (let i = 0; i < CERTIFICATES.length; i += 1) {
      const c = CERTIFICATES[i];
      await execQuery(
        `INSERT INTO certificates (id, badge, title, issuer, issued_date, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.badge, c.title, c.issuer, c.date, c.image, i + 1]
      );
    }
  }

  const socialCount = await execQuery('SELECT COUNT(*) AS cnt FROM social_channels');
  if (Number(socialCount[0]?.cnt || 0) === 0) {
    for (let i = 0; i < SOCIAL_LINKS.length; i += 1) {
      const s = SOCIAL_LINKS[i];
      await execQuery(
        `INSERT INTO social_channels (id, platform, code, handle, channel_type, url, secondary_label, secondary_url, copy_handle, cta_label, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.platform,
          s.code,
          s.handle,
          s.channelType,
          s.url,
          s.secondaryLabel || null,
          s.secondaryUrl || null,
          s.copyHandle || null,
          s.ctaLabel,
          i + 1
        ]
      );
    }
  }
}

async function connectPostgresWithAdaptiveSsl(dbUrl) {
  const preferNoSsl = /localhost|127\.0\.0\.1|\.railway\.internal|sslmode=disable/i.test(dbUrl);
  const sslCandidates = preferNoSsl
    ? [false, { rejectUnauthorized: false }]
    : [{ rejectUnauthorized: false }, false];

  let lastErr = null;
  for (const sslOpt of sslCandidates) {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: sslOpt,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    try {
      await pool.query('SELECT 1');
      return pool;
    } catch (err) {
      lastErr = err;
      await pool.end().catch(() => {});
    }
  }
  throw lastErr || new Error('PostgreSQL connection failed');
}

export async function initDatabase(options = {}) {
  if (pgPool || sqliteDb || memStore) return;

  const dbUrl = options.databaseUrl ?? config.databaseUrl;
  if (dbUrl && /^postgres(?:ql)?:\/\//i.test(dbUrl)) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        pgPool = await connectPostgresWithAdaptiveSsl(dbUrl);
        engineType = 'postgresql';
        await createTables();
        await seedIfEmpty();
        console.info('[db] PostgreSQL connected & synchronized (9 tables).');
        return;
      } catch (err) {
        pgPool = null;
        const transient = /EAI_AGAIN|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(`${err?.code || ''} ${err?.message || ''}`);
        if (attempt === 1 && transient) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        console.warn('[db] PostgreSQL connect failed, falling back cleanly:', err.message);
        break;
      }
    }
  }

  try {
    const { DatabaseSync } = await import('node:sqlite');
    const sqliteTarget = options.sqlitePathOverride || config.sqlitePath || './storage/portfolio.sqlite';
    if (sqliteTarget !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(sqliteTarget)), { recursive: true });
    }
    sqliteDb = new DatabaseSync(sqliteTarget);
    engineType = 'sqlite';
    await createTables();
    await seedIfEmpty();
    return;
  } catch (err) {
    console.warn('[db] node:sqlite unavailable, using resilient in-memory store:', err.message);
    sqliteDb = null;
    engineType = 'memory-json';
    memStore = {
      projects: [...PROJECTS],
      timeline: TIMELINE.map((t, i) => ({ id: `exp-${i + 1}`, ...t })),
      skills: [...SKILLS],
      certificates: [...CERTIFICATES],
      socials: [...SOCIAL_LINKS],
      showcaseCards: [],
      assets: new Map(),
      inquiries: [],
      audits: []
    };
  }
}

export async function closeDatabase() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  memStore = null;
}

export function getEngineInfo() {
  return {
    engine: engineType,
    persistent: engineType === 'postgresql' || (engineType === 'sqlite' && config.sqlitePath !== ':memory:'),
    tablesCount: 9
  };
}

export async function getPortfolioSnapshot() {
  if (engineType === 'memory-json' && memStore) {
    return {
      name: PROFILE.name,
      brandTitle: PROFILE.brandTitle,
      location: PROFILE.location,
      publicUrl: config.publicSiteUrl,
      engine: engineType,
      stats: STATS,
      projectsCount: memStore.projects.length,
      experiencesCount: memStore.timeline.length,
      skillsCount: memStore.skills.length,
      socialsCount: memStore.socials.length,
      showcaseCardsCount: memStore.showcaseCards.length,
      projects: memStore.projects,
      timeline: memStore.timeline,
      skills: memStore.skills,
      certificates: memStore.certificates,
      socials: memStore.socials,
      showcaseCards: memStore.showcaseCards,
      modules: CELERATES_MODULES
    };
  }
  const trueVal = engineType === 'postgresql' ? 'TRUE' : '1';
  const [projRows, expRows, skillRows, certRows, socialRows, cardRows] = await Promise.all([
    execQuery(`SELECT * FROM portfolio_projects WHERE is_published = ${trueVal} ORDER BY sort_order ASC, year DESC`),
    execQuery(`SELECT * FROM work_experiences WHERE is_published = ${trueVal} ORDER BY sort_order ASC`),
    execQuery(`SELECT * FROM technical_skills WHERE is_published = ${trueVal} ORDER BY sort_order ASC`),
    execQuery(`SELECT * FROM certificates WHERE is_published = ${trueVal} ORDER BY sort_order ASC`),
    execQuery(`SELECT * FROM social_channels WHERE is_published = ${trueVal} ORDER BY sort_order ASC`),
    execQuery(`SELECT * FROM showcase_cards WHERE is_published = ${trueVal} ORDER BY sort_order ASC, created_at DESC`)
  ]);

  const projects = projRows.map((r) => ({
    id: r.id,
    category: r.category,
    categoryLabel: r.category_label,
    year: r.year,
    title: r.title,
    subtitle: r.subtitle,
    summary: r.summary,
    stack: safeJsonParse(r.stack_json),
    highlights: safeJsonParse(r.highlights_json),
    repoUrl: r.repo_url || undefined,
    repoLabel: r.repo_label || undefined,
    previewImage: r.preview_image || undefined,
    gallery: safeJsonParse(r.gallery_json),
    attachments: safeJsonParse(r.attachments_json),
    interactiveType: r.interactive_type || 'case-study'
  }));

  const timeline = expRows.map((r) => ({
    id: r.id,
    period: r.period,
    role: r.role,
    detail: r.detail
  }));

  const skills = skillRows.map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    level: r.level,
    evidence: r.evidence
  }));

  const certificates = certRows.map((r) => ({
    id: r.id,
    badge: r.badge,
    title: r.title,
    issuer: r.issuer,
    date: r.issued_date,
    image: r.image_url
  }));

  const socials = socialRows.map((r) => ({
    id: r.id,
    platform: r.platform,
    code: r.code,
    handle: r.handle,
    channelType: r.channel_type,
    url: r.url,
    secondaryLabel: r.secondary_label || undefined,
    secondaryUrl: r.secondary_url || undefined,
    copyHandle: r.copy_handle || undefined,
    ctaLabel: r.cta_label
  }));

  const showcaseCards = cardRows.map((r) => ({
    id: r.id,
    cardKind: r.card_kind,
    badgeLabel: r.badge_label,
    title: r.title,
    summary: r.summary,
    coverUrl: r.cover_url || undefined,
    externalUrl: r.external_url || undefined,
    externalLabel: r.external_label || undefined,
    files: safeJsonParse(r.files_json),
    sortOrder: r.sort_order ?? 10
  }));

  return {
    name: PROFILE.name,
    brandTitle: PROFILE.brandTitle,
    location: PROFILE.location,
    publicUrl: config.publicSiteUrl,
    engine: engineType,
    stats: STATS,
    projectsCount: projects.length,
    experiencesCount: timeline.length,
    skillsCount: skills.length,
    socialsCount: socials.length,
    showcaseCardsCount: showcaseCards.length,
    projects,
    timeline,
    skills,
    certificates,
    socials,
    showcaseCards,
    modules: CELERATES_MODULES
  };
}

export async function upsertProject(item) {
  if (engineType === 'memory-json' && memStore) {
    const record = {
      id: item.id,
      category: item.category,
      categoryLabel: item.categoryLabel,
      year: item.year,
      title: item.title,
      subtitle: item.subtitle,
      summary: item.summary,
      stack: item.stack || [],
      highlights: item.highlights || [],
      repoUrl: item.repoUrl || undefined,
      repoLabel: item.repoLabel || undefined,
      previewImage: item.previewImage || undefined,
      attachments: item.attachments || [],
      interactiveType: item.interactiveType || 'case-study',
      sortOrder: item.sortOrder ?? 100
    };
    const idx = memStore.projects.findIndex((p) => p.id === item.id);
    if (idx >= 0) memStore.projects[idx] = record;
    else memStore.projects.push(record);
    memStore.projects.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
    return;
  }
  const existing = await execQuery('SELECT id FROM portfolio_projects WHERE id = ?', [item.id]);
  if (existing.length > 0) {
    await execQuery(
      `UPDATE portfolio_projects SET category = ?, category_label = ?, year = ?, title = ?, subtitle = ?, summary = ?, stack_json = ?, highlights_json = ?, repo_url = ?, repo_label = ?, preview_image = ?, attachments_json = ?, sort_order = ? WHERE id = ?`,
      [
        item.category,
        item.categoryLabel,
        item.year,
        item.title,
        item.subtitle,
        item.summary,
        JSON.stringify(item.stack || []),
        JSON.stringify(item.highlights || []),
        item.repoUrl || null,
        item.repoLabel || null,
        item.previewImage || null,
        JSON.stringify(item.attachments || []),
        item.sortOrder ?? 100,
        item.id
      ]
    );
  } else {
    await execQuery(
      `INSERT INTO portfolio_projects (id, category, category_label, year, title, subtitle, summary, stack_json, highlights_json, repo_url, repo_label, preview_image, attachments_json, interactive_type, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.category,
        item.categoryLabel,
        item.year,
        item.title,
        item.subtitle,
        item.summary,
        JSON.stringify(item.stack || []),
        JSON.stringify(item.highlights || []),
        item.repoUrl || null,
        item.repoLabel || null,
        item.previewImage || null,
        JSON.stringify(item.attachments || []),
        item.interactiveType || 'case-study',
        item.sortOrder ?? 100
      ]
    );
  }
}

export async function deleteProject(id) {
  if (engineType === 'memory-json' && memStore) {
    memStore.projects = memStore.projects.filter((p) => p.id !== id);
    return;
  }
  await execQuery('DELETE FROM portfolio_projects WHERE id = ?', [id]);
}

export async function upsertExperience(item) {
  if (engineType === 'memory-json' && memStore) {
    const record = {
      id: item.id,
      period: item.period,
      role: item.role,
      detail: item.detail,
      sortOrder: item.sortOrder ?? 100
    };
    const idx = memStore.timeline.findIndex((t) => t.id === item.id);
    if (idx >= 0) memStore.timeline[idx] = record;
    else memStore.timeline.push(record);
    memStore.timeline.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
    return;
  }
  const existing = await execQuery('SELECT id FROM work_experiences WHERE id = ?', [item.id]);
  if (existing.length > 0) {
    await execQuery(
      `UPDATE work_experiences SET period = ?, role = ?, detail = ?, sort_order = ? WHERE id = ?`,
      [item.period, item.role, item.detail, item.sortOrder ?? 100, item.id]
    );
  } else {
    await execQuery(
      `INSERT INTO work_experiences (id, period, role, detail, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [item.id, item.period, item.role, item.detail, item.sortOrder ?? 100]
    );
  }
}

export async function deleteExperience(id) {
  if (engineType === 'memory-json' && memStore) {
    memStore.timeline = memStore.timeline.filter((t) => t.id !== id);
    return;
  }
  await execQuery('DELETE FROM work_experiences WHERE id = ?', [id]);
}

export async function upsertSkill(item) {
  if (engineType === 'memory-json' && memStore) {
    const record = {
      id: item.id,
      category: item.category,
      name: item.name,
      level: item.level,
      evidence: item.evidence,
      sortOrder: item.sortOrder ?? 100
    };
    const idx = memStore.skills.findIndex((s) => s.id === item.id);
    if (idx >= 0) memStore.skills[idx] = record;
    else memStore.skills.push(record);
    memStore.skills.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
    return;
  }
  const existing = await execQuery('SELECT id FROM technical_skills WHERE id = ?', [item.id]);
  if (existing.length > 0) {
    await execQuery(
      `UPDATE technical_skills SET category = ?, name = ?, level = ?, evidence = ?, sort_order = ? WHERE id = ?`,
      [item.category, item.name, item.level, item.evidence, item.sortOrder ?? 100, item.id]
    );
  } else {
    await execQuery(
      `INSERT INTO technical_skills (id, category, name, level, evidence, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [item.id, item.category, item.name, item.level, item.evidence, item.sortOrder ?? 100]
    );
  }
}

export async function deleteSkill(id) {
  if (engineType === 'memory-json' && memStore) {
    memStore.skills = memStore.skills.filter((s) => s.id !== id);
    return;
  }
  await execQuery('DELETE FROM technical_skills WHERE id = ?', [id]);
}

export async function saveContactInquiry({ id, senderName, organization, message, ipHash }) {
  const encName = encryptInquiryField(senderName);
  const encOrg = encryptInquiryField(organization || '');
  const encMsg = encryptInquiryField(message);
  if (engineType === 'memory-json' && memStore) {
    memStore.inquiries.unshift({
      id,
      sender_name: encName,
      organization: encOrg,
      message: encMsg,
      ip_hash: ipHash,
      status: 'new',
      created_at: new Date().toISOString()
    });
    return;
  }
  await execQuery(
    `INSERT INTO contact_inquiries (id, sender_name, organization, message, ip_hash) VALUES (?, ?, ?, ?, ?)`,
    [id, encName, encOrg, encMsg, ipHash]
  );
}

export async function listContactInquiries(limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const rows =
    engineType === 'memory-json' && memStore
      ? memStore.inquiries.slice(0, safeLimit)
      : await execQuery(
          `SELECT id, sender_name, organization, message, status, created_at FROM contact_inquiries ORDER BY created_at DESC LIMIT ?`,
          [safeLimit]
        );
  return rows.map((r) => ({
    id: r.id,
    sender_name: decryptInquiryField(r.sender_name),
    organization: decryptInquiryField(r.organization),
    message: decryptInquiryField(r.message),
    status: r.status,
    created_at: r.created_at
  }));
}

export async function recordSecurityAudit({ eventType, path: reqPath, severity, ipHash, detail }) {
  if (engineType === 'memory-json' && memStore) {
    memStore.audits.unshift({
      id: memStore.audits.length + 1,
      event_type: String(eventType || 'UNKNOWN').slice(0, 64),
      path: String(reqPath || '/').slice(0, 200),
      severity: severity || 'medium',
      ip_hash: ipHash || 'anon',
      detail: String(detail || '').slice(0, 250),
      created_at: new Date().toISOString()
    });
    if (memStore.audits.length > 500) memStore.audits.length = 500;
    return;
  }
  if (!pgPool && !sqliteDb) return;
  try {
    await execQuery(
      `INSERT INTO security_audit_logs (event_type, path, severity, ip_hash, detail) VALUES (?, ?, ?, ?, ?)`,
      [String(eventType || 'UNKNOWN').slice(0, 64), String(reqPath || '/').slice(0, 200), severity || 'medium', ipHash || 'anon', String(detail || '').slice(0, 250)]
    );
  } catch {
    // Non-blocking audit logging
  }
}

export async function listSecurityAudits(limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  if (engineType === 'memory-json' && memStore) {
    return memStore.audits.slice(0, safeLimit);
  }
  return execQuery(
    `SELECT id, event_type, path, severity, ip_hash, detail, created_at FROM security_audit_logs ORDER BY id DESC LIMIT ?`,
    [safeLimit]
  );
}

export async function upsertCertificate(item) {
  if (engineType === 'memory-json' && memStore) {
    const record = {
      id: item.id,
      badge: item.badge,
      title: item.title,
      issuer: item.issuer,
      date: item.date,
      image: item.image,
      sortOrder: item.sortOrder ?? 100
    };
    const idx = memStore.certificates.findIndex((c) => c.id === item.id);
    if (idx >= 0) memStore.certificates[idx] = record;
    else memStore.certificates.push(record);
    return;
  }
  const existing = await execQuery('SELECT id FROM certificates WHERE id = ?', [item.id]);
  if (existing.length > 0) {
    await execQuery(
      `UPDATE certificates SET badge = ?, title = ?, issuer = ?, issued_date = ?, image_url = ?, sort_order = ? WHERE id = ?`,
      [item.badge, item.title, item.issuer, item.date, item.image, item.sortOrder ?? 100, item.id]
    );
  } else {
    await execQuery(
      `INSERT INTO certificates (id, badge, title, issuer, issued_date, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.badge, item.title, item.issuer, item.date, item.image, item.sortOrder ?? 100]
    );
  }
}

export async function deleteCertificate(id) {
  if (engineType === 'memory-json' && memStore) {
    memStore.certificates = memStore.certificates.filter((c) => c.id !== id);
    return;
  }
  await execQuery('DELETE FROM certificates WHERE id = ?', [id]);
}

export async function upsertShowcaseCard(card) {
  if (engineType === 'memory-json' && memStore) {
    const record = {
      id: card.id,
      cardKind: card.cardKind,
      badgeLabel: card.badgeLabel,
      title: card.title,
      summary: card.summary,
      coverUrl: card.coverUrl || undefined,
      externalUrl: card.externalUrl || undefined,
      externalLabel: card.externalLabel || undefined,
      files: card.files || [],
      sortOrder: card.sortOrder ?? 10
    };
    const idx = memStore.showcaseCards.findIndex((c) => c.id === card.id);
    if (idx >= 0) memStore.showcaseCards[idx] = record;
    else memStore.showcaseCards.unshift(record);
    return;
  }
  const existing = await execQuery('SELECT id FROM showcase_cards WHERE id = ?', [card.id]);
  if (existing.length > 0) {
    await execQuery(
      `UPDATE showcase_cards SET card_kind = ?, badge_label = ?, title = ?, summary = ?, cover_url = ?, external_url = ?, external_label = ?, files_json = ?, sort_order = ? WHERE id = ?`,
      [
        card.cardKind,
        card.badgeLabel,
        card.title,
        card.summary,
        card.coverUrl || null,
        card.externalUrl || null,
        card.externalLabel || null,
        JSON.stringify(card.files || []),
        card.sortOrder ?? 10,
        card.id
      ]
    );
  } else {
    await execQuery(
      `INSERT INTO showcase_cards (id, card_kind, badge_label, title, summary, cover_url, external_url, external_label, files_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.cardKind,
        card.badgeLabel,
        card.title,
        card.summary,
        card.coverUrl || null,
        card.externalUrl || null,
        card.externalLabel || null,
        JSON.stringify(card.files || []),
        card.sortOrder ?? 10
      ]
    );
  }
}

export async function deleteShowcaseCard(id) {
  if (engineType === 'memory-json' && memStore) {
    memStore.showcaseCards = memStore.showcaseCards.filter((c) => c.id !== id);
    return;
  }
  await execQuery('DELETE FROM showcase_cards WHERE id = ?', [id]);
}

export async function saveUploadedAsset({ assetId, ownerScope, fileName, relativePath, mimeType, byteSize, sha3Digest, pqcSig, dataBase64 }) {
  const row = {
    id: assetId,
    owner_scope: ownerScope,
    file_name: fileName,
    relative_path: relativePath,
    mime_type: mimeType,
    byte_size: byteSize,
    sha3_digest: sha3Digest,
    pqc_sig: pqcSig,
    data_b64: dataBase64,
    created_at: new Date().toISOString()
  };
  if (engineType === 'memory-json' && memStore) {
    memStore.assets.set(assetId, row);
    return;
  }
  await execQuery(
    `INSERT INTO uploaded_assets (id, owner_scope, file_name, relative_path, mime_type, byte_size, sha3_digest, pqc_sig, data_b64)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [assetId, ownerScope, fileName, relativePath, mimeType, byteSize, sha3Digest, pqcSig, dataBase64]
  );
}

export async function getUploadedAsset(assetId) {
  if (engineType === 'memory-json' && memStore) {
    return memStore.assets.get(assetId) || null;
  }
  const rows = await execQuery(
    `SELECT id, owner_scope, file_name, relative_path, mime_type, byte_size, sha3_digest, pqc_sig, data_b64 FROM uploaded_assets WHERE id = ?`,
    [assetId]
  );
  return rows[0] || null;
}

export async function deleteUploadedAsset(assetId) {
  if (engineType === 'memory-json' && memStore) {
    memStore.assets.delete(assetId);
    return;
  }
  await execQuery('DELETE FROM uploaded_assets WHERE id = ?', [assetId]);
}
