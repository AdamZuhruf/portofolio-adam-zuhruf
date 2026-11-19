export const PROFILE = {
  name: 'Adam Zuhruf Ananda Farendra',
  shortName: 'Adam Zuhruf',
  brandTitle: 'Adam Zuhruf | Creative Technologist',
  headline: 'Full-Stack Web & Application Developer · UI/UX Designer',
  subheadline:
    'Lulusan D4 Manajemen Informatika UNESA (IPK 3.72 / 4.00 · 150 SKS) & Alumni MSIB Celerates 900 Jam (Nilai A / 89.34). Siap kerja penuh waktu maupun remote tanpa keterikatan jadwal kuliah.',
  location: 'Sidoarjo, Jawa Timur, Indonesia',
  email: 'adamzuhrufanandaf@gmail.com',
  githubUrl: 'https://github.com/AdamZuhruf',
  linkedinUrl: 'https://www.linkedin.com/in/adamzuhruf',
  youtubeUrl: 'https://www.youtube.com/@adamzuhruf_aad',
  discordHandle: 'adamzuhruf11',
  discordUserId: '1364204212623511574',
  whatsappBusinessUrl: 'https://wa.me/6282142703037',
  cvPageUrl: './cv.html',
  portfolioViewUrl: './cv.html?mode=portfolio',
  docxCvUrl: './api/export/cv.docx',
  docxPortfolioUrl: './api/export/portfolio.docx',
  portraits: {
    studio: './assets/portrait-studio.png',
    warm: './assets/portrait-warm.jpg'
  }
};

export const STATS = [
  { value: '3.72 / 4.00', label: 'IPK Resmi UNESA (150 SKS)' },
  { value: '900 Jam', label: 'Celerates MSIB (Nilai A · 89.34)' },
  { value: '18 Repo', label: 'GitHub Pribadi & Studi Kasus' },
  { value: '22 Tests', label: 'Unit Test Otomatis (Vitest)' }
];

export const PROJECTS = [
  {
    id: 'spk-bansos',
    category: 'fullstack',
    categoryLabel: 'Full-Stack & Sistem SPK',
    year: '2026',
    title: 'SPK Penerima Bansos Pemda Sidoarjo (BWM-SAW)',
    subtitle: 'Tugas Akhir D4 UNESA — Sistem Pendukung Keputusan BPNT & PKH',
    stack: ['TypeScript', 'Node.js', 'Express v5', 'MySQL', 'WebSocket', 'PWA', 'Python'],
    summary:
      'Sistem pendukung keputusan full-stack untuk pemeringkatan objektif calon penerima bantuan sosial BPNT & PKH berbasis metode Best Worst Method (BWM) dan Simple Additive Weighting (SAW) pada 10 kriteria prioritas.',
    highlights: [
      'Arsitektur TypeScript, Express v5, MySQL, PWA, dan WebSocket untuk pemrosesan data terstruktur dan pembaruan status real-time.',
      'Modul unggah berkas verifikasi lapangan tervalidasi serta ekspor laporan resmi ke format Word dan PDF siap cetak.',
      'Dilengkapi generator dataset uji DTSEN berbasis Python untuk pengujian skalabilitas 20–50 kriteria (Excel/CSV/JSON).'
    ],
    repoUrl: 'https://github.com/AdamZuhruf/proyek-bansos',
    repoLabel: 'Buka Repo GitHub',
    previewImage: null,
    interactiveType: 'bwm-saw'
  },
  {
    id: 'velpar-store',
    category: 'fullstack',
    categoryLabel: 'Full-Stack & Security',
    year: '2025 – 2026',
    title: 'Velpar Store — Enterprise Digital Top-Up',
    subtitle: 'Platform Transaksi Aman dengan RBAC 3-Peran & State Machine Escrow',
    stack: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind v4', 'Zod', 'SQLite ACID', 'Vitest'],
    summary:
      'Platform transaksi top-up digital berskala enterprise dengan arsitektur kontrol akses 3-peran (pengguna, admin, superadmin), validasi ketat Zod, transaksi ACID, dan verifikasi 22 unit test otomatis.',
    highlights: [
      'Payment state machine & Safe-Pay Escrow untuk mencegah race condition saldo dan transaksi ganda.',
      '22 skenario Vitest terverifikasi: 6 alur state pembayaran, 5 otorisasi RBAC, & 11 uji keamanan.',
      'Konfigurasi siap produksi menggunakan Docker dan Nginx reverse proxy.'
    ],
    repoUrl: null,
    repoLabel: 'Studi Kasus Teknis',
    previewImage: null,
    interactiveType: 'velpar-state'
  },
  {
    id: 'pos-kasir',
    category: 'pos',
    categoryLabel: 'POS & Bisnis UMKM',
    year: '2024 – 2026',
    title: 'Suite Point Of Sales: Web POS Admin & Kasir PWA Offline',
    subtitle: 'Web Control Panel PHP/MySQL + Aplikasi Kasir Keluarga Endro (5 Panel PWA)',
    stack: ['PHP', 'MySQL', 'JavaScript', 'HTML5', 'CSS3', 'PWA Service Worker'],
    summary:
      'Dua sistem kasir nyata: Dashboard Control Panel Admin/Kasir berbasis web untuk pelacakan omset, laba, preorder & piutang, serta aplikasi PWA offline Kasir Keluarga Endro dengan 5 panel terpadu dan kalkulator HPP.',
    highlights: [
      'Web POS Control Panel: pemisahan role Admin, Kasir & Pimpinan lengkap dengan grafik pendapatan harian/bulanan.',
      'Kasir Keluarga Endro PWA: 5 panel operasional (Kasir Tunai/QRIS, Stok & Menu, Kalkulator HPP Bahan Baku, Riwayat, Laporan Laba).',
      'Bisa dicoba langsung melalui Simulator Kasir & HPP Mini serta galeri screenshot asli di bawah.'
    ],
    repoUrl: 'https://github.com/AdamZuhruf',
    repoLabel: 'Lihat GitHub AdamZuhruf',
    previewImage: './assets/projects/pos-admin.jpg',
    gallery: [
      { src: './assets/projects/pos-admin.jpg', caption: 'Admin Control Panel — Rekap Penjualan, Laba & Preorder' },
      { src: './assets/projects/pos-kasir.jpg', caption: 'Role Kasir — Ringkasan Transaksi & Piutang' },
      { src: './assets/projects/pos-chart.jpg', caption: 'Grafik Penjualan Harian & Statistik Produk' }
    ],
    interactiveType: 'pos-simulator'
  },
  {
    id: 'uiux-mobile',
    category: 'uiux',
    categoryLabel: 'UI/UX Design (Figma)',
    year: '2024 – 2025',
    title: 'UI/UX Mobile Apps Suite (Figma 50+ Layar)',
    subtitle: 'Staycation Hotel Booking App & On-Demand Driver Logistics Routing',
    stack: ['Figma', 'Wireframing', 'User Flow', 'Interactive Prototype', 'Design System'],
    summary:
      'Lebih dari 50 layar desain mobile high-fidelity yang mencakup keseluruhan alur pengguna: dari onboarding, autentikasi, pemesanan kamar hotel dengan kode promo, hingga antarmuka driver pengantar barang multi-titik berbasis peta.',
    highlights: [
      'Staycation App: 5 layar onboarding, home berbasis lokasi Surabaya, pemilihan tipe kamar, promo, & konfirmasi bayar.',
      'Driver Map Routing App: toggle Online/Offline, jadwal perjalanan, pop-up order masuk ($18.06), rute A-B-C 78 km, foto bukti pick-up/drop-off.',
      'Klik tombol detail untuk menjelajah layar demi layar di Phone Mockup Interaktif.'
    ],
    repoUrl: null,
    repoLabel: 'Eksplor 50+ Layar',
    previewImage: './assets/uiux/staycation-home.jpg',
    gallery: [
      { src: './assets/uiux/staycation-home.jpg', caption: '1. Staycation — Beranda & Pencarian Hotel' },
      { src: './assets/uiux/staycation-rooms.jpg', caption: '2. Staycation — Pemilihan Tipe Kamar' },
      { src: './assets/uiux/staycation-payment.jpg', caption: '3. Staycation — Pembayaran Berhasil' },
      { src: './assets/uiux/driver-home.jpg', caption: '4. Driver App — Mode Online & My Schedule' },
      { src: './assets/uiux/driver-order.jpg', caption: '5. Driver App — Order Masuk Gubeng–Kenjeran' },
      { src: './assets/uiux/driver-route.jpg', caption: '6. Driver App — Optimasi Rute 3 Paket (78 km)' },
      { src: './assets/uiux/figma-overview.jpg', caption: '7. Peta Kanvas Lengkap 50+ Layar di Figma' }
    ],
    interactiveType: 'phone-switcher'
  },
  {
    id: 'karya-berdua',
    category: 'fullstack',
    categoryLabel: 'Web Platform & Bisnis',
    year: '2025 – Sekarang',
    title: 'Karya Berdua Official — Portal Layanan & Pricing Engine',
    subtitle: 'Co-Founder & Web Application Developer',
    stack: ['React 19', 'Vite', 'Tailwind CSS', 'Fastify', 'PostgreSQL', 'Redis', 'S3 SDK'],
    summary:
      'Platform layanan digital terintegrasi yang menggabungkan katalog paket terstruktur, kalkulator estimasi tarif dinamis, proteksi keamanan berlapis, dan pelacakan progres pekerjaan klien.',
    highlights: [
      'Arsitektur Fastify, PostgreSQL, Redis, dan S3 Request Presigner dengan validasi payload skema ketat (Zod).',
      'Antarmuka web responsif adaptif di Laptop, Tablet, dan Smartphone dengan standar aksesibilitas WCAG AA dan konsistensi desain sistem.',
      'Terintegrasi dengan tata kelola administrasi proyek profesional (SOP layanan, kalkulasi RAB/HPP Excel, dan naskah PKS/SPK).'
    ],
    repoUrl: null,
    repoLabel: 'Arsitektur Platform',
    previewImage: null,
    interactiveType: 'architecture'
  },
  {
    id: 'community-health',
    category: 'fullstack',
    categoryLabel: 'Web Sistem & Klinik',
    year: '2024 – 2026',
    title: 'Dual-Portal RT 25 + EMY DENTAL LAB + SANGAR Profile',
    subtitle: 'Integrasi Sync API Komunitas, Booking Klinik Gigi & Web Profil Paket Jasa',
    stack: ['Node.js', 'React 19', 'TypeScript', 'Vite', 'JSON Sync Bridge', 'Tailwind CSS'],
    summary:
      'Tiga aplikasi web terapan: integrasi Portal Griya Kartika RT 25 & Karang Taruna "Kartika Muda" via sync bridge, website antrean & kalender booking EMY DENTAL LAB, serta aplikasi SANGAR React+Vite dengan kalkulator paket dan sanitasi URL.',
    highlights: [
      'Griya Kartika RT 25 & Karang Taruna: sinkronisasi data lintas portal lewat shared-data.json untuk tata surat warga.',
      'EMY DENTAL LAB: sistem penjadwalan kalender, pemantauan status antrean, dan katalog harga layanan.',
      'SANGAR Web App (github.com/AdamZuhruf/sangar): kalkulator estimasi real-time dan proteksi Zero Credential Harvesting.'
    ],
    repoUrl: 'https://github.com/AdamZuhruf/sangar',
    repoLabel: 'Buka Repo SANGAR',
    previewImage: null,
    interactiveType: 'architecture'
  }
];

export const CELERATES_MODULES = [
  { code: 'FE', name: 'Introduction to Front-End Development', hours: 220, score: 88.60, notes: 'HTML, CSS, Bootstrap, & JavaScript' },
  { code: 'BE', name: 'Introduction to Back-End Development', hours: 200, score: 88.00, notes: 'Node.js, REST API, & Web Database' },
  { code: 'UX', name: 'Data Warehouse, ETL & UI/UX Design', hours: 200, score: 82.06, notes: 'Riset UX & Penerapan UI Design' },
  { code: 'CS', name: 'Basic Introduction to Cybersecurity', hours: 80, score: 100.00, notes: 'Firewall, Enkripsi, Phishing & Proteksi' },
  { code: 'CC', name: 'Basic Introduction to Cloud Computing', hours: 80, score: 100.00, notes: 'Konsep & Layanan Cloud Computing' },
  { code: 'PM', name: 'Project Management', hours: 120, score: 77.40, notes: 'Perencanaan Proyek Skala Kecil–Menengah' }
];

export const CERTIFICATES = [
  {
    id: 'cel-intern',
    title: 'Certificate of Internship — Web Development & UI/UX Design',
    issuer: 'PT Mitra Talenta Grup (Celerates) • CAMP Batch 2',
    date: 'Maret – Juni 2025',
    badge: 'Internship',
    image: './assets/certs/celerates-internship.jpg'
  },
  {
    id: 'cel-grad',
    title: 'Graduation Certificate — Nilai Akhir 89.34 (Predikat A / 900 Jam)',
    issuer: 'Celerates School • PT Mitra Talenta Grup',
    date: '1 Juli 2025',
    badge: 'Grade A (89.34)',
    image: './assets/certs/celerates-graduation.jpg'
  },
  {
    id: 'cel-msib',
    title: 'Completion Certificate — Studi Independen Batch 8 (Kampus Merdeka)',
    issuer: 'PT Mitra Talenta Grup • Data Processing & Digital Creative',
    date: '10 Feb – 30 Jun 2025',
    badge: 'MSIB Batch 8',
    image: './assets/certs/celerates-msib.jpg'
  },
  {
    id: 'cel-uat',
    title: 'Soft Skills Certificate — User Acceptance Testing (UAT)',
    issuer: 'Celerates Acceleration Mastery Program',
    date: '6 Mei 2025',
    badge: 'QA / UAT',
    image: './assets/certs/celerates-uat.jpg'
  },
  {
    id: 'ubmc-2023',
    title: 'Finalis 15 Besar — UNESA Business Model Canvas Competition',
    issuer: 'UKM Kewirausahaan Universitas Negeri Surabaya',
    date: '3 Juli 2023',
    badge: 'Finalis 15 Besar',
    image: './assets/certs/ubmc-2023.jpg'
  },
  {
    id: 'magang-media',
    title: 'Sertifikat Magang — Social Media Specialist (6 Bulan)',
    issuer: 'Unit Media DPD PDI Perjuangan Jawa Timur',
    date: '19 Sep 2024 – 14 Mar 2025',
    badge: '6 Bulan Magang',
    image: './assets/certs/magang-media.jpg'
  }
];

export const TIMELINE = [
  {
    period: '2025 – Sekarang',
    role: 'Co-Founder & Web Application Developer — Karya Berdua Official',
    detail: 'Membangun portal layanan digital (React, Vite, Fastify, PostgreSQL, Redis), kalkulator tarif otomatis, desain UI/UX Figma, serta sistem dokumen bisnis.'
  },
  {
    period: 'Februari – Juni 2025',
    role: 'Web Development & UI/UX Design Intern — PT Mitra Talenta Grup (Celerates)',
    detail: 'Program Studi Independen Batch 8 & CAMP Batch 2 (900 Jam, Nilai Akhir A / 89.34): Front-End, Back-End Node.js/REST API, UX Research, UAT, Cloud & Cybersecurity.'
  },
  {
    period: 'September 2024 – Maret 2025',
    role: 'Social Media Specialist Intern — Unit Media (Surabaya)',
    detail: 'Magang 6 bulan mengelola produksi konten harian, dokumentasi kegiatan, dan desain publikasi media digital.'
  },
  {
    period: '2022 – 2026',
    role: 'D4 Manajemen Informatika — Universitas Negeri Surabaya (UNESA)',
    detail: 'IPK 3.72 / 4.00 (150 SKS), menunggu yudisium & bebas jadwal kuliah. Tugas Akhir SPK Bansos Sidoarjo (BWM-SAW) serta aktif panitia HIMAFORTIC & BEM Vokasi.'
  },
  {
    period: '2019 – 2022',
    role: 'SMA Senopati Sedati — Jurusan IPA + Program Tambahan Perhotelan',
    detail: 'Pengurus OSIS, Tim Paskibra/Gerak Jalan, serta pelatihan Perhotelan (F&B Product, F&B Service, Bartender, Housekeeping).'
  }
];

export const SKILLS = [
  {
    id: 'skill-frontend',
    category: 'Frontend & Web App',
    name: 'TypeScript, React 19, Next.js 15, Vite, Tailwind CSS',
    level: 'Produksi',
    evidence: 'SPK BWM-SAW, Velpar Store, Portal Karya Berdua & Celerates Front-End (88.60)'
  },
  {
    id: 'skill-backend',
    category: 'Backend, API & Pengujian',
    name: 'Node.js, Fastify v5, Express v5, REST API, WebSocket, Zod, Vitest',
    level: 'Produksi',
    evidence: 'Nilai A Pemrograman API & Pengujian PL; 22 Unit Test Vitest + RBAC'
  },
  {
    id: 'skill-database',
    category: 'Basis Data & Data Engineering',
    name: 'PostgreSQL, MySQL, SQLite ACID, Redis, Python Dataset Generator',
    level: 'Produksi',
    evidence: 'SPK Bansos MySQL, Web POS PHP/MySQL, Celerates Back-End (88.00)'
  },
  {
    id: 'skill-uiux',
    category: 'UI/UX & Desain Sistem',
    name: 'Figma Wireframe, High-Fidelity Prototype, User Flow, WCAG AA/AAA',
    level: 'Terampil (50+ Layar)',
    evidence: 'Nilai A Desain UI/UX UNESA; Staycation Hotel & Driver Routing Apps'
  },
  {
    id: 'skill-security',
    category: 'Cloud, DevOps & Keamanan',
    name: 'Docker, Nginx, Git/GitHub, Helmet CSP, Anti-Injection Shield',
    level: 'Terampil & Terverifikasi',
    evidence: 'Celerates Cybersecurity (100.00) & Cloud Computing (100.00)'
  },
  {
    id: 'skill-office',
    category: 'Otomasi Bisnis & Dokumentasi',
    name: 'Excel Otomasi Rumus, Word/PDF Tata Naskah, UAT & Project Management',
    level: 'Sangat Terampil',
    evidence: 'Sertifikat UAT Celerates; Finalis 15 Besar UNESA BMC 2023'
  }
];

export const SOCIAL_LINKS = [
  {
    id: 'youtube',
    platform: 'YouTube',
    code: 'YT',
    handle: '@adamzuhruf_aad',
    channelType: 'Video Tech, Studi Kasus & Build Log',
    url: 'https://www.youtube.com/@adamzuhruf_aad',
    ctaLabel: 'Buka Channel YouTube'
  },
  {
    id: 'linkedin',
    platform: 'LinkedIn',
    code: 'IN',
    handle: 'in/adamzuhruf',
    channelType: 'Profil Karir & Kredensial Profesional',
    url: 'https://www.linkedin.com/in/adamzuhruf',
    ctaLabel: 'Kunjungi LinkedIn'
  },
  {
    id: 'x',
    platform: 'X (Twitter)',
    code: 'X',
    handle: '@rrsinoi',
    channelType: 'Build-in-Public & Tech Thread',
    url: 'https://x.com/rrsinoi',
    secondaryLabel: 'Studio @KaryaBerdua',
    secondaryUrl: 'https://x.com/KaryaBerdua',
    ctaLabel: 'Buka Profil X'
  },
  {
    id: 'threads',
    platform: 'Threads',
    code: 'TH',
    handle: '@adam_zaf99',
    channelType: 'Catatan Harian Builder & UI/UX',
    url: 'https://www.threads.com/@adam_zaf99',
    secondaryLabel: 'Studio @karya_berduaofficial',
    secondaryUrl: 'https://www.threads.com/@karya_berduaofficial',
    ctaLabel: 'Buka Threads'
  },
  {
    id: 'instagram',
    platform: 'Instagram',
    code: 'IG',
    handle: '@adam_zaf99',
    channelType: 'Showcase Visual, Carousel & Reels',
    url: 'https://www.instagram.com/adam_zaf99/',
    secondaryLabel: 'Studio @karya_berduaofficial',
    secondaryUrl: 'https://www.instagram.com/karya_berduaofficial/',
    ctaLabel: 'Buka Instagram'
  },
  {
    id: 'tiktok',
    platform: 'TikTok',
    code: 'TT',
    handle: '@zaren.az',
    channelType: 'Demo Cepat & Edukasi Solusi Digital',
    url: 'https://www.tiktok.com/@zaren.az',
    secondaryLabel: 'Studio @karyaberdua_',
    secondaryUrl: 'https://www.tiktok.com/@karyaberdua_',
    ctaLabel: 'Buka TikTok'
  },
  {
    id: 'telegram',
    platform: 'Telegram',
    code: 'TG',
    handle: 't.me/adamzuhruf_aad',
    channelType: 'Channel Arsip Tech & Prompt Teruji',
    url: 'https://t.me/adamzuhruf_aad',
    secondaryLabel: 'Channel @karyaberduaofficial',
    secondaryUrl: 'https://t.me/karyaberduaofficial',
    ctaLabel: 'Buka Channel Telegram'
  },
  {
    id: 'whatsapp',
    platform: 'WhatsApp',
    code: 'WA',
    handle: 'Bisnis: 0821-4270-3037',
    channelType: 'Konsultasi Resmi & Saluran Broadcast (Privasi Terjaga)',
    url: 'https://wa.me/6282142703037',
    secondaryLabel: 'Saluran WhatsApp Resmi',
    secondaryUrl: 'https://whatsapp.com/channel/0029VbEE22uGJP8AHYyRBO3z',
    ctaLabel: 'Chat WhatsApp Bisnis'
  },
  {
    id: 'discord',
    platform: 'Discord',
    code: 'DC',
    handle: '@adamzuhruf11',
    channelType: 'ID: 1364204212623511574 · Komunitas & Kolaborasi',
    url: 'https://discord.com/users/1364204212623511574',
    copyHandle: 'adamzuhruf11',
    ctaLabel: 'Buka Profil Discord'
  }
];
