import crypto from 'node:crypto';

const serverBootId = crypto.randomBytes(6).toString('hex');
let portfolioRevision = 1;
let lastReason = 'boot';
const liveClients = new Set();

export function getLiveState() {
  return {
    bootId: serverBootId,
    revision: portfolioRevision,
    lastReason
  };
}

export function notifyPortfolioChanged(reason = 'cms-update') {
  portfolioRevision += 1;
  lastReason = String(reason || 'update');
  const payload = JSON.stringify({
    bootId: serverBootId,
    revision: portfolioRevision,
    reason: lastReason,
    at: new Date().toISOString()
  });
  for (const res of liveClients) {
    try {
      res.write(`event: portfolio-update\ndata: ${payload}\n\n`);
    } catch {
      liveClients.delete(res);
    }
  }
}

export function attachSseClient(req, reply) {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  liveClients.add(res);
  const hello = JSON.stringify({
    bootId: serverBootId,
    revision: portfolioRevision,
    reason: lastReason
  });
  res.write(`event: hello\ndata: ${hello}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      liveClients.delete(res);
    }
  }, 25000);
  heartbeat.unref?.();

  req.raw.on('close', () => {
    clearInterval(heartbeat);
    liveClients.delete(res);
  });
}

export function closeAllSseClients() {
  for (const res of liveClients) {
    try {
      res.end();
    } catch {
      // Ignore already closed streams
    }
  }
  liveClients.clear();
}
