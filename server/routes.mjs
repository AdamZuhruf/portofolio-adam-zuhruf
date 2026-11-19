import crypto from 'node:crypto';
import { z } from 'zod';
import {
  handleAdminLogin,
  handleAdminLogout,
  hashIp,
  isAdminConfigured,
  requireAdminAuth
} from './adminAuth.mjs';
import { config } from './config.mjs';
import {
  deleteCertificate,
  deleteExperience,
  deleteProject,
  deleteShowcaseCard,
  deleteSkill,
  deleteUploadedAsset,
  getEngineInfo,
  getPortfolioSnapshot,
  getUploadedAsset,
  listContactInquiries,
  listSecurityAudits,
  recordSecurityAudit,
  saveContactInquiry,
  saveUploadedAsset,
  upsertCertificate,
  upsertExperience,
  upsertProject,
  upsertShowcaseCard,
  upsertSkill
} from './db.mjs';
import { buildLiveCvDocxBuffer, buildLivePortfolioDocxBuffer } from './documentExport.mjs';
import { inspectAndSanitizeUpload, isSafePublicOrAssetUrl } from './fileSecurity.mjs';
import { getLiveGitHubSnapshot } from './githubSync.mjs';
import { attachSseClient, getLiveState, notifyPortfolioChanged } from './liveSync.mjs';
import { detectAttackPayload, shieldMetrics, stripUnsafeText } from './securityShield.mjs';
import {
  getPublicPqcStatus,
  signAssetDigest,
  signPortfolioIntegrityManifest,
  verifyAssetDigest,
  verifyManifestDigestSignature
} from './pqcCrypto.mjs';

const ContactDraftSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Nama maksimal 80 karakter'),
  org: z.string().trim().max(100, 'Instansi maksimal 100 karakter').optional().default(''),
  message: z.string().trim().min(8, 'Pesan minimal 8 karakter').max(1500, 'Pesan maksimal 1500 karakter')
});

const AdminLoginSchema = z.object({
  apiKey: z.string().trim().min(1).max(256)
});

const AttachmentRefSchema = z.object({
  assetId: z.string().trim().regex(/^ast-[0-9a-f]{24}$/),
  fileName: z.string().trim().min(1).max(140),
  relativePath: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(3).max(120),
  byteSize: z.coerce.number().int().min(1).max(10 * 1024 * 1024),
  sha3Digest: z.string().trim().regex(/^[0-9a-f]{64}$/i).optional().default('')
});

const ProjectInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,64}$/, 'ID proyek hanya boleh huruf kecil, angka, dan tanda hubung'),
  category: z.enum(['fullstack', 'pos', 'uiux', 'demo', 'other']),
  categoryLabel: z.string().trim().min(2).max(50),
  year: z.string().trim().min(4).max(20),
  title: z.string().trim().min(3).max(140),
  subtitle: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(10).max(1200),
  stack: z.array(z.string().trim().min(1).max(40)).min(1).max(15),
  highlights: z.array(z.string().trim().min(3).max(300)).min(1).max(10),
  repoUrl: z.string().trim().refine(isSafePublicOrAssetUrl, 'URL tidak aman').optional().or(z.literal('')),
  repoLabel: z.string().trim().max(40).optional().default('Buka Tautan'),
  previewImage: z.string().trim().refine(isSafePublicOrAssetUrl, 'URL gambar pratinjau tidak aman').optional().or(z.literal('')),
  attachments: z.array(AttachmentRefSchema).max(25).optional().default([]),
  interactiveType: z.string().trim().max(40).optional().default('case-study'),
  sortOrder: z.coerce.number().int().min(1).max(999).default(10)
});

const CertificateInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,64}$/),
  badge: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(160),
  issuer: z.string().trim().min(2).max(140),
  date: z.string().trim().min(3).max(60),
  image: z.string().trim().min(3).refine(isSafePublicOrAssetUrl, 'URL gambar/file sertifikat tidak aman'),
  sortOrder: z.coerce.number().int().min(1).max(999).default(10)
});

const ShowcaseCardInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,64}$/),
  cardKind: z.enum(['folder', 'project', 'demo', 'certificate', 'document', 'design', 'other']),
  badgeLabel: z.string().trim().min(2).max(40),
  title: z.string().trim().min(2).max(140),
  summary: z.string().trim().min(5).max(1000),
  coverUrl: z.string().trim().refine(isSafePublicOrAssetUrl, 'URL sampul tidak aman').optional().or(z.literal('')),
  externalUrl: z.string().trim().refine(isSafePublicOrAssetUrl, 'URL eksternal tidak aman').optional().or(z.literal('')),
  externalLabel: z.string().trim().max(40).optional().default('Buka Tautan'),
  files: z.array(AttachmentRefSchema).max(25).optional().default([]),
  sortOrder: z.coerce.number().int().min(1).max(999).default(10)
});

const ExperienceInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,64}$/),
  period: z.string().trim().min(3).max(60),
  role: z.string().trim().min(3).max(140),
  detail: z.string().trim().min(10).max(600),
  sortOrder: z.coerce.number().int().min(1).max(999).default(10)
});

const SkillInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,64}$/),
  category: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(140),
  level: z.string().trim().min(2).max(50),
  evidence: z.string().trim().min(5).max(240),
  sortOrder: z.coerce.number().int().min(1).max(999).default(10)
});

const SafeIdParamSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,64}$/)
});

function sanitizePayloadValues(obj) {
  for (const val of Object.values(obj)) {
    const check = Array.isArray(val) ? val.join(' ') : String(val || '');
    if (detectAttackPayload(check)) return false;
  }
  return true;
}

export async function registerPortfolioRoutes(app) {
  app.get('/healthz', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const dbInfo = getEngineInfo();
    return {
      status: 'ok',
      framework: 'fastify',
      tier: 'mahasiswa',
      app: 'Adam Zuhruf — Portfolio',
      database: dbInfo.engine,
      persistent: dbInfo.persistent,
      uptimeSec: Math.round(process.uptime())
    };
  });

  app.get('/api/health', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const dbInfo = getEngineInfo();
    return {
      status: 'ok',
      framework: 'fastify',
      tier: 'mahasiswa',
      database: dbInfo.engine,
      uptimeSec: Math.round(process.uptime())
    };
  });

  app.get('/api/security/status', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const dbInfo = getEngineInfo();
    return {
      framework: 'Fastify v5',
      helmet: 'active',
      csp: 'strict-self',
      rateLimit: 'sliding-window',
      validation: 'zod-v4',
      database: dbInfo,
      pqc: getPublicPqcStatus(),
      aiDefense: {
        promptInjectionFilter: 'active',
        burstFuzzerDetector: 'active',
        aiBlockedTotal: shieldMetrics.aiDefenseBlocks
      },
      adminAuth: isAdminConfigured() ? 'enabled-fail-closed' : 'locked-unconfigured',
      shield: {
        honeypotGuard: 'active',
        dotfileAndSourceBlock: 'active',
        blockedEvents: shieldMetrics.blockedTotal,
        quarantinesIssued: shieldMetrics.quarantinesIssued
      },
      uptimeSec: Math.round(process.uptime())
    };
  });

  app.get('/api/security/pqc-manifest', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const snap = await getPortfolioSnapshot();
    return signPortfolioIntegrityManifest(snap);
  });

  app.post('/api/security/pqc-verify', async (req, reply) => {
    const schema = z.object({
      sha3Digest: z.string().trim().regex(/^[0-9a-f]{64}$/i),
      signatureB64Url: z.string().trim().min(100)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ valid: false, error: 'Payload verifikasi PQC tidak valid' });
    }
    const valid = verifyManifestDigestSignature(parsed.data.sha3Digest, parsed.data.signatureB64Url);
    return { valid, algorithm: 'NIST FIPS 204 ML-DSA-65 + SHA3-256' };
  });

  async function buildEnrichedSnapshot(forceGitHub = false) {
    const [snap, gh] = await Promise.all([getPortfolioSnapshot(), getLiveGitHubSnapshot(forceGitHub)]);
    const live = getLiveState();
    const updatedStats = (snap.stats || []).map((st) =>
      String(st.label || '').includes('GitHub') ? { ...st, value: `${gh.publicRepos} Repo` } : st
    );
    return {
      ...snap,
      stats: updatedStats,
      github: {
        username: gh.username,
        publicRepos: gh.publicRepos,
        repos: gh.repos,
        fetchedAt: gh.fetchedAt,
        source: gh.source
      },
      revision: live.revision,
      bootId: live.bootId
    };
  }

  app.get('/api/portfolio', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return buildEnrichedSnapshot();
  });

  app.get('/api/github/live', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const force = req.query?.refresh === '1';
    return getLiveGitHubSnapshot(force);
  });

  app.get('/api/events/live', async (req, reply) => {
    attachSseClient(req, reply);
    return reply;
  });

  app.get(
    '/api/export/cv.docx',
    { config: { rateLimit: { max: 25, timeWindow: '1 minute' } } },
    async (_req, reply) => {
      const snap = await buildEnrichedSnapshot();
      const buf = await buildLiveCvDocxBuffer(snap);
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      reply.header('Content-Disposition', 'attachment; filename="CV_Adam_Zuhruf_Ananda_Farendra_Live.docx"');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'no-store');
      return reply.send(buf);
    }
  );

  app.get(
    '/api/export/portfolio.docx',
    { config: { rateLimit: { max: 25, timeWindow: '1 minute' } } },
    async (_req, reply) => {
      const snap = await buildEnrichedSnapshot();
      const buf = await buildLivePortfolioDocxBuffer(snap);
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      reply.header('Content-Disposition', 'attachment; filename="Portofolio_Adam_Zuhruf_Ananda_Farendra_Live.docx"');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'no-store');
      return reply.send(buf);
    }
  );

  app.get('/api/assets/:id', async (req, reply) => {
    const assetId = String(req.params?.id || '').trim();
    if (!/^ast-[0-9a-f]{24}$/.test(assetId)) {
      return reply.code(400).send({ error: 'ID aset tidak valid' });
    }
    const asset = await getUploadedAsset(assetId);
    if (!asset) {
      return reply.code(404).send({ error: 'Aset tidak ditemukan' });
    }
    const okSig = verifyAssetDigest(asset.sha3_digest, `${asset.id}|${asset.file_name}|${asset.mime_type}`, asset.pqc_sig);
    if (!okSig) {
      await recordSecurityAudit({
        eventType: 'ASSET_INTEGRITY_MISMATCH',
        path: `/api/assets/${assetId}`,
        severity: 'high',
        ipHash: hashIp(req.ip),
        detail: 'PQC ML-DSA-65 verification failed for stored asset'
      });
      return reply.code(403).send({ error: 'Integritas aset gagal verifikasi kriptografi' });
    }

    const buf = Buffer.from(asset.data_b64, 'base64');
    const isSafeInlineImage = /^image\/(png|jpeg|webp)$/.test(asset.mime_type);
    const forceDownload = req.query?.download === '1';
    const disposition = !forceDownload && (isSafeInlineImage || asset.mime_type === 'application/pdf') ? 'inline' : 'attachment';
    const cleanFilename = String(asset.file_name || 'berkas').replace(/["\\r\n]/g, '_');

    reply.header('Content-Type', asset.mime_type);
    reply.header('Content-Disposition', `${disposition}; filename="${cleanFilename}"`);
    reply.header('Content-Security-Policy', "sandbox; default-src 'none'");
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('X-Asset-Sha3-256', asset.sha3_digest);
    reply.header('Cache-Control', 'public, max-age=86400, immutable');
    return reply.send(buf);
  });

  app.post(
    '/api/contact/validate',
    {
      config: {
        rateLimit: {
          max: 12,
          timeWindow: '1 minute'
        }
      }
    },
    async (req, reply) => {
      const parsed = ContactDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Validasi formulir gagal',
          details: parsed.error.issues.map((i) => i.message)
        });
      }

      const { name, org, message } = parsed.data;
      const combined = `${name} ${org} ${message}`;
      if (detectAttackPayload(combined)) {
        return reply.code(400).send({
          ok: false,
          error: 'Input mengandung pola karakter atau tag yang diblokir sistem keamanan.'
        });
      }

      const safeName = stripUnsafeText(name);
      const safeOrg = stripUnsafeText(org);
      const safeMsg = stripUnsafeText(message);

      if (safeName.length < 2 || safeMsg.length < 8) {
        return reply.code(400).send({
          ok: false,
          error: 'Isian pesan setelah sanitasi terlalu pendek.'
        });
      }

      const inquiryId = `inq-${crypto.randomBytes(6).toString('hex')}`;
      await saveContactInquiry({
        id: inquiryId,
        senderName: safeName,
        organization: safeOrg,
        message: safeMsg,
        ipHash: hashIp(req.ip)
      });

      const subject = `Peluang Karir / Proyek dari ${safeName}${safeOrg ? ` (${safeOrg})` : ''}`;
      const bodyText = `Halo Adam Zuhruf,\n\nNama: ${safeName}\nPerusahaan/Instansi: ${safeOrg || '-'}\n\nPesan:\n${safeMsg}`;
      const mailtoUrl = `mailto:${config.publicContactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      reply.header('Cache-Control', 'no-store');
      return {
        ok: true,
        sanitized: true,
        savedToDb: true,
        inquiryId,
        mailtoUrl,
        recipient: config.publicContactEmail
      };
    }
  );

  // ===== Protected Owner Admin Endpoints (/api/admin/*) — Fail-Closed =====
  app.post(
    '/api/admin/login',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' }
      }
    },
    async (req, reply) => {
      const parsed = AdminLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'Masukkan API key admin terlebih dahulu.' });
      }
      return handleAdminLogin(req, reply);
    }
  );

  app.post('/api/admin/logout', handleAdminLogout);

  app.get('/api/admin/session', { preHandler: requireAdminAuth }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { ok: true, database: getEngineInfo(), shieldMetrics };
  });

  app.get('/api/admin/inquiries', { preHandler: requireAdminAuth }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { ok: true, items: await listContactInquiries(50) };
  });

  app.get('/api/admin/security-logs', { preHandler: requireAdminAuth }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { ok: true, items: await listSecurityAudits(50) };
  });

  app.post('/api/admin/projects', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = ProjectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Data proyek tidak valid', details: parsed.error.issues });
    }
    if (!sanitizePayloadValues(parsed.data)) {
      return reply.code(400).send({ ok: false, error: 'Pola karakter berbahaya terdeteksi.' });
    }
    await upsertProject(parsed.data);
    notifyPortfolioChanged('project-upsert');
    return { ok: true, id: parsed.data.id };
  });

  app.delete('/api/admin/projects/:id', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = SafeIdParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'ID tidak valid' });
    await deleteProject(parsed.data.id);
    notifyPortfolioChanged('project-delete');
    return { ok: true, deleted: parsed.data.id };
  });

  app.post('/api/admin/experiences', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = ExperienceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Data pengalaman tidak valid', details: parsed.error.issues });
    }
    if (!sanitizePayloadValues(parsed.data)) {
      return reply.code(400).send({ ok: false, error: 'Pola karakter berbahaya terdeteksi.' });
    }
    await upsertExperience(parsed.data);
    notifyPortfolioChanged('experience-upsert');
    return { ok: true, id: parsed.data.id };
  });

  app.delete('/api/admin/experiences/:id', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = SafeIdParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'ID tidak valid' });
    await deleteExperience(parsed.data.id);
    notifyPortfolioChanged('experience-delete');
    return { ok: true, deleted: parsed.data.id };
  });

  app.post('/api/admin/skills', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = SkillInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Data skill tidak valid', details: parsed.error.issues });
    }
    if (!sanitizePayloadValues(parsed.data)) {
      return reply.code(400).send({ ok: false, error: 'Pola karakter berbahaya terdeteksi.' });
    }
    await upsertSkill(parsed.data);
    notifyPortfolioChanged('skill-upsert');
    return { ok: true, id: parsed.data.id };
  });

  app.delete('/api/admin/skills/:id', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = SafeIdParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'ID tidak valid' });
    await deleteSkill(parsed.data.id);
    notifyPortfolioChanged('skill-delete');
    return { ok: true, deleted: parsed.data.id };
  });

  app.post('/api/admin/certificates', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = CertificateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Data sertifikat tidak valid', details: parsed.error.issues });
    }
    if (!sanitizePayloadValues(parsed.data)) {
      return reply.code(400).send({ ok: false, error: 'Pola karakter berbahaya terdeteksi.' });
    }
    await upsertCertificate(parsed.data);
    notifyPortfolioChanged('certificate-upsert');
    return { ok: true, id: parsed.data.id };
  });

  app.delete('/api/admin/certificates/:id', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = SafeIdParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'ID tidak valid' });
    await deleteCertificate(parsed.data.id);
    notifyPortfolioChanged('certificate-delete');
    return { ok: true, deleted: parsed.data.id };
  });

  app.post('/api/admin/cards', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = ShowcaseCardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Data kartu file/folder tidak valid', details: parsed.error.issues });
    }
    if (!sanitizePayloadValues(parsed.data)) {
      return reply.code(400).send({ ok: false, error: 'Pola karakter berbahaya terdeteksi.' });
    }
    await upsertShowcaseCard(parsed.data);
    notifyPortfolioChanged('card-upsert');
    return { ok: true, id: parsed.data.id };
  });

  app.delete('/api/admin/cards/:id', { preHandler: requireAdminAuth }, async (req, reply) => {
    const parsed = SafeIdParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'ID tidak valid' });
    await deleteShowcaseCard(parsed.data.id);
    notifyPortfolioChanged('card-delete');
    return { ok: true, deleted: parsed.data.id };
  });

  app.post(
    '/api/admin/assets/upload',
    {
      preHandler: requireAdminAuth,
      bodyLimit: 10 * 1024 * 1024,
      config: { rateLimit: { max: 45, timeWindow: '1 minute' } }
    },
    async (req, reply) => {
      const schema = z.object({
        fileName: z.string().trim().min(3).max(160),
        relativePath: z.string().trim().max(260).optional().default(''),
        ownerScope: z.enum(['project', 'certificate', 'folder-card']).optional().default('folder-card'),
        dataBase64: z.string().min(4)
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'Payload unggahan file tidak lengkap atau terlalu besar.' });
      }
      try {
        const verified = inspectAndSanitizeUpload(parsed.data);
        const pqcSig = signAssetDigest(verified.sha3Digest, `${verified.assetId}|${verified.safeName}|${verified.mimeType}`);
        await saveUploadedAsset({
          ...verified,
          fileName: verified.safeName,
          ownerScope: parsed.data.ownerScope,
          pqcSig
        });
        return {
          ok: true,
          asset: {
            assetId: verified.assetId,
            url: `./api/assets/${verified.assetId}`,
            fileName: verified.safeName,
            relativePath: verified.relativePath,
            mimeType: verified.mimeType,
            isImage: verified.isImage,
            byteSize: verified.byteSize,
            sha3Digest: verified.sha3Digest,
            pqcSealed: true
          }
        };
      } catch (err) {
        await recordSecurityAudit({
          eventType: 'UNSAFE_FILE_UPLOAD_BLOCKED',
          path: '/api/admin/assets/upload',
          severity: 'high',
          ipHash: hashIp(req.ip),
          detail: `${parsed.data.fileName}: ${err.message}`
        });
        return reply.code(400).send({ ok: false, error: err.message });
      }
    }
  );

  app.delete('/api/admin/assets/:id', { preHandler: requireAdminAuth }, async (req, reply) => {
    const assetId = String(req.params?.id || '').trim();
    if (!/^ast-[0-9a-f]{24}$/.test(assetId)) {
      return reply.code(400).send({ ok: false, error: 'ID aset tidak valid' });
    }
    await deleteUploadedAsset(assetId);
    return { ok: true, deleted: assetId };
  });
}
