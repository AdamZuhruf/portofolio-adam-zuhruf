const loginCard = document.getElementById('login-card');
const cmsWorkspace = document.getElementById('cms-workspace');
const logoutBtn = document.getElementById('logout-btn');
const dbBanner = document.getElementById('db-engine-banner');
const loginFeedback = document.getElementById('login-feedback');
const cmsFeedback = document.getElementById('cms-feedback');

let cardCoverUrl = '';
let cardQueuedFiles = [];
let projPreviewUrl = '';
let projQueuedFiles = [];
let latestSnapshot = null;

function clearAndAppend(parent, child) {
  parent.textContent = '';
  parent.appendChild(child);
}

function slugifyId(rawText, prefix = 'item') {
  const cleaned = String(rawText || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (cleaned.length >= 2) return cleaned;
  return `${prefix}-${Date.now().toString(36)}`;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function uploadSingleFileToVault(file, ownerScope) {
  if (file.size > 6 * 1024 * 1024) {
    throw new Error(`${file.name}: melebihi batas aman maksimal 6 MB per file.`);
  }
  const dataBase64 = await readFileAsBase64(file);
  const res = await fetch('./api/admin/assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      relativePath: file.webkitRelativePath || file.name,
      ownerScope,
      dataBase64
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Gagal mengunggah ${file.name}`);
  }
  return data.asset;
}

function renderQueuePills(containerEl, filesArr) {
  if (!containerEl) return;
  containerEl.textContent = '';
  filesArr.forEach((f, idx) => {
    const pill = document.createElement('span');
    pill.className = 'upload-pill';
    pill.textContent = `${f.relativePath || f.fileName} (${formatBytes(f.byteSize)}) `;
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.setAttribute('aria-label', `Hapus ${f.fileName}`);
    rmBtn.textContent = '×';
    rmBtn.addEventListener('click', () => {
      filesArr.splice(idx, 1);
      renderQueuePills(containerEl, filesArr);
    });
    pill.appendChild(rmBtn);
    containerEl.appendChild(pill);
  });
}

async function handleBatchUpload(fileList, targetQueue, queueEl, ownerScope) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  cmsFeedback.textContent = `Memeriksa & menyegel ${files.length} berkas (Magic-Bytes + SHA3-256 + ML-DSA-65)...`;
  let uploadedCount = 0;
  const errors = [];

  for (const file of files) {
    if (targetQueue.length >= 25) {
      errors.push('Batas maksimal 25 berkas per kartu tercapai.');
      break;
    }
    try {
      const asset = await uploadSingleFileToVault(file, ownerScope);
      targetQueue.push({
        assetId: asset.assetId,
        fileName: asset.fileName,
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        sha3Digest: asset.sha3Digest
      });
      uploadedCount += 1;
    } catch (err) {
      errors.push(err.message);
    }
  }

  renderQueuePills(queueEl, targetQueue);
  cmsFeedback.textContent =
    errors.length > 0
      ? `Terunggah ${uploadedCount} berkas. Ditolak/Peringatan: ${errors.join(' | ')}`
      : `${uploadedCount} berkas lolos inspeksi keamanan & disegel PQC ML-DSA-65.`;
}

function makeTable(headers, rows, { onEdit, onDelete } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'admin-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.cells.forEach((c) => {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    });
    if (onEdit || onDelete) {
      const td = document.createElement('td');
      const actionWrap = document.createElement('div');
      actionWrap.className = 'admin-actions-row';
      if (onEdit) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary btn-sm';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => onEdit(row.raw || row.id));
        actionWrap.appendChild(editBtn);
      }
      if (onDelete) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-secondary btn-sm';
        delBtn.textContent = 'Hapus';
        delBtn.addEventListener('click', () => onDelete(row.id));
        actionWrap.appendChild(delBtn);
      }
      td.appendChild(actionWrap);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

async function checkSecurityBanner() {
  try {
    const res = await fetch('./api/security/status');
    if (!res.ok) {
      dbBanner.textContent = 'Mode Statis: Jalankan via server Railway/Fastify + PostgreSQL untuk fitur upload & CMS.';
      return false;
    }
    const s = await res.json();
    const dbLabel = s.database?.engine ? s.database.engine.toUpperCase() : 'UNKNOWN';
    const persist = s.database?.persistent ? 'Persisten' : 'Sementara';
    const configured = s.adminAuth === 'enabled-fail-closed';
    const authState = configured ? 'Aktif (Fail-Closed + ML-DSA-65)' : 'Belum Set ADMIN_API_KEY di Railway Variables';
    dbBanner.textContent = `Database: ${dbLabel} (${persist}, ${s.database?.tablesCount || 9} tabel) · Autentikasi: ${authState}`;
    if (!configured) {
      loginFeedback.textContent = 'Mode Fail-Closed: Tambahkan ADMIN_API_KEY (min 24 karakter) di Railway Variables untuk membuka panel CMS.';
    }
    return configured;
  } catch {
    dbBanner.textContent = 'Backend API tidak terjangkau.';
    return false;
  }
}

async function loadCmsData() {
  const [portRes, inqRes, logRes] = await Promise.all([
    fetch('./api/portfolio'),
    fetch('./api/admin/inquiries'),
    fetch('./api/admin/security-logs')
  ]);

  if (portRes.ok) {
    const snap = await portRes.json();
    latestSnapshot = snap;
    const container = document.getElementById('cms-items-list');
    container.textContent = '';

    const cards = snap.showcaseCards || [];
    const cTitle = document.createElement('h3');
    cTitle.textContent = `Kartu File & Folder Tambahan (${cards.length})`;
    container.appendChild(cTitle);
    if (cards.length > 0) {
      container.appendChild(
        makeTable(
          ['ID', 'Jenis', 'Judul', 'Berkas', 'Aksi'],
          cards.map((c) => ({ id: c.id, raw: c, cells: [c.id, c.badgeLabel, c.title, `${(c.files || []).length} file`] })),
          {
            onEdit: (c) => {
              document.getElementById('c-id').value = c.id;
              document.getElementById('c-kind').value = c.cardKind || 'folder';
              document.getElementById('c-title').value = c.title;
              document.getElementById('c-summary').value = c.summary;
              document.getElementById('c-url').value = c.externalUrl || '';
              cardCoverUrl = c.coverUrl || '';
              cardQueuedFiles = [...(c.files || [])];
              document.getElementById('c-cover-status').textContent = cardCoverUrl ? `Sampul saat ini: ${cardCoverUrl}` : '';
              renderQueuePills(document.getElementById('c-upload-queue'), cardQueuedFiles, () =>
                renderQueuePills(document.getElementById('c-upload-queue'), cardQueuedFiles, () => {})
              );
              document.getElementById('c-title').focus();
            },
            onDelete: async (id) => {
              await fetch(`./api/admin/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
              loadCmsData();
            }
          }
        )
      );
    }

    const pTitle = document.createElement('h3');
    pTitle.textContent = `Proyek & Demo (${snap.projects.length})`;
    container.appendChild(pTitle);
    container.appendChild(
      makeTable(
        ['ID', 'Judul', 'Kategori', 'Lampiran', 'Aksi'],
        snap.projects.map((p) => ({
          id: p.id,
          raw: p,
          cells: [p.id, p.title, p.categoryLabel, `${(p.attachments || []).length} file`]
        })),
        {
          onEdit: (p) => {
            document.getElementById('p-id').value = p.id;
            document.getElementById('p-cat').value = ['fullstack', 'pos', 'uiux', 'demo', 'other'].includes(p.category) ? p.category : 'other';
            document.getElementById('p-year').value = p.year;
            document.getElementById('p-title').value = p.title;
            document.getElementById('p-subtitle').value = p.subtitle;
            document.getElementById('p-stack').value = (p.stack || []).join(', ');
            document.getElementById('p-summary').value = p.summary;
            document.getElementById('p-repo').value = p.repoUrl || '';
            projPreviewUrl = p.previewImage || '';
            projQueuedFiles = [...(p.attachments || [])];
            document.getElementById('p-image-status').textContent = projPreviewUrl ? `Thumbnail: ${projPreviewUrl}` : '';
            renderQueuePills(document.getElementById('p-upload-queue'), projQueuedFiles, () =>
              renderQueuePills(document.getElementById('p-upload-queue'), projQueuedFiles, () => {})
            );
            document.getElementById('p-title').focus();
          },
          onDelete: async (id) => {
            await fetch(`./api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
            loadCmsData();
          }
        }
      )
    );

    const certs = snap.certificates || [];
    const certTitle = document.createElement('h3');
    certTitle.textContent = `Sertifikat & Penghargaan (${certs.length})`;
    container.appendChild(certTitle);
    container.appendChild(
      makeTable(
        ['ID', 'Judul', 'Penerbit', 'Tanggal', 'Aksi'],
        certs.map((c) => ({ id: c.id, raw: c, cells: [c.id, c.title, c.issuer, c.date] })),
        {
          onEdit: (c) => {
            document.getElementById('cert-id').value = c.id;
            document.getElementById('cert-badge').value = c.badge;
            document.getElementById('cert-title').value = c.title;
            document.getElementById('cert-issuer').value = c.issuer;
            document.getElementById('cert-date').value = c.date;
            document.getElementById('cert-image-url').value = c.image;
            document.getElementById('cert-title').focus();
          },
          onDelete: async (id) => {
            await fetch(`./api/admin/certificates/${encodeURIComponent(id)}`, { method: 'DELETE' });
            loadCmsData();
          }
        }
      )
    );

    const eTitle = document.createElement('h3');
    eTitle.textContent = `Pengalaman Kerja & Pendidikan (${snap.timeline.length})`;
    container.appendChild(eTitle);
    container.appendChild(
      makeTable(
        ['ID', 'Periode', 'Peran', 'Aksi'],
        snap.timeline.map((t) => ({ id: t.id, raw: t, cells: [t.id, t.period, t.role] })),
        {
          onEdit: (t) => {
            document.getElementById('e-id').value = t.id;
            document.getElementById('e-period').value = t.period;
            document.getElementById('e-role').value = t.role;
            document.getElementById('e-detail').value = t.detail;
            document.getElementById('e-role').focus();
          },
          onDelete: async (id) => {
            await fetch(`./api/admin/experiences/${encodeURIComponent(id)}`, { method: 'DELETE' });
            loadCmsData();
          }
        }
      )
    );

    const sTitle = document.createElement('h3');
    sTitle.textContent = `Skill Terverifikasi (${snap.skills.length})`;
    container.appendChild(sTitle);
    container.appendChild(
      makeTable(
        ['ID', 'Kategori', 'Skill', 'Aksi'],
        snap.skills.map((sk) => ({ id: sk.id, raw: sk, cells: [sk.id, sk.category, sk.name] })),
        {
          onEdit: (sk) => {
            document.getElementById('s-id').value = sk.id;
            document.getElementById('s-cat').value = sk.category;
            document.getElementById('s-name').value = sk.name;
            document.getElementById('s-level').value = sk.level;
            document.getElementById('s-evidence').value = sk.evidence;
            document.getElementById('s-name').focus();
          },
          onDelete: async (id) => {
            await fetch(`./api/admin/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
            loadCmsData();
          }
        }
      )
    );
  }

  if (inqRes.ok) {
    const data = await inqRes.json();
    const inqBox = document.getElementById('inquiries-list');
    if (data.items.length === 0) {
      inqBox.textContent = 'Belum ada pesan tersimpan di database.';
    } else {
      clearAndAppend(
        inqBox,
        makeTable(
          ['Pengirim', 'Instansi', 'Pesan', 'Waktu'],
          data.items.map((i) => ({ id: i.id, cells: [i.sender_name, i.organization || '-', i.message, String(i.created_at).slice(0, 16)] }))
        )
      );
    }
  }

  if (logRes.ok) {
    const data = await logRes.json();
    const logBox = document.getElementById('audit-list');
    if (data.items.length === 0) {
      logBox.textContent = 'Belum ada aktivitas mencurigakan yang diblokir.';
    } else {
      clearAndAppend(
        logBox,
        makeTable(
          ['Event', 'Severity', 'Path', 'Detail'],
          data.items.map((l) => ({ id: l.id, cells: [l.event_type, l.severity, l.path, l.detail] }))
        )
      );
    }
  }
}

async function checkSession() {
  const res = await fetch('./api/admin/session');
  if (res.ok) {
    loginCard.classList.add('is-hidden');
    cmsWorkspace.classList.remove('is-hidden');
    logoutBtn.classList.remove('is-hidden');
    await loadCmsData();
  } else {
    loginCard.classList.remove('is-hidden');
    cmsWorkspace.classList.add('is-hidden');
    logoutBtn.classList.add('is-hidden');
  }
}

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const apiKey = document.getElementById('admin-key-input')?.value || '';
  const res = await fetch('./api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    loginFeedback.textContent = data.error || 'Gagal masuk.';
    return;
  }
  loginFeedback.textContent = '';
  document.getElementById('admin-key-input').value = '';
  await checkSession();
});

logoutBtn?.addEventListener('click', async () => {
  await fetch('./api/admin/logout', { method: 'POST' });
  await checkSession();
});

/* Upload Listeners for Universal Folder/File Card, Project, and Certificate */
document.getElementById('c-cover-file')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const asset = await uploadSingleFileToVault(f, 'folder-card');
    cardCoverUrl = asset.url;
    document.getElementById('c-cover-status').textContent = `Sampul siap: ${asset.fileName} (SHA3-256 Terverifikasi)`;
  } catch (err) {
    document.getElementById('c-cover-status').textContent = err.message;
  }
});

document.getElementById('c-files-input')?.addEventListener('change', (e) => {
  handleBatchUpload(e.target.files, cardQueuedFiles, document.getElementById('c-upload-queue'), 'folder-card');
});
document.getElementById('c-folder-input')?.addEventListener('change', (e) => {
  handleBatchUpload(e.target.files, cardQueuedFiles, document.getElementById('c-upload-queue'), 'folder-card');
});

document.getElementById('p-image-file')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const asset = await uploadSingleFileToVault(f, 'project');
    projPreviewUrl = asset.url;
    document.getElementById('p-image-status').textContent = `Thumbnail siap: ${asset.fileName}`;
  } catch (err) {
    document.getElementById('p-image-status').textContent = err.message;
  }
});

document.getElementById('p-attach-files')?.addEventListener('change', (e) => {
  handleBatchUpload(e.target.files, projQueuedFiles, document.getElementById('p-upload-queue'), 'project');
});
document.getElementById('p-attach-folder')?.addEventListener('change', (e) => {
  handleBatchUpload(e.target.files, projQueuedFiles, document.getElementById('p-upload-queue'), 'project');
});

document.getElementById('cert-file-input')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const st = document.getElementById('cert-file-status');
  try {
    const asset = await uploadSingleFileToVault(f, 'certificate');
    document.getElementById('cert-image-url').value = asset.url;
    st.textContent = `Berkas sertifikat siap & disegel: ${asset.fileName}`;
  } catch (err) {
    st.textContent = err.message;
  }
});

/* Form Submissions */
document.getElementById('card-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const kind = document.getElementById('c-kind').value;
  const kindLabels = {
    folder: 'Folder & Arsip',
    project: 'Proyek',
    demo: 'Demo Live',
    certificate: 'Sertifikat',
    document: 'Dokumen / CV',
    design: 'Desain UI/UX',
    other: 'Karya Lainnya'
  };
  const title = document.getElementById('c-title').value.trim();
  const payload = {
    id: document.getElementById('c-id').value.trim() || slugifyId(title, 'card'),
    cardKind: kind,
    badgeLabel: kindLabels[kind] || 'Folder Karya',
    title,
    summary: document.getElementById('c-summary').value.trim(),
    coverUrl: cardCoverUrl,
    externalUrl: document.getElementById('c-url').value.trim(),
    externalLabel: 'Buka Tautan',
    files: cardQueuedFiles,
    sortOrder: 1
  };
  const res = await fetch('./api/admin/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  cmsFeedback.textContent = res.ok ? `Kartu File/Folder "${payload.title}" aktif di portofolio!` : data.error || 'Gagal menyimpan kartu.';
  if (res.ok) {
    e.target.reset();
    cardCoverUrl = '';
    cardQueuedFiles = [];
    document.getElementById('c-cover-status').textContent = '';
    document.getElementById('c-upload-queue').textContent = '';
    await loadCmsData();
  }
});

document.getElementById('project-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cat = document.getElementById('p-cat').value;
  const catMap = {
    fullstack: 'Full-Stack & Sistem',
    pos: 'POS & Bisnis',
    uiux: 'UI/UX & Mobile',
    demo: 'Demo Interaktif',
    other: 'Karya Lainnya'
  };
  const title = document.getElementById('p-title').value.trim();
  const existing = latestSnapshot?.projects?.find((p) => p.id === document.getElementById('p-id').value.trim());
  const payload = {
    id: document.getElementById('p-id').value.trim() || slugifyId(title, 'proj'),
    category: cat,
    categoryLabel: catMap[cat] || 'Full-Stack & Sistem',
    year: document.getElementById('p-year').value.trim(),
    title,
    subtitle: document.getElementById('p-subtitle').value.trim(),
    summary: document.getElementById('p-summary').value.trim(),
    stack: document.getElementById('p-stack').value.split(',').map((s) => s.trim()).filter(Boolean),
    highlights: [document.getElementById('p-summary').value.trim()],
    repoUrl: document.getElementById('p-repo').value.trim(),
    repoLabel: cat === 'demo' ? 'Buka Demo Live' : 'Buka Tautan',
    previewImage: projPreviewUrl || existing?.previewImage || '',
    attachments: projQueuedFiles,
    interactiveType: existing?.interactiveType || 'case-study',
    sortOrder: 1
  };
  const res = await fetch('./api/admin/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  cmsFeedback.textContent = res.ok ? `Proyek "${payload.title}" tersimpan di database.` : data.error || 'Gagal menyimpan proyek.';
  if (res.ok) {
    e.target.reset();
    projPreviewUrl = '';
    projQueuedFiles = [];
    document.getElementById('p-image-status').textContent = '';
    document.getElementById('p-upload-queue').textContent = '';
    await loadCmsData();
  }
});

document.getElementById('cert-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('cert-title').value.trim();
  const payload = {
    id: document.getElementById('cert-id').value.trim() || slugifyId(title, 'cert'),
    badge: document.getElementById('cert-badge').value.trim(),
    title,
    issuer: document.getElementById('cert-issuer').value.trim(),
    date: document.getElementById('cert-date').value.trim(),
    image: document.getElementById('cert-image-url').value.trim(),
    sortOrder: 1
  };
  const res = await fetch('./api/admin/certificates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  cmsFeedback.textContent = res.ok ? `Sertifikat "${payload.title}" tersimpan di database.` : data.error || 'Gagal menyimpan sertifikat.';
  if (res.ok) {
    e.target.reset();
    document.getElementById('cert-file-status').textContent = '';
    await loadCmsData();
  }
});

document.getElementById('exp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = document.getElementById('e-role').value.trim();
  const payload = {
    id: document.getElementById('e-id').value.trim() || slugifyId(role, 'exp'),
    period: document.getElementById('e-period').value.trim(),
    role,
    detail: document.getElementById('e-detail').value.trim(),
    sortOrder: 1
  };
  const res = await fetch('./api/admin/experiences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  cmsFeedback.textContent = res.ok ? `Pengalaman "${payload.role}" tersimpan di database.` : data.error || 'Gagal menyimpan pengalaman.';
  if (res.ok) {
    e.target.reset();
    await loadCmsData();
  }
});

document.getElementById('skill-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('s-name').value.trim();
  const payload = {
    id: document.getElementById('s-id').value.trim() || slugifyId(name, 'skill'),
    category: document.getElementById('s-cat').value.trim(),
    name,
    level: document.getElementById('s-level').value.trim(),
    evidence: document.getElementById('s-evidence').value.trim(),
    sortOrder: 1
  };
  const res = await fetch('./api/admin/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  cmsFeedback.textContent = res.ok ? `Skill "${payload.name}" tersimpan di database.` : data.error || 'Gagal menyimpan skill.';
  if (res.ok) {
    e.target.reset();
    await loadCmsData();
  }
});

await checkSecurityBanner();
await checkSession();
