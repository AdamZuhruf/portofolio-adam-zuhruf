import {
  CELERATES_MODULES,
  CERTIFICATES,
  PROFILE,
  PROJECTS,
  SKILLS,
  SOCIAL_LINKS,
  STATS,
  TIMELINE
} from '../data/portfolio-data.js?v=4.0';

let snapshot = {
  name: PROFILE.name,
  location: PROFILE.location,
  publicUrl: 'https://portofolio-adam-zuhruf.up.railway.app',
  stats: STATS,
  projects: PROJECTS,
  timeline: TIMELINE,
  skills: SKILLS,
  certificates: CERTIFICATES,
  socials: SOCIAL_LINKS,
  showcaseCards: [],
  modules: CELERATES_MODULES
};

const params = new URLSearchParams(window.location.search);
let currentMode = params.get('mode') === 'portfolio' ? 'portfolio' : 'cv';

const btnModeCv = document.getElementById('btn-mode-cv');
const btnModePortfolio = document.getElementById('btn-mode-portfolio');
const btnDlDocx = document.getElementById('btn-dl-docx');
const btnPrintPdf = document.getElementById('btn-print-pdf');

const hasBackendApi =
  typeof window !== 'undefined' &&
  !window.location.hostname.endsWith('.github.io') &&
  window.location.protocol !== 'file:';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

function updateModeControls() {
  if (currentMode === 'portfolio') {
    btnModePortfolio?.classList.add('btn-primary');
    btnModePortfolio?.classList.remove('btn-secondary');
    btnModeCv?.classList.add('btn-secondary');
    btnModeCv?.classList.remove('btn-primary');
    if (btnDlDocx) {
      btnDlDocx.href = './api/export/portfolio.docx';
      btnDlDocx.textContent = 'Unduh Portofolio Word (.docx)';
    }
  } else {
    btnModeCv?.classList.add('btn-primary');
    btnModeCv?.classList.remove('btn-secondary');
    btnModePortfolio?.classList.add('btn-secondary');
    btnModePortfolio?.classList.remove('btn-primary');
    if (btnDlDocx) {
      btnDlDocx.href = './api/export/cv.docx';
      btnDlDocx.textContent = 'Unduh CV Word (.docx)';
    }
  }
}

function renderDocument() {
  document.getElementById('cv-name').textContent = snapshot.name || PROFILE.name;
  document.getElementById('cv-headline').textContent =
    currentMode === 'portfolio'
      ? `${PROFILE.headline} · Dokumen Portofolio Resmi`
      : `${PROFILE.headline} · Curriculum Vitae`;
  document.getElementById('cv-meta').textContent =
    `${PROFILE.location} · ${PROFILE.email} · GitHub: github.com/AdamZuhruf · LinkedIn: linkedin.com/in/adamzuhruf`;
  document.getElementById('cv-summary').textContent = PROFILE.subheadline;

  const tlBox = document.getElementById('cv-timeline');
  tlBox.textContent = '';
  (snapshot.timeline || []).forEach((t) => {
    const item = el('div', 'cv-entry');
    item.appendChild(el('strong', '', `${t.period} — ${t.role}`));
    item.appendChild(el('p', '', t.detail));
    tlBox.appendChild(item);
  });

  const skBox = document.getElementById('cv-skills');
  skBox.textContent = '';
  (snapshot.skills || []).forEach((s) => {
    const item = el('div', 'cv-entry');
    item.appendChild(el('strong', '', `${s.category} (${s.level}): ${s.name}`));
    item.appendChild(el('p', '', `Bukti: ${s.evidence}`));
    skBox.appendChild(item);
  });

  const prBox = document.getElementById('cv-projects');
  prBox.textContent = '';
  (snapshot.projects || []).forEach((p, idx) => {
    const item = el('div', 'cv-entry');
    item.appendChild(el('strong', '', `${idx + 1}. ${p.title} (${p.year}) — ${p.categoryLabel}`));
    item.appendChild(el('p', '', `${p.summary} [Stack: ${(p.stack || []).join(', ')}]`));
    if (currentMode === 'portfolio' && Array.isArray(p.highlights) && p.highlights.length > 0) {
      const ul = document.createElement('ul');
      p.highlights.forEach((h) => ul.appendChild(el('li', '', h)));
      item.appendChild(ul);
    }
    prBox.appendChild(item);
  });

  const scWrap = document.getElementById('cv-showcase-wrap');
  const scBox = document.getElementById('cv-showcase');
  scBox.textContent = '';
  const cards = snapshot.showcaseCards || [];
  if (cards.length > 0) {
    scWrap?.classList.remove('is-hidden');
    cards.forEach((c) => {
      const item = el('div', 'cv-entry');
      const filesCount = (c.files || []).length;
      item.appendChild(el('strong', '', `[${c.badgeLabel}] ${c.title} (${filesCount} berkas)`));
      item.appendChild(el('p', '', c.summary));
      scBox.appendChild(item);
    });
  } else {
    scWrap?.classList.add('is-hidden');
  }

  const certBox = document.getElementById('cv-certs');
  certBox.textContent = '';
  (snapshot.certificates || []).forEach((c) => {
    const item = el('div', 'cv-entry');
    item.appendChild(el('strong', '', `[${c.badge}] ${c.title}`));
    item.appendChild(el('p', '', `${c.issuer} · ${c.date}`));
    certBox.appendChild(item);
  });

  const socBox = document.getElementById('cv-socials');
  socBox.textContent = '';
  const grid = el('div', 'cv-social-list');
  (snapshot.socials || []).forEach((s) => {
    grid.appendChild(el('div', '', `${s.platform}: ${s.handle} (${s.url})`));
  });
  socBox.appendChild(grid);

  const srcText = isOwnerCvSession
    ? `Mode Pemilik · Tersinkronisasi dari database (${(snapshot.engine || 'DB').toUpperCase()})`
    : 'Pratinjau Online (Hanya Lihat — Unduhan & pencetakan dinonaktifkan untuk pengunjung)';
  document.getElementById('cv-sync-stamp').textContent = `${srcText} · Diperbarui: ${new Date().toLocaleDateString('id-ID')}`;
}

let isOwnerCvSession = false;

async function syncCvOwnerRole() {
  if (!hasBackendApi) {
    isOwnerCvSession = false;
    document.body.classList.remove('owner-print-allowed');
    btnPrintPdf?.classList.add('is-hidden');
    btnDlDocx?.classList.add('is-hidden');
    return;
  }
  try {
    const res = await fetch('./api/auth/role', { cache: 'no-store' });
    const data = res.ok ? await res.json() : {};
    isOwnerCvSession = Boolean(data?.authenticated && data?.role === 'owner');
  } catch {
    isOwnerCvSession = false;
  }
  if (isOwnerCvSession) {
    document.body.classList.add('owner-print-allowed');
    btnPrintPdf?.classList.remove('is-hidden');
    btnDlDocx?.classList.remove('is-hidden');
  } else {
    document.body.classList.remove('owner-print-allowed');
    btnPrintPdf?.classList.add('is-hidden');
    btnDlDocx?.classList.add('is-hidden');
  }
}

document.addEventListener('keydown', (e) => {
  if (!isOwnerCvSession && (e.ctrlKey || e.metaKey) && ['p', 's'].includes(String(e.key || '').toLowerCase())) {
    e.preventDefault();
  }
});

document.getElementById('cv-sheet')?.addEventListener('contextmenu', (e) => {
  if (!isOwnerCvSession) e.preventDefault();
});

btnModeCv?.addEventListener('click', () => {
  currentMode = 'cv';
  updateModeControls();
  renderDocument();
});

btnModePortfolio?.addEventListener('click', () => {
  currentMode = 'portfolio';
  updateModeControls();
  renderDocument();
});

btnPrintPdf?.addEventListener('click', () => {
  if (isOwnerCvSession) window.print();
});

btnDlDocx?.addEventListener('click', (e) => {
  if (!isOwnerCvSession || !hasBackendApi) {
    e.preventDefault();
  }
});

let knownBootId = null;

async function loadLiveSnapshot() {
  if (hasBackendApi) {
    try {
      const res = await fetch('./api/portfolio', { cache: 'no-store' });
      if (res.ok) {
        const snap = await res.json();
        if (snap.bootId) {
          if (knownBootId && snap.bootId !== knownBootId) {
            window.location.reload();
            return;
          }
          knownBootId = snap.bootId;
        }
        snapshot = { ...snapshot, ...snap };
      }
    } catch {
      // Gunakan fallback modul lokal bila offline
    }
  }
  updateModeControls();
  renderDocument();
}

await syncCvOwnerRole();
await loadLiveSnapshot();

if (hasBackendApi && typeof EventSource !== 'undefined') {
  const es = new EventSource('./api/events/live');
  es.addEventListener('hello', (evt) => {
    try {
      const info = JSON.parse(evt.data);
      if (knownBootId && info.bootId && info.bootId !== knownBootId) {
        window.location.reload();
        return;
      }
      if (info.bootId) knownBootId = info.bootId;
    } catch {
      // Ignore
    }
  });
  es.addEventListener('portfolio-update', () => {
    loadLiveSnapshot();
  });
}
