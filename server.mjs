import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';

import { config } from './server/config.mjs';
import { closeDatabase, initDatabase } from './server/db.mjs';
import { startGitHubBackgroundSync, stopGitHubBackgroundSync } from './server/githubSync.mjs';
import { closeAllSseClients } from './server/liveSync.mjs';
import { initPqcEngine } from './server/pqcCrypto.mjs';
import { registerPortfolioRoutes } from './server/routes.mjs';
import { securityShieldPreHandler } from './server/securityShield.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp(options = {}) {
  initPqcEngine();
  await initDatabase({
    databaseUrl: options.databaseUrl,
    sqlitePathOverride: options.sqlitePathOverride
  });
  if (options.enableBackgroundSync ?? options.sqlitePathOverride !== ':memory:') {
    startGitHubBackgroundSync();
  }

  const enableLogger = options.logger ?? !config.isProd;
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 32 * 1024,
    routerOptions: { ignoreTrailingSlash: false },
    logger: enableLogger
      ? {
          level: 'warn',
          redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]']
        }
      : false
  });

  app.addHook('onClose', async () => {
    closeAllSseClients();
    stopGitHubBackgroundSync();
    await closeDatabase();
  });

  await app.register(compress, { global: true });

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null
      }
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    xPoweredBy: false
  });

  await app.register(cors, {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (config.allowedOrigins.has(origin) || /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
    credentials: true
  });

  await app.register(rateLimit, {
    global: true,
    max: options.rateLimitMax ?? config.rateLimitMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      error: 'Too Many Requests',
      retryAfterSec: Math.ceil(context.ttl / 1000)
    })
  });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    reply.header('X-Content-Type-Options', 'nosniff');
    if (String(req.raw.url || '').startsWith('/api/') || String(req.raw.url || '').startsWith('/admin')) {
      reply.header('X-Robots-Tag', 'noindex, nofollow');
    }
    return payload;
  });

  app.addHook('onRequest', securityShieldPreHandler);

  await registerPortfolioRoutes(app);

  app.get('/admin', async (_req, reply) => {
    return reply.sendFile('admin.html');
  });

  app.get('/cv', async (_req, reply) => {
    return reply.sendFile('cv.html');
  });

  await app.register(fastifyStatic, {
    root: __dirname,
    dotfiles: 'deny',
    index: ['index.html'],
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      const base = path.basename(filePath).toLowerCase();
      if (ext === '.html' || base === 'sw.js') {
        res.header('Cache-Control', 'public, max-age=0, must-revalidate');
      } else if (ext === '.js' || ext === '.css' || ext === '.webmanifest') {
        res.header('Cache-Control', 'public, max-age=300, must-revalidate');
      } else {
        res.header('Cache-Control', 'public, max-age=86400');
      }
    }
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: 'Not Found' });
  });

  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    const message = status < 500 ? err.message : 'Internal Server Error';
    reply.code(status).send({ error: message });
  });

  return app;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const app = await buildApp();
  let listenHost = config.host;
  try {
    await app.listen({ port: config.port, host: listenHost });
  } catch (err) {
    if (listenHost === '::') {
      listenHost = '0.0.0.0';
      await app.listen({ port: config.port, host: listenHost });
    } else {
      throw err;
    }
  }
  console.log(`[fastify-portfolio] listening on http://${listenHost}:${config.port}`);

  // Railway Public Networking failsafe: bridge alternate default port (3000 <-> 8080) when in production
  let aliasServer = null;
  if (config.isProd) {
    const altPort = config.port === 3000 ? 8080 : config.port === 8080 ? 3000 : null;
    if (altPort) {
      aliasServer = http.createServer((req, res) => app.server.emit('request', req, res));
      aliasServer.on('error', () => {});
      aliasServer.listen(altPort, listenHost, () => {
        console.log(`[fastify-portfolio] Railway failsafe listener ready on http://${listenHost}:${altPort}`);
      });
    }
  }

  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
      if (aliasServer) aliasServer.close();
      await app.close();
      process.exit(0);
    });
  }
}
