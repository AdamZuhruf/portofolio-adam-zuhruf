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
import { PortfolioHero3D } from './hero-3d.js?v=4.0';

let activeProjects = PROJECTS;
let activeTimeline = TIMELINE;
let activeSkills = SKILLS;
let activeCerts = CERTIFICATES;
let activeSocials = SOCIAL_LINKS;
let activeModules = CELERATES_MODULES;
let activeShowcaseCards = [];

const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('primary-navigation');

const projectsGrid = document.getElementById('projects-grid');
const filterTabs = document.querySelectorAll('.filter-tab');
const searchInput = document.getElementById('project-search');
const timelineList = document.getElementById('timeline-list');
const moduleList = document.getElementById('module-list');
const skillsGrid = document.getElementById('skills-grid');
const certsGrid = document.getElementById('certs-grid');
const koleksiSection = document.getElementById('koleksi');
const foldersGrid = document.getElementById('folders-grid');
const socialGrid = document.getElementById('social-grid');
const socialCopyFeedback = document.getElementById('social-copy-feedback');

const projectModal = document.getElementById('project-modal');
const projectModalTitle = document.getElementById('project-modal-title');
const projectModalBody = document.getElementById('project-modal-body');
const certModal = document.getElementById('cert-modal');
const certModalTitle = document.getElementById('cert-modal-title');
const certModalImg = document.getElementById('cert-modal-img');
const certModalMeta = document.getElementById('cert-modal-meta');
const folderModal = document.getElementById('folder-modal');
const folderModalTitle = document.getElementById('folder-modal-title');
const folderModalBody = document.getElementById('folder-modal-body');

let activeCategory = 'all';
let searchTerm = '';

const hero3d = new PortfolioHero3D(
  document.getElementById('hero-3d-canvas'),
  document.getElementById('status-3d')
);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/* ===== 3D Preset & Camera Controls ===== */
const presetBtns = document.querySelectorAll('[data-3d-mode]');
const btn3dReset = document.getElementById('btn-3d-reset');
const btn3dPause = document.getElementById('btn-3d-pause');

presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    presetBtns.forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    hero3d.setMode(btn.getAttribute('data-3d-mode'));
  });
});

btn3dReset?.addEventListener('click', () => hero3d.resetView());
btn3dPause?.addEventListener('click', () => {
  const next = !hero3d.isPaused;
  hero3d.setPaused(next);
  btn3dPause.textContent = next ? 'Lanjutkan 3D' : 'Jeda 3D';
});

/* ===== Navigation Drawer ===== */
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('is-open', !expanded);
  });
}

/* ===== Render Stats ===== */
const statsEl = document.getElementById('hero-stats');
let activeStats = STATS;

function renderHeroStats(statsList = activeStats) {
  if (!statsEl) return;
  statsEl.textContent = '';
  statsList.forEach((s) => {
    const card = el('div', 'stat-pill');
    card.appendChild(el('div', 'stat-value', s.value));
    card.appendChild(el('div', 'stat-label', s.label));
    statsEl.appendChild(card);
  });
}
renderHeroStats(activeStats);

/* ===== Interactive Project Cards + 3D Tilt ===== */
function bindCardTilt(card) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

function renderProjects() {
  if (!projectsGrid) return;
  projectsGrid.textContent = '';

  const filtered = activeProjects.filter((p) => {
    const matchCat =
      activeCategory === 'all' ||
      (activeCategory === 'demo' ? p.category === 'demo' || p.category === 'other' : p.category === activeCategory);
    if (!matchCat) return false;
    if (!searchTerm) return true;
    const hay = `${p.title} ${p.subtitle} ${p.summary} ${(p.stack || []).join(' ')}`.toLowerCase();
    return hay.includes(searchTerm);
  });

  if (filtered.length === 0) {
    const empty = el('div', 'panel-box');
    empty.appendChild(el('h3', '', 'Tidak ada proyek yang cocok'));
    empty.appendChild(el('p', 'section-lead', 'Ubah kata kunci pencarian atau pilih tab "Semua Karya".'));
    projectsGrid.appendChild(empty);
    return;
  }

  filtered.forEach((proj) => {
    const card = el('article', 'project-card');

    const topRow = el('div', 'card-top-row');
    topRow.appendChild(el('span', 'cat-badge', proj.categoryLabel));
    topRow.appendChild(el('span', 'year-tag', proj.year));
    card.appendChild(topRow);

    if (proj.previewImage) {
      const img = el('img', 'card-thumb');
      img.src = proj.previewImage;
      img.alt = `Pratinjau ${proj.title}`;
      img.loading = 'lazy';
      card.appendChild(img);
    }

    card.appendChild(el('h3', '', proj.title));
    card.appendChild(el('p', 'project-sub', proj.subtitle));
    card.appendChild(el('p', 'project-summary', proj.summary));

    const stackWrap = el('div', 'stack-list');
    proj.stack.forEach((tech) => {
      stackWrap.appendChild(el('span', 'stack-pill', tech));
    });
    card.appendChild(stackWrap);

    const actions = el('div', 'card-actions');
    const detailBtn = el('button', 'btn btn-primary btn-sm', 'Buka Demo & Detail');
    detailBtn.type = 'button';
    detailBtn.addEventListener('click', () => openProjectModal(proj.id));
    actions.appendChild(detailBtn);

    if (proj.repoUrl) {
      const repoLink = el('a', 'btn btn-secondary btn-sm', proj.repoLabel || 'GitHub');
      repoLink.href = proj.repoUrl;
      repoLink.target = '_blank';
      repoLink.rel = 'noopener noreferrer';
      actions.appendChild(repoLink);
    }

    card.appendChild(actions);
    bindCardTilt(card);
    projectsGrid.appendChild(card);
  });
}

filterTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    filterTabs.forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    activeCategory = tab.getAttribute('data-cat') || 'all';
    renderProjects();
  });
});

searchInput?.addEventListener('input', (e) => {
  searchTerm = (e.target.value || '').trim().toLowerCase();
  renderProjects();
});

/* ===== Interactive Sandboxes Inside Project Modal ===== */
function renderBwmSawDemo(container) {
  const box = el('div', 'interactive-box');
  box.appendChild(el('h4', '', 'Simulator Interaktif Pembobotan BWM-SAW (10 Kriteria Disimulasikan dalam 4 Dimensi Utama)'));
  box.appendChild(el('p', 'section-lead', 'Geser bobot prioritas kriteria di bawah ini untuk melihat pemeringkatan otomatis calon penerima (SAW):'));

  const weights = { eco: 40, home: 30, dep: 20, vuln: 10 };
  const candidates = [
    { name: 'Keluarga A (Buruh Harian, 3 Tanggungan)', eco: 0.95, home: 0.85, dep: 0.9, vuln: 0.8 },
    { name: 'Keluarga B (Lansia Tunggal, Rumah Semi-Permanen)', eco: 0.8, home: 0.95, dep: 0.4, vuln: 1.0 },
    { name: 'Keluarga C (Pekerja Kontrak, 2 Anak)', eco: 0.65, home: 0.6, dep: 0.75, vuln: 0.35 },
    { name: 'Keluarga D (Usaha Mikro Mandiri)', eco: 0.4, home: 0.45, dep: 0.5, vuln: 0.2 }
  ];

  const simGrid = el('div', 'sim-grid');
  const table = el('table', 'sim-table');

  function updateTable() {
    const sum = weights.eco + weights.home + weights.dep + weights.vuln || 1;
    const scored = candidates
      .map((c) => {
        const s =
          (c.eco * weights.eco + c.home * weights.home + c.dep * weights.dep + c.vuln * weights.vuln) / sum;
        return { ...c, score: s };
      })
      .sort((a, b) => b.score - a.score);

    table.textContent = '';
    const thead = el('thead');
    const hr = el('tr');
    ['Peringkat', 'Sampel Rumah Tangga', 'Skor SAW (0–1)', 'Status'].forEach((h) => hr.appendChild(el('th', '', h)));
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    scored.forEach((row, idx) => {
      const tr = el('tr');
      tr.appendChild(el('td', '', `#${idx + 1}`));
      tr.appendChild(el('td', '', row.name));
      tr.appendChild(el('td', '', row.score.toFixed(3)));
      tr.appendChild(el('td', '', idx < 2 ? 'Prioritas Layak' : 'Cadangan'));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  [
    ['eco', 'Bobot Ekonomi / Penghasilan'],
    ['home', 'Bobot Kondisi Hunian'],
    ['dep', 'Bobot Jumlah Tanggungan'],
    ['vuln', 'Bobot Lansia / Rentan']
  ].forEach(([key, label]) => {
    const wrap = el('div', 'form-field');
    const lbl = el('label', '', `${label}: ${weights[key]}%`);
    const inp = el('input');
    inp.type = 'range';
    inp.min = '5';
    inp.max = '60';
    inp.value = String(weights[key]);
    inp.addEventListener('input', (e) => {
      weights[key] = Number(e.target.value);
      lbl.textContent = `${label}: ${weights[key]}%`;
      updateTable();
    });
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    simGrid.appendChild(wrap);
  });

  box.appendChild(simGrid);
  box.appendChild(table);
  updateTable();
  container.appendChild(box);
}

function renderVelparDemo(container) {
  const box = el('div', 'interactive-box');
  box.appendChild(el('h4', '', 'Simulator State Machine Safe-Pay Escrow & Audit RBAC (22 Vitest Cases)'));
  const statusP = el('p', 'project-sub', 'Status Transaksi Aktif: CREATED (Menunggu Pembayaran)');
  const logP = el('p', 'section-lead', 'Pilih aksi peran di bawah untuk menguji aturan transisi state:');
  let state = 'CREATED';

  const row = el('div', 'cta-group');
  const transitions = [
    { label: 'User: Bayar Pesanan', from: ['CREATED'], to: 'PAID', note: 'Tervalidasi Zod Schema & SQLite ACID.' },
    { label: 'Sistem: Kunci Escrow', from: ['PAID'], to: 'ESCROW_HOLD', note: 'Dana ditahan aman hingga item dikirim.' },
    { label: 'Admin: Verifikasi & Lepas Dana', from: ['ESCROW_HOLD'], to: 'RELEASED', note: 'RBAC Admin valid — order selesai.' },
    { label: 'Superadmin: Refund Darurat', from: ['PAID', 'ESCROW_HOLD'], to: 'REFUNDED', note: 'Audit log Superadmin terekam.' },
    { label: 'Reset Demo', from: ['CREATED', 'PAID', 'ESCROW_HOLD', 'RELEASED', 'REFUNDED'], to: 'CREATED', note: 'State kembali ke CREATED.' }
  ];

  transitions.forEach((tr) => {
    const b = el('button', 'btn btn-secondary btn-sm', tr.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      if (tr.from.includes(state)) {
        state = tr.to;
        statusP.textContent = `Status Transaksi Aktif: ${state}`;
        logP.textContent = `SUKSES: ${tr.note}`;
      } else {
        logP.textContent = `DITOLAK STATE MACHINE: Tidak bisa lompat dari "${state}" dengan aksi "${tr.label}".`;
      }
    });
    row.appendChild(b);
  });

  box.appendChild(statusP);
  box.appendChild(logP);
  box.appendChild(row);
  container.appendChild(box);
}

function renderPosDemo(container, gallery) {
  if (gallery && gallery.length) {
    renderGalleryViewer(container, gallery, 'Galeri Screenshot Nyata Sistem POS');
  }

  const box = el('div', 'interactive-box');
  box.appendChild(el('h4', '', 'Mini Simulator Kasir & Kalkulator HPP (Kasir Keluarga Endro PWA)'));
  const items = [
    { id: 'ayam', name: 'Nasi Ayam Crispy', hpp: 9500, price: 16000, qty: 2 },
    { id: 'hemat', name: 'Paket Hemat Keluarga', hpp: 28000, price: 45000, qty: 1 },
    { id: 'teh', name: 'Es Teh Jumbo', hpp: 1500, price: 5000, qty: 3 }
  ];

  const listWrap = el('div', 'sim-grid');
  const summary = el('p', 'project-sub', '');

  function recalc() {
    let omset = 0;
    let totalHpp = 0;
    items.forEach((it) => {
      omset += it.price * it.qty;
      totalHpp += it.hpp * it.qty;
    });
    const laba = omset - totalHpp;
    summary.textContent = `Total Omset: Rp${omset.toLocaleString('id-ID')}  |  Total HPP Modal: Rp${totalHpp.toLocaleString('id-ID')}  |  Laba Bersih: Rp${laba.toLocaleString('id-ID')}`;
  }

  items.forEach((it) => {
    const field = el('div', 'form-field');
    field.appendChild(el('label', '', `${it.name} (Jual Rp${it.price.toLocaleString('id-ID')} / HPP Rp${it.hpp.toLocaleString('id-ID')})`));
    const inp = el('input');
    inp.type = 'number';
    inp.min = '0';
    inp.max = '99';
    inp.value = String(it.qty);
    inp.addEventListener('input', (e) => {
      it.qty = Math.max(0, Number(e.target.value) || 0);
      recalc();
    });
    field.appendChild(inp);
    listWrap.appendChild(field);
  });

  recalc();
  box.appendChild(listWrap);
  box.appendChild(summary);
  container.appendChild(box);
}

function renderGalleryViewer(container, gallery, headingText) {
  const box = el('div', 'interactive-box');
  box.appendChild(el('h4', '', headingText));

  const stage = el('div', 'phone-stage');
  const bezel = el('div', 'phone-bezel');
  const img = el('img');
  img.src = gallery[0].src;
  img.alt = gallery[0].caption;
  bezel.appendChild(img);

  const info = el('div');
  const cap = el('p', 'project-sub', gallery[0].caption);
  const btnWrap = el('div', 'cta-group');
  gallery.forEach((g, idx) => {
    const b = el('button', idx === 0 ? 'chip-btn is-active' : 'chip-btn', `Layar ${idx + 1}`);
    b.type = 'button';
    b.addEventListener('click', () => {
      btnWrap.querySelectorAll('.chip-btn').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      img.src = g.src;
      img.alt = g.caption;
      cap.textContent = g.caption;
    });
    btnWrap.appendChild(b);
  });

  info.appendChild(cap);
  info.appendChild(el('p', 'section-lead', 'Pilih nomor layar di bawah untuk mengganti pratinjau langsung pada bingkai 3D:'));
  info.appendChild(btnWrap);

  stage.appendChild(bezel);
  stage.appendChild(info);
  box.appendChild(stage);
  container.appendChild(box);
}

function openProjectModal(projectId) {
  const proj = activeProjects.find((p) => p.id === projectId);
  if (!proj || !projectModal) return;

  projectModalTitle.textContent = proj.title;
  projectModalBody.textContent = '';

  projectModalBody.appendChild(el('p', 'project-sub', `${proj.categoryLabel}  •  ${proj.year}  •  ${proj.subtitle}`));
  projectModalBody.appendChild(el('p', '', proj.summary));

  const ul = el('ul');
  proj.highlights.forEach((h) => ul.appendChild(el('li', '', h)));
  projectModalBody.appendChild(ul);

  const stackWrap = el('div', 'stack-list');
  proj.stack.forEach((s) => stackWrap.appendChild(el('span', 'stack-pill', s)));
  projectModalBody.appendChild(stackWrap);

  if (proj.interactiveType === 'bwm-saw') {
    renderBwmSawDemo(projectModalBody);
  } else if (proj.interactiveType === 'velpar-state') {
    renderVelparDemo(projectModalBody);
  } else if (proj.interactiveType === 'pos-simulator') {
    renderPosDemo(projectModalBody, proj.gallery);
  } else if (proj.interactiveType === 'phone-switcher' && proj.gallery) {
    renderGalleryViewer(projectModalBody, proj.gallery, 'Interactive 3D Phone Mockup Explorer (Figma UI/UX)');
  }

  if (proj.attachments && proj.attachments.length > 0) {
    renderAttachmentList(projectModalBody, proj.attachments, 'Berkas & Folder Lampiran Proyek');
  }

  if (proj.repoUrl) {
    const ctaWrap = el('div', 'cta-group');
    const a = el('a', 'btn btn-primary btn-sm', proj.repoLabel || 'Buka Repositori');
    a.href = proj.repoUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    ctaWrap.appendChild(a);
    projectModalBody.appendChild(ctaWrap);
  }

  projectModal.classList.add('is-open');
  document.getElementById('close-project-modal')?.focus();
}

window.openProjectModal = openProjectModal;

document.querySelectorAll('[data-open-demo]').forEach((btn) => {
  btn.addEventListener('click', () => openProjectModal(btn.getAttribute('data-open-demo')));
});

document.getElementById('close-project-modal')?.addEventListener('click', () => {
  projectModal?.classList.remove('is-open');
});

/* ===== Render Timeline, Celerates 900 Jam, Skills, Certificates & Socials ===== */
function renderTimelineAndModules() {
  if (timelineList) {
    timelineList.textContent = '';
    activeTimeline.forEach((t) => {
      const card = el('article', 'timeline-item');
      card.appendChild(el('div', 'timeline-period', t.period));
      card.appendChild(el('h3', '', t.role));
      card.appendChild(el('p', '', t.detail));
      timelineList.appendChild(card);
    });
  }

  if (moduleList) {
    moduleList.textContent = '';
    activeModules.forEach((m) => {
      const row = el('div', 'module-row');
      const meta = el('div', 'module-meta');
      meta.appendChild(el('span', '', `${m.name} (${m.hours} Jam)`));
      meta.appendChild(el('span', 'module-score', `${m.score.toFixed(2)}`));
      const bar = el('progress', 'score-bar');
      bar.max = 100;
      bar.value = m.score;
      bar.setAttribute('aria-label', `${m.name} nilai ${m.score}`);
      row.appendChild(meta);
      row.appendChild(bar);
      row.appendChild(el('small', 'section-lead', m.notes));
      moduleList.appendChild(row);
    });
  }
}

function renderSkills() {
  if (!skillsGrid) return;
  skillsGrid.textContent = '';
  activeSkills.forEach((sk) => {
    const card = el('article', 'skill-card');
    const head = el('div', 'skill-card-head');
    head.appendChild(el('span', 'cat-badge', sk.category));
    head.appendChild(el('span', 'skill-level-badge', sk.level));
    card.appendChild(head);
    card.appendChild(el('h4', '', sk.name));
    card.appendChild(el('p', 'skill-evidence', `Bukti: ${sk.evidence}`));
    skillsGrid.appendChild(card);
  });
}

function formatByteSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function renderAttachmentList(container, files, headingText) {
  const box = el('div', 'interactive-box');
  box.appendChild(el('h4', '', `${headingText} (${files.length} berkas)`));
  const list = el('div', 'folder-files-list');
  files.forEach((f) => {
    const row = el('div', 'folder-file-row');
    const meta = el('div', 'folder-file-meta');
    meta.appendChild(el('strong', '', f.relativePath || f.fileName));
    meta.appendChild(el('small', 'section-lead', `${f.mimeType || 'berkas'} · ${formatByteSize(f.byteSize)}`));
    row.appendChild(meta);

    const actions = el('div', 'card-actions');
    const assetUrl = `./api/assets/${encodeURIComponent(f.assetId)}`;
    if (/^image\/(png|jpeg|webp)$/.test(f.mimeType) || f.mimeType === 'application/pdf') {
      const viewBtn = el('a', 'btn btn-secondary btn-sm', 'Lihat');
      viewBtn.href = assetUrl;
      viewBtn.target = '_blank';
      viewBtn.rel = 'noopener noreferrer';
      actions.appendChild(viewBtn);
    }
    const dlBtn = el('a', 'btn btn-primary btn-sm', 'Unduh');
    dlBtn.href = `${assetUrl}?download=1`;
    dlBtn.download = f.fileName || 'berkas';
    actions.appendChild(dlBtn);

    row.appendChild(actions);
    list.appendChild(row);
  });
  box.appendChild(list);
  container.appendChild(box);
}

function openFolderModal(card) {
  if (!folderModal || !folderModalBody || !folderModalTitle) return;
  folderModalTitle.textContent = card.title;
  folderModalBody.textContent = '';

  folderModalBody.appendChild(el('p', 'project-sub', card.badgeLabel));
  folderModalBody.appendChild(el('p', '', card.summary));

  if (card.coverUrl) {
    const img = el('img', 'cert-zoom-img');
    img.src = card.coverUrl;
    img.alt = card.title;
    folderModalBody.appendChild(img);
  }

  if (Array.isArray(card.files) && card.files.length > 0) {
    renderAttachmentList(folderModalBody, card.files, 'Isi Folder & Berkas Terverifikasi');
  }

  if (card.externalUrl) {
    const ctaWrap = el('div', 'cta-group');
    const ext = el('a', 'btn btn-primary btn-sm', card.externalLabel || 'Buka Tautan');
    ext.href = card.externalUrl;
    ext.target = '_blank';
    ext.rel = 'noopener noreferrer';
    ctaWrap.appendChild(ext);
    folderModalBody.appendChild(ctaWrap);
  }

  folderModal.classList.add('is-open');
  document.getElementById('close-folder-modal')?.focus();
}

function renderShowcaseCards() {
  if (!koleksiSection || !foldersGrid) return;
  if (!Array.isArray(activeShowcaseCards) || activeShowcaseCards.length === 0) {
    koleksiSection.classList.add('is-hidden');
    foldersGrid.textContent = '';
    return;
  }
  koleksiSection.classList.remove('is-hidden');
  foldersGrid.textContent = '';

  activeShowcaseCards.forEach((cardData) => {
    const card = el('article', 'project-card');
    const topRow = el('div', 'card-top-row');
    topRow.appendChild(el('span', 'cat-badge', cardData.badgeLabel));
    topRow.appendChild(el('span', 'year-tag', `${(cardData.files || []).length} File`));
    card.appendChild(topRow);

    if (cardData.coverUrl) {
      const img = el('img', 'card-thumb');
      img.src = cardData.coverUrl;
      img.alt = cardData.title;
      img.loading = 'lazy';
      card.appendChild(img);
    }

    card.appendChild(el('h3', '', cardData.title));
    card.appendChild(el('p', 'project-summary', cardData.summary));

    const actions = el('div', 'card-actions');
    const openBtn = el('button', 'btn btn-primary btn-sm', 'Buka Folder & Berkas');
    openBtn.type = 'button';
    openBtn.addEventListener('click', () => openFolderModal(cardData));
    actions.appendChild(openBtn);

    if (cardData.externalUrl) {
      const ext = el('a', 'btn btn-secondary btn-sm', cardData.externalLabel || 'Buka Tautan');
      ext.href = cardData.externalUrl;
      ext.target = '_blank';
      ext.rel = 'noopener noreferrer';
      actions.appendChild(ext);
    }

    card.appendChild(actions);
    bindCardTilt(card);
    foldersGrid.appendChild(card);
  });
}

document.getElementById('close-folder-modal')?.addEventListener('click', () => {
  folderModal?.classList.remove('is-open');
});

function renderCertificates() {
  if (!certsGrid) return;
  certsGrid.textContent = '';
  activeCerts.forEach((c) => {
    const card = el('article', 'cert-card');
    const img = el('img');
    img.src = c.image;
    img.alt = c.title;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.alt = `Berkas Sertifikat: ${c.title}`;
    });
    card.appendChild(img);

    const body = el('div', 'cert-body');
    body.appendChild(el('span', 'cat-badge', c.badge));
    body.appendChild(el('h3', '', c.title));
    body.appendChild(el('p', 'cert-issuer', `${c.issuer} • ${c.date}`));

    const btn = el('button', 'btn btn-secondary btn-sm', 'Perbesar Sertifikat');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (!certModal) return;
      certModalTitle.textContent = c.title;
      certModalImg.src = c.image;
      certModalImg.alt = c.title;
      certModalMeta.textContent = `${c.issuer} • ${c.date}`;
      certModal.classList.add('is-open');
      document.getElementById('close-cert-modal')?.focus();
    });
    body.appendChild(btn);
    card.appendChild(body);
    certsGrid.appendChild(card);
  });
}

document.getElementById('close-cert-modal')?.addEventListener('click', () => {
  certModal?.classList.remove('is-open');
});

function renderSocials() {
  if (!socialGrid) return;
  socialGrid.textContent = '';
  activeSocials.forEach((s) => {
    const card = el('article', 'social-card');

    const head = el('div', 'social-head');
    const codeBadge = el('span', 'social-code', s.code);
    codeBadge.setAttribute('aria-hidden', 'true');
    head.appendChild(codeBadge);

    const titleWrap = el('div');
    titleWrap.appendChild(el('h3', '', s.platform));
    titleWrap.appendChild(el('span', 'social-handle', s.handle));
    head.appendChild(titleWrap);
    card.appendChild(head);

    card.appendChild(el('p', 'social-desc', s.channelType));

    const actions = el('div', 'social-actions');
    const primaryLink = el('a', 'btn btn-primary btn-sm', s.ctaLabel);
    primaryLink.href = s.url;
    primaryLink.target = '_blank';
    primaryLink.rel = 'noopener noreferrer';
    actions.appendChild(primaryLink);

    if (s.secondaryUrl) {
      const secLink = el('a', 'btn btn-secondary btn-sm', s.secondaryLabel || 'Studio');
      secLink.href = s.secondaryUrl;
      secLink.target = '_blank';
      secLink.rel = 'noopener noreferrer';
      actions.appendChild(secLink);
    }

    if (s.copyHandle) {
      const copyBtn = el('button', 'btn btn-secondary btn-sm', `Salin @${s.copyHandle}`);
      copyBtn.type = 'button';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(s.copyHandle);
          if (socialCopyFeedback) {
            socialCopyFeedback.textContent = `Username Discord "${s.copyHandle}" (ID: ${PROFILE.discordUserId}) disalin ke clipboard.`;
          }
        } catch {
          if (socialCopyFeedback) {
            socialCopyFeedback.textContent = `Username Discord: ${s.copyHandle} (ID: ${PROFILE.discordUserId})`;
          }
        }
      });
      actions.appendChild(copyBtn);
    }

    card.appendChild(actions);
    bindCardTilt(card);
    socialGrid.appendChild(card);
  });
}

/* ===== Contact Form & Email Copy (With Server-Side Zod Validation When Hosted on Node/Railway) ===== */
const copyEmailBtn = document.getElementById('copy-email-btn');
const contactFeedback = document.getElementById('contact-feedback');
copyEmailBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(PROFILE.email);
    if (contactFeedback) contactFeedback.textContent = `Email ${PROFILE.email} berhasil disalin ke clipboard.`;
  } catch {
    if (contactFeedback) contactFeedback.textContent = `Silakan hubungi: ${PROFILE.email}`;
  }
});

const contactForm = document.getElementById('contact-form');
contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const sender = (document.getElementById('sender-name')?.value || '').trim();
  const org = (document.getElementById('sender-org')?.value || '').trim();
  const msg = (document.getElementById('sender-msg')?.value || '').trim();
  if (!sender || !msg) {
    if (contactFeedback) contactFeedback.textContent = 'Mohon isi nama dan isi pesan Anda terlebih dahulu.';
    return;
  }

  let targetMailto = null;
  if (hasBackendApi) {
    try {
      const resp = await fetch('./api/contact/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sender, org, message: msg })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.mailtoUrl) targetMailto = data.mailtoUrl;
      } else if (resp.status === 400 || resp.status === 429) {
        const errData = await resp.json().catch(() => ({}));
        if (contactFeedback) {
          contactFeedback.textContent = errData.error || 'Input ditolak oleh filter validasi keamanan.';
        }
        return;
      }
    } catch {
      // Fallback murni sisi-klien bila dibuka lewat hosting statis tanpa backend API
    }
  }

  if (!targetMailto) {
    const cleanSender = sender.replace(/[<>]/g, '');
    const cleanOrg = org.replace(/[<>]/g, '');
    const cleanMsg = msg.replace(/[<>]/g, '');
    const subject = encodeURIComponent(`Peluang Karir / Proyek dari ${cleanSender}${cleanOrg ? ` (${cleanOrg})` : ''}`);
    const body = encodeURIComponent(`Halo Adam Zuhruf,\n\nNama: ${cleanSender}\nPerusahaan/Instansi: ${cleanOrg || '-'}\n\nPesan:\n${cleanMsg}`);
    targetMailto = `mailto:${PROFILE.email}?subject=${subject}&body=${body}`;
  }

  window.location.href = targetMailto;
  if (contactFeedback) contactFeedback.textContent = 'Draft email tervalidasi aman dibuka ke adamzuhrufanandaf@gmail.com.';
});

const hasBackendApi =
  typeof window !== 'undefined' &&
  !window.location.hostname.endsWith('.github.io') &&
  window.location.protocol !== 'file:';

const githubLiveSection = document.getElementById('github-live-section');
const githubLiveGrid = document.getElementById('github-live-grid');
const githubLiveHeading = document.getElementById('github-live-heading');
const githubLiveSub = document.getElementById('github-live-sub');
const githubProfileBtn = document.getElementById('github-profile-btn');

let knownBootId = null;

function renderGitHubLive(gh) {
  if (!gh || typeof gh.publicRepos !== 'number') return;
  activeStats = activeStats.map((st) =>
    String(st.label || '').includes('GitHub') ? { ...st, value: `${gh.publicRepos} Repo` } : st
  );
  renderHeroStats(activeStats);

  if (githubProfileBtn) {
    githubProfileBtn.textContent = `GitHub (${gh.publicRepos} Repo)`;
  }
  if (githubLiveHeading) {
    githubLiveHeading.textContent = `Repositori GitHub Publik (${gh.publicRepos} Repo — Live Sync)`;
  }

  if (!githubLiveSection || !githubLiveGrid) return;
  const repos = Array.isArray(gh.repos) ? gh.repos : [];
  if (repos.length === 0) {
    githubLiveSection.classList.add('is-hidden');
    return;
  }
  githubLiveSection.classList.remove('is-hidden');
  if (githubLiveSub && gh.fetchedAt) {
    githubLiveSub.textContent = `Tersinkronisasi real-time dengan github.com/${gh.username || 'AdamZuhruf'} (${gh.publicRepos} repositori publik).`;
  }
  githubLiveGrid.textContent = '';
  repos.slice(0, 6).forEach((r) => {
    const card = el('article', 'skill-card github-repo-card');
    const head = el('div', 'skill-card-head');
    head.appendChild(el('span', 'cat-badge', r.language || 'Repo'));
    if (r.pushedAt) head.appendChild(el('span', 'year-tag', r.pushedAt));
    card.appendChild(head);
    card.appendChild(el('h4', '', r.name));
    card.appendChild(el('p', 'skill-evidence', r.description));
    const link = el('a', 'btn btn-secondary btn-sm', 'Buka di GitHub');
    link.href = r.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.appendChild(link);
    githubLiveGrid.appendChild(card);
  });
}

async function fetchStaticGitHubDirect() {
  try {
    const [uRes, rRes] = await Promise.all([
      fetch('https://api.github.com/users/AdamZuhruf'),
      fetch('https://api.github.com/users/AdamZuhruf/repos?sort=pushed&per_page=8&type=owner')
    ]);
    if (!uRes.ok) return;
    const u = await uRes.json();
    const rList = rRes.ok ? await rRes.json() : [];
    renderGitHubLive({
      username: 'AdamZuhruf',
      publicRepos: Number(u.public_repos ?? 18),
      fetchedAt: new Date().toISOString(),
      repos: Array.isArray(rList)
        ? rList.slice(0, 6).map((r) => ({
            name: r.name,
            url: r.html_url,
            description: r.description || 'Repositori proyek perangkat lunak.',
            language: r.language || 'Multi-Stack',
            pushedAt: r.pushed_at ? String(r.pushed_at).slice(0, 10) : ''
          }))
        : []
    });
  } catch {
    // Abaikan bila offline / terkena limit GitHub publik
  }
}

/* ===== Sync Dynamic Database Snapshot (PostgreSQL / SQLite / Showcase Folder Cards / GitHub) ===== */
async function syncFromDatabaseApi() {
  if (!hasBackendApi) {
    await fetchStaticGitHubDirect();
    return;
  }
  try {
    const res = await fetch('./api/portfolio', { cache: 'no-store' });
    if (!res.ok) return;
    const snap = await res.json();
    if (snap.bootId) {
      if (knownBootId && snap.bootId !== knownBootId) {
        window.location.reload();
        return;
      }
      knownBootId = snap.bootId;
    }
    if (Array.isArray(snap.stats) && snap.stats.length > 0) {
      activeStats = snap.stats;
      renderHeroStats(activeStats);
    }
    if (Array.isArray(snap.projects) && snap.projects.length > 0) activeProjects = snap.projects;
    if (Array.isArray(snap.timeline) && snap.timeline.length > 0) activeTimeline = snap.timeline;
    if (Array.isArray(snap.skills) && snap.skills.length > 0) activeSkills = snap.skills;
    if (Array.isArray(snap.certificates) && snap.certificates.length > 0) activeCerts = snap.certificates;
    if (Array.isArray(snap.socials) && snap.socials.length > 0) activeSocials = snap.socials;
    if (Array.isArray(snap.modules) && snap.modules.length > 0) activeModules = snap.modules;
    if (Array.isArray(snap.showcaseCards)) activeShowcaseCards = snap.showcaseCards;
    renderProjects();
    renderTimelineAndModules();
    renderSkills();
    renderCertificates();
    renderShowcaseCards();
    renderSocials();
    if (snap.github) renderGitHubLive(snap.github);
  } catch {
    // Tetap gunakan modul data statis bila dibuka di GitHub Pages / offline
  }
}

function connectRealTimeStream() {
  if (!hasBackendApi) {
    setInterval(fetchStaticGitHubDirect, 60000);
    return;
  }
  if (typeof EventSource !== 'undefined') {
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
        // Ignore parse error
      }
    });
    es.addEventListener('portfolio-update', () => {
      syncFromDatabaseApi();
    });
  }
  setInterval(syncFromDatabaseApi, 45000);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    projectModal?.classList.remove('is-open');
    certModal?.classList.remove('is-open');
    folderModal?.classList.remove('is-open');
    if (nav?.classList.contains('is-open')) {
      toggle?.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    }
  }
});

document.querySelectorAll('.live-docx-btn').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (!hasBackendApi) {
      e.preventDefault();
      const mode = link.getAttribute('data-live-docx') || 'cv';
      window.location.href = `./cv.html?mode=${encodeURIComponent(mode)}`;
    }
  });
});

/* Initial Boot */
renderProjects();
renderTimelineAndModules();
renderSkills();
renderCertificates();
renderShowcaseCards();
renderSocials();
syncFromDatabaseApi();
connectRealTimeStream();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
