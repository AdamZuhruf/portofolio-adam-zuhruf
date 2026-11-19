import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import { PROFILE } from '../data/portfolio-data.js';

const COLOR_NAVY = '0F172A';
const COLOR_BLUE = '0369A1';
const COLOR_SLATE = '475569';
const COLOR_LIGHT = 'F1F5F9';
const COLOR_BORDER = 'CBD5E1';

function cleanStr(val) {
  return String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function sectionHeader(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BLUE }
    },
    children: [
      new TextRun({
        text: cleanStr(title).toUpperCase(),
        bold: true,
        color: COLOR_NAVY,
        size: 24,
        font: 'Segoe UI'
      })
    ]
  });
}

function bulletItem(text, boldPrefix = '') {
  const runs = [];
  if (boldPrefix) {
    runs.push(new TextRun({ text: `${cleanStr(boldPrefix)} `, bold: true, color: COLOR_NAVY, size: 20, font: 'Segoe UI' }));
  }
  runs.push(new TextRun({ text: cleanStr(text), color: '1E293B', size: 20, font: 'Segoe UI' }));
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 30, after: 50 },
    children: runs
  });
}

function makeSimpleTable(headers, rows) {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER }
  };

  const colWidthPct = Math.floor(100 / Math.max(1, headers.length));
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map(
        (h) =>
          new TableCell({
            width: { size: colWidthPct, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_NAVY, color: 'auto' },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: cleanStr(h), bold: true, color: 'FFFFFF', size: 19, font: 'Segoe UI' })]
              })
            ]
          })
      )
    }),
    ...rows.map(
      (cells, rIdx) =>
        new TableRow({
          children: cells.map(
            (cellText) =>
              new TableCell({
                width: { size: colWidthPct, type: WidthType.PERCENTAGE },
                shading: rIdx % 2 === 1 ? { type: ShadingType.CLEAR, fill: COLOR_LIGHT, color: 'auto' } : undefined,
                children: [
                  new Paragraph({
                    spacing: { before: 50, after: 50 },
                    children: [new TextRun({ text: cleanStr(cellText), color: COLOR_NAVY, size: 19, font: 'Segoe UI' })]
                  })
                ]
              })
          )
        })
    )
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorder,
    rows: tableRows
  });
}

function buildHeaderBlock(snapshot, docSubtitle) {
  const nowStr = new Date().toISOString().slice(0, 10);
  return [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: cleanStr(snapshot.name || PROFILE.name),
          bold: true,
          size: 36,
          color: COLOR_NAVY,
          font: 'Segoe UI'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${PROFILE.headline}  |  ${docSubtitle}`,
          bold: true,
          size: 21,
          color: COLOR_BLUE,
          font: 'Segoe UI'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: `${PROFILE.location}  •  Email: ${PROFILE.email}  •  GitHub: github.com/AdamZuhruf  •  LinkedIn: linkedin.com/in/adamzuhruf  •  Portal: ${snapshot.publicUrl || 'https://portofolio-adam-zuhruf.up.railway.app'}  •  Disinkronkan: ${nowStr}`,
          size: 18,
          color: COLOR_SLATE,
          font: 'Segoe UI'
        })
      ]
    })
  ];
}

function buildSocialParagraphs(socials) {
  if (!Array.isArray(socials) || socials.length === 0) return [];
  return [
    sectionHeader('Kanal Publik & Media Sosial Resmi'),
    makeSimpleTable(
      ['Platform', 'Handle / Identitas', 'Tautan Resmi'],
      socials.map((s) => [s.platform, s.handle, s.url])
    )
  ];
}

function buildShowcaseParagraphs(showcaseCards) {
  if (!Array.isArray(showcaseCards) || showcaseCards.length === 0) return [];
  const items = [sectionHeader('Koleksi Berkas, Folder & Showcase Tambahan')];
  showcaseCards.forEach((card) => {
    const fileCount = (card.files || []).length;
    const extInfo = card.externalUrl ? ` | Tautan: ${card.externalUrl}` : '';
    items.push(
      bulletItem(
        `${card.summary} (${fileCount} berkas terlampir${extInfo})`,
        `[${card.badgeLabel}] ${card.title}:`
      )
    );
  });
  return items;
}

export async function buildLiveCvDocxBuffer(snapshot) {
  const children = [
    ...buildHeaderBlock(snapshot, 'Curriculum Vitae Resmi (Live-Synced)'),
    sectionHeader('Ringkasan Profesional'),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: PROFILE.subheadline,
          size: 20,
          color: '1E293B',
          font: 'Segoe UI'
        })
      ]
    }),
    sectionHeader('Pengalaman Kerja & Pendidikan'),
    ...(snapshot.timeline || []).map((t) => bulletItem(t.detail, `${t.period} — ${t.role}:`)),
    sectionHeader('Matriks Keahlian Teknis'),
    makeSimpleTable(
      ['Bidang', 'Kompetensi Utama', 'Tingkat', 'Bukti Terukur'],
      (snapshot.skills || []).map((s) => [s.category, s.name, s.level, s.evidence])
    ),
    sectionHeader('Proyek & Sistem Produksi Pilihan'),
    ...(snapshot.projects || []).map((p) =>
      bulletItem(`${p.summary} [Stack: ${(p.stack || []).join(', ')}]`, `${p.title} (${p.year}):`)
    ),
    sectionHeader('Sertifikasi & Pencapaian Resmi'),
    ...(snapshot.certificates || []).map((c) => bulletItem(`${c.issuer} (${c.date})`, `[${c.badge}] ${c.title} —`)),
    ...buildShowcaseParagraphs(snapshot.showcaseCards),
    ...buildSocialParagraphs(snapshot.socials)
  ];

  const doc = new Document({
    creator: PROFILE.name,
    title: `CV Live - ${PROFILE.name}`,
    description: 'Curriculum Vitae otomatis tersinkronisasi dari database portofolio live.',
    sections: [
      {
        properties: { page: { margin: { top: 850, bottom: 850, left: 900, right: 900 } } },
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}

export async function buildLivePortfolioDocxBuffer(snapshot) {
  const projectBlocks = [];
  (snapshot.projects || []).forEach((p, idx) => {
    projectBlocks.push(
      new Paragraph({
        spacing: { before: 160, after: 40 },
        children: [
          new TextRun({
            text: `${idx + 1}. ${cleanStr(p.title)} (${cleanStr(p.year)})`,
            bold: true,
            size: 22,
            color: COLOR_NAVY,
            font: 'Segoe UI'
          })
        ]
      }),
      new Paragraph({
        spacing: { after: 50 },
        children: [
          new TextRun({
            text: `${cleanStr(p.categoryLabel)}  •  ${cleanStr(p.subtitle)}`,
            bold: true,
            size: 19,
            color: COLOR_BLUE,
            font: 'Segoe UI'
          })
        ]
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: cleanStr(p.summary), size: 20, color: '1E293B', font: 'Segoe UI' })]
      })
    );
    (p.highlights || []).forEach((h) => projectBlocks.push(bulletItem(h)));
    projectBlocks.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `Teknologi: ${(p.stack || []).join(', ')}${p.repoUrl ? `  |  Tautan: ${p.repoUrl}` : ''}${
              (p.attachments || []).length ? `  |  Lampiran: ${(p.attachments || []).length} berkas` : ''
            }`,
            italics: true,
            size: 18,
            color: COLOR_SLATE,
            font: 'Segoe UI'
          })
        ]
      })
    );
  });

  const children = [
    ...buildHeaderBlock(snapshot, 'Dokumen Portofolio Lengkap (Live-Synced)'),
    sectionHeader('Profil & Indikator Capaian'),
    ...(snapshot.stats || []).map((st) => bulletItem(st.label, `${st.value} —`)),
    sectionHeader('Daftar Lengkap Proyek & Studi Kasus'),
    ...projectBlocks,
    ...buildShowcaseParagraphs(snapshot.showcaseCards),
    sectionHeader('Transkrip Kompetensi Celerates (900 Jam — Nilai A / 89.34)'),
    makeSimpleTable(
      ['Modul', 'Durasi', 'Nilai', 'Fokus Pembelajaran'],
      (snapshot.modules || []).map((m) => [m.name, `${m.hours} Jam`, Number(m.score).toFixed(2), m.notes])
    ),
    sectionHeader('Pengalaman Kerja & Matriks Keahlian'),
    ...(snapshot.timeline || []).map((t) => bulletItem(t.detail, `${t.period} — ${t.role}:`)),
    sectionHeader('Sertifikasi Resmi'),
    ...(snapshot.certificates || []).map((c) => bulletItem(`${c.issuer} (${c.date})`, `[${c.badge}] ${c.title} —`)),
    ...buildSocialParagraphs(snapshot.socials)
  ];

  const doc = new Document({
    creator: PROFILE.name,
    title: `Portofolio Live - ${PROFILE.name}`,
    description: 'Portofolio resmi otomatis tersinkronisasi dari database portofolio live.',
    sections: [
      {
        properties: { page: { margin: { top: 850, bottom: 850, left: 900, right: 900 } } },
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}
