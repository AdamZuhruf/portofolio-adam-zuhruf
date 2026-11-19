import { config } from './config.mjs';
import { notifyPortfolioChanged } from './liveSync.mjs';

const GITHUB_CACHE_TTL_MS = 60 * 1000;
const FALLBACK_REPO_COUNT = 18;

let cachedSnapshot = {
  username: 'AdamZuhruf',
  publicRepos: FALLBACK_REPO_COUNT,
  repos: [],
  fetchedAt: null,
  source: 'default',
  lastCheckMs: 0
};

let bgTimer = null;
let overrideFetcherForTest = null;

export function setGitHubFetcherForTest(fn) {
  overrideFetcherForTest = fn;
  cachedSnapshot = {
    username: config.githubUsername || 'AdamZuhruf',
    publicRepos: FALLBACK_REPO_COUNT,
    repos: [],
    fetchedAt: null,
    source: 'default',
    lastCheckMs: 0
  };
}

function buildGitHubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'portofolio-adam-zuhruf-sync/1.0'
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }
  return headers;
}

async function fetchFromGitHubApi(username) {
  if (overrideFetcherForTest) {
    return overrideFetcherForTest(username);
  }
  const headers = buildGitHubHeaders();
  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(4500)
    }),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=12&type=owner`, {
      headers,
      signal: AbortSignal.timeout(4500)
    })
  ]);

  if (!userRes.ok) {
    throw new Error(`GitHub user API returned ${userRes.status}`);
  }
  const userJson = await userRes.json();
  const reposJson = reposRes.ok ? await reposRes.json() : [];

  const repos = Array.isArray(reposJson)
    ? reposJson
        .filter((r) => r && !r.private)
        .slice(0, 12)
        .map((r) => ({
          id: r.id,
          name: String(r.name || ''),
          url: String(r.html_url || ''),
          description: String(r.description || 'Repositori proyek perangkat lunak & eksplorasi teknis.'),
          language: r.language ? String(r.language) : 'Multi-Stack',
          stars: Number(r.stargazers_count || 0),
          pushedAt: r.pushed_at ? String(r.pushed_at).slice(0, 10) : ''
        }))
    : [];

  return {
    username,
    publicRepos: Number.isFinite(Number(userJson.public_repos)) ? Number(userJson.public_repos) : FALLBACK_REPO_COUNT,
    repos
  };
}

export async function getLiveGitHubSnapshot(forceRefresh = false) {
  const username = config.githubUsername || 'AdamZuhruf';
  const now = Date.now();
  if (!forceRefresh && cachedSnapshot.lastCheckMs > 0 && now - cachedSnapshot.lastCheckMs < GITHUB_CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  try {
    const fresh = await fetchFromGitHubApi(username);
    const prevCount = cachedSnapshot.publicRepos;
    const prevHead = cachedSnapshot.repos.map((r) => `${r.name}:${r.pushedAt}`).join('|');
    const nextHead = (fresh.repos || []).map((r) => `${r.name}:${r.pushedAt}`).join('|');

    cachedSnapshot = {
      username,
      publicRepos: fresh.publicRepos,
      repos: fresh.repos || [],
      fetchedAt: new Date(now).toISOString(),
      source: 'github-api',
      lastCheckMs: now
    };

    if (prevCount !== cachedSnapshot.publicRepos || (prevHead && prevHead !== nextHead)) {
      notifyPortfolioChanged('github-sync');
    }
  } catch {
    cachedSnapshot.lastCheckMs = now;
  }

  return cachedSnapshot;
}

export function startGitHubBackgroundSync() {
  if (bgTimer) return;
  getLiveGitHubSnapshot(true).catch(() => {});
  bgTimer = setInterval(() => {
    getLiveGitHubSnapshot(true).catch(() => {});
  }, GITHUB_CACHE_TTL_MS);
  bgTimer.unref?.();
}

export function stopGitHubBackgroundSync() {
  if (bgTimer) {
    clearInterval(bgTimer);
    bgTimer = null;
  }
}
