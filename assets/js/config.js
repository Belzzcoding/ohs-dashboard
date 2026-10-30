/* ---------- 1. Link eksternal OHS ----------
  Kosongkan ("") bila belum ada. Kartu / menu dengan link kosong atau tidak valid otomatis dinonaktifkan (tidak ada link rusak).
  Hanya URL berawalan https:// yang diterima.*/
const ohsLinks = {
  sertif:
    "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FSLO%2520SIO%2FSertifikasi%2520Personil%3Fd%3Dw2156c67a92144cf691992b21addaee3e%26csf%3D1%26web%3D1%26e%3DODS4LJ&sa=D&sntz=1&usg=AOvVaw1e831kGVsiWIxFYhfJcAZz",
  p2k3: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FP2K3%2FRapat%2520P2K3%3Fd%3Dw370800a11c7943cdb2a41864439c4e7e%26csf%3D1%26web%3D1%26e%3D3WRWDh&sa=D&sntz=1&usg=AOvVaw3lhOenNKoTkIN77HqRZsih",
  csms: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FCSMS%3Fd%3Dw5bf9cf38bec54ddab55da51e8d5126e8%26csf%3D1%26web%3D1%26e%3D1f2CQ1&sa=D&sntz=1&usg=AOvVaw1B5yqv_NoI5ya9aDJ_sYfd",
  slo: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FSLO%2520SIO%2FSLO%3Fd%3Dw2ab53e9d40da4f47b4d17dc671490673%26csf%3D1%26web%3D1%26e%3DbReFtn&sa=D&sntz=1&usg=AOvVaw3lFxjhsLUoq1JxLW-vYTGl",
  opex: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FOPEX%2520%2526%2520CAPEX%3Fd%3Dwde755dfb831244d5bcc3c79b0faf9917%26csf%3D1%26web%3D1%26e%3DTYKiaY&sa=D&sntz=1&usg=AOvVaw1lK_bpyUjMqYEAtWkYeQhk",
};

/* ---------- 2a. Sumber data ----------
  type "local"  : membaca assets/data/dashboard-data.json (data contoh)
  type "sheets" : membaca CSV dari Google Sheets "Publish to web"
  Jangan pernah menaruh API key / secret di sini. */
const dataSource = {
  type: "sheets",
  localUrl: "assets/data/dashboard-data.json",
  sheetsCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRA4hLSBN-nkOOZeSgNpld2cdVRqUsfsxi03tugmqHKjAkm3plM81wfgwHQwzLJIg171CPyhjRqrYNG/pub?output=csv",
};

/* ---------- 2b. Sumber data "Informasi Terkini" (Safety Alert + Jadwal) ----------
  type "local"  : membaca assets/data/info.json (data contoh)
  type "sheets" : membaca TAB Google Sheets terpisah (CSV "Publish to web")
  Kolom tab info (baris pertama = header):
    type, date, title, detail, expires
    type=alert    : date = tanggal diperbarui, detail = isi peringatan, expires = batas tampil (boleh kosong)
    type=schedule : date = tanggal kegiatan, title = nama kegiatan, detail = jam / tempat (boleh kosong)
  Format tanggal WAJIB YYYY-MM-DD (format kolom sebagai teks / plain text di Sheets).
  Jangan pernah menaruh API key / secret di sini. */
const infoSource = {
  type: "sheets",
  localUrl: "assets/data/info.json",
  sheetsCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRA4hLSBN-nkOOZeSgNpld2cdVRqUsfsxi03tugmqHKjAkm3plM81wfgwHQwzLJIg171CPyhjRqrYNG/pub?gid=779595226&single=true&output=csv",
};

const employeeSource = {
  type: "local",
  localUrl: "assets/data/employees.json",
  sheetsCsvUrl: "",
};

/* ---------- 3. Pengaturan tampilan ---------- */
const ohsConfig = {
  defaultIndicator: "ltifr",
  defaultYear: 2026,
  showTargetLine: true,

  // Fitur KPI detail (modal)
  kpiDetailEnabled: true,

  /* Skor total resmi (Katalog KPI Generic 2026 - Safety Performance). */
  scoring: {
    capScore: false, // true = skor tiap indikator dibatasi 0-100; false = boleh <0 atau >100
    capProgressScore: true,
    totalTarget: 90,
    totalLabel: "Skor Safety Performance",
    sourceNote: "Katalog KPI Generic 2026 – Safety Performance",
  },

  /* Hanya 2 status: tercapai atau belum (tidak ada pita Warning di katalog). */
  statuses: {
    met: {
      label: "Tercapai",
      cls: "status-good",
      color: "#16A34A",
      point: "circle",
    },
    notMet: {
      label: "Belum tercapai",
      cls: "status-critical",
      color: "#DC2626",
      point: "rectRot",
    },
    none: {
      label: "Belum ada data",
      cls: "status-none",
      color: "#94A3B8",
      point: "circle",
    },
  },

  monthsShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ],
  monthsLong: [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ],

  /* 8 indikator. id harus sama dengan kolom "indicator" di sheet.
      weight         : bobot dalam skor total (jumlah semua = 100)
      rule.type      : "zero" | "rate" | "progress"   (penjelasan di scoring.js)
      rule.target    : (rate) batas realisasi; makin kecil makin baik
      rule.passRatio : (progress) rasio realisasi/target agar Tercapai (default 1 = 100%)
      rule.unit      : satuan realisasi
      assumed        : true bila aturan masih ASUMSI sementara (menunggu unit OHS)
      assumedNote    : kalimat yang tampil di popup bila assumed = true
      formulaText    : rumus resmi (teks tampil di popup)
      chartType      : "line" | "bar" | "doughnut" (grafik di popup)
    Jenis "progress" (SOT, MCU, CAM, SSD) = jumlah ORANG. Targetnya berbeda tiap bulan dan diisi di kolom "target" di sheet, bukan di sini.  */
  indicators: [
    {
      id: "zfr",
      name: "Fatality",
      fullName: "Zero Fatality Rate (ZFR)",
      icon: "shield-alert",
      chartType: "bar",
      weight: 20,
      rule: { type: "zero", unit: "kejadian" },
      formulaText:
        "Tidak ada kematian akibat pekerjaan → 100%. Terjadi kematian → 0%. Realisasi diisi jumlah kejadian.",
      explanationTemplate: "",
    },
    {
      id: "ltifr",
      name: "LTIFR",
      fullName: "Lost Time Injury Frequency Rate",
      icon: "activity",
      chartType: "line",
      weight: 10,
      rule: { type: "rate", target: 0.25 },
      formulaText:
        "Realisasi LTIFR = (Jumlah accident hilang hari kerja × 1.000.000) ÷ Total jam kerja (jam kerja kontraktor ikut dihitung). Skor = 2 − (Realisasi ÷ Target). Skor di atas 100% berarti lebih baik dari target.",
      explanationTemplate: "",
    },
    {
      id: "ltisr",
      name: "LTISR",
      fullName: "Lost Time Injury Severity Rate",
      icon: "gauge",
      chartType: "line",
      weight: 10,
      rule: { type: "rate", target: 4.75 },
      formulaText:
        "Realisasi LTISR = (Jumlah jam kerja hilang × 1.000.000) ÷ Total jam kerja (jam kerja kontraktor ikut dihitung). Skor = 2 − (Realisasi ÷ Target). Skor di atas 100% berarti lebih baik dari target.",
      explanationTemplate: "",
    },
    {
      id: "nofa",
      name: "NoFA",
      fullName: "Number of Fire Accident",
      icon: "flame",
      chartType: "bar",
      weight: 10,
      rule: { type: "zero", unit: "kejadian" },
      formulaText:
        "Tidak ada kebakaran dengan kerugian lebih dari Rp3 miliar → 100%. Ada → 0%. Realisasi diisi jumlah kejadian.",
      explanationTemplate: "",
    },
    {
      id: "sot",
      name: "SOT",
      fullName: "Safety Observation Tour",
      icon: "eye",
      chartType: "bar",
      weight: 20,
      rule: { type: "progress", passRatio: 0.5, unit: "orang" },
      formulaText:
        "Jumlah orang yang melaksanakan SOT dibanding target bulan itu (offline atau online). Skor = Realisasi ÷ Target. Capaian minimal 50% dari target tetap berstatus Tercapai.",
      explanationTemplate: "",
      assumed: true,
      assumedNote:
        'Arti "jumlah orang" untuk SOT dan batas Tercapai 50% perlu dikonfirmasi unit OHS; skor dibatasi 100% (asumsi sementara).',
    },
    {
      id: "mcu",
      name: "MCU",
      fullName: "Medical Check Up Completed",
      icon: "stethoscope",
      chartType: "line",
      weight: 10,
      rule: { type: "progress", unit: "orang" },
      formulaText:
        "Jumlah karyawan yang telah melakukan MCU (kumulatif sejak Januari) dibanding target bulan itu. Skor = Realisasi ÷ Target. Tercapai bila jumlah orang terpenuhi.",
      explanationTemplate: "",
      assumed: true,
      assumedNote:
        "Skor dibatasi 100% bila realisasi melebihi target (asumsi sementara menunggu unit OHS).",
    },
    {
      id: "cam",
      name: "CAM",
      fullName: "Consultation After MCU Completed",
      icon: "messages-square",
      chartType: "line",
      weight: 10,
      rule: { type: "progress", unit: "orang" },
      formulaText:
        "Jumlah karyawan yang telah konsultasi dengan dokter perusahaan setelah hasil MCU (kumulatif sejak Januari) dibanding target bulan itu. Skor = Realisasi ÷ Target.",
      explanationTemplate: "",
      assumed: true,
      assumedNote:
        "Skor dibatasi 100% bila realisasi melebihi target (asumsi sementara menunggu unit OHS).",
    },
    {
      id: "ssd",
      name: "SSD",
      fullName: "SHE Self Development",
      icon: "graduation-cap",
      chartType: "line",
      weight: 10,
      rule: { type: "progress", unit: "orang" },
      formulaText:
        "Jumlah karyawan yang telah mencapai minimal 10 jam self learning health & safety (kumulatif sejak Januari) dibanding target bulan itu. Skor = Realisasi ÷ Target.",
      explanationTemplate: "",
      assumed: true,
      assumedNote:
        "Skor dibatasi 100% bila realisasi melebihi target (asumsi sementara menunggu unit OHS).",
    },
  ],

  /* Menu sidebar. */
  nav: [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "layout-dashboard",
      href: "index.html",
    },
    {
      id: "employees",
      label: "Karyawan",
      icon: "users",
      href: "karyawan.html",
    },
    {
      id: "documents",
      label: "Dokumen",
      icon: "folder-open",
      href: "dokumen.html",
    },
  ],

  /* Kartu KPI di halaman Karyawan. key = nama kolom hasil hitung (tetap, kontrak, total). */
  employeeKpis: [
    {
      key: "total",
      name: "Total Karyawan",
      desc: "Tetap + Kontrak",
      icon: "users",
    },
    {
      key: "tetap",
      name: "Karyawan Tetap",
      desc: "Jumlah karyawan tetap.",
      icon: "user-check",
    },
    {
      key: "kontrak",
      name: "Karyawan Kontrak",
      desc: "Jumlah karyawan kontrak.",
      icon: "user-plus",
    },
  ],

  // Menu pada halaman document
  documents: [
    {
      group: "Formulir",
      items: [
        {
          title: "Form Inspeksi KTA/TTA",
          desc: "Dokumen dan prosedur keselamatan",
          icon: "clipboard-check",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia-my.sharepoint.com%2F%3Ax%3A%2Fr%2Fpersonal%2Fsuryanto_manurung_sig_id%2F_layouts%2F15%2FDoc.aspx%3Fsourcedoc%3D%257B68588649-B4D1-4B33-9B0A-1CADB39C3004%257D%26file%3DForm%2520Inspeksi%2520K3%2520PT.%2520Semen%2520Tonasa.xlsx%26action%3Dedit%26mobileredirect%3Dtrue%26wdMsFormsCorrelationId%3D9b70694d-c198-48ad-a7e3-9ea57b64e5ce&sa=D&sntz=1&usg=AOvVaw2F-rKPQqcf-H_vweMnELlt",
        },
        {
          title: "Form Inspeksi Damkar",
          desc: "Catatan dan laporan inspeksi",
          icon: "clipboard-check",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSe0k0CBhBXrGt0sI0h3oBzruIizr7sUIG69w7ZE1TnJZ8oehw/viewform?usp=header",
        },
        {
          title: "Form Kunjungan Tamu",
          desc: "Form kunjungan tamu PT. Semen Tonasa",
          icon: "users",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSc7CBo-vx8fpKPU9MMzo9cQKCpKXNfXJbgp5PYEZ-l90VXLOQ/viewform?usp=header",
        },
        {
          title: "Form Standart",
          desc: "Form standar",
          icon: "book-text",
          url: "https://www.google.com/url?q=http%3A%2F%2Fsimphoni.sig.id&sa=D&sntz=1&usg=AOvVaw3PywsaQ9Odzdt2iwPz5mkN",
        },
        {
          title: "P2H",
          desc: "Form Pemeriksaan dan Perawatan Harian",
          icon: "cross",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSeNtv2wkhEb96DUaDDaXihfTR_ErznjnXEePlSa2OitoLvxxA/viewform?usp=sharing&ouid=103258139593658311481",
        },
      ],
    },
    {
      group: "Rekapan",
      items: [
        {
          title: "Inspeksi KTA/TTA",
          desc: "Rekapan Inspeksi KTA/TTA",
          icon: "book-text",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia-my.sharepoint.com%2F%3Ax%3A%2Fr%2Fpersonal%2Fsuryanto_manurung_sig_id%2F_layouts%2F15%2FDoc.aspx%3Fsourcedoc%3D%257B68588649-B4D1-4B33-9B0A-1CADB39C3004%257D%26file%3DForm%2520Inspeksi%2520K3%2520PT.%2520Semen%2520Tonasa.xlsx%26action%3Dedit%26mobileredirect%3Dtrue%26wdMsFormsCorrelationId%3D9b70694d-c198-48ad-a7e3-9ea57b64e5ce&sa=D&sntz=1&usg=AOvVaw2F-rKPQqcf-H_vweMnELlt",
        },
        {
          title: "Inspeksi Damkar",
          desc: "Rekaman Inspeksi Damkar",
          icon: "book-text",
          url: "https://docs.google.com/spreadsheets/d/1plSWOxd9jNSSlJ5O7FyGlmXPdQKghFawWSkShktKnVA/edit?resourcekey=&gid=551717951#gid=551717951",
        },
        {
          title: "Kunjungan Tamu",
          desc: "Rekaman Kunjungan Tamu",
          icon: "library-big",
          url: "https://docs.google.com/spreadsheets/d/1RV-pBJJRR4XlrIK9PxBYXNFWmHgYTkqc0Lg4z-B6vhk/edit?resourcekey=&gid=1860285440#gid=1860285440",
        },
        {
          title: "Rekap Accident",
          desc: "Rekapan Accident",
          icon: "book-a",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia-my.sharepoint.com%2F%3Ax%3A%2Fr%2Fpersonal%2Fdep_she_sig_id%2F_layouts%2F15%2FDoc.aspx%3Fsourcedoc%3D%257B1D0A82AF-8C09-4812-96E1-DB8411B7B3B3%257D%26file%3DST_Performance%2520Monitoring%25202026.xlsx%26action%3Ddefault%26mobileredirect%3Dtrue&sa=D&sntz=1&usg=AOvVaw2RG2PLd_-Ifl6jmkszaqcz",
        },
        {
          title: "Rekap P2H",
          desc: "Rekapan inputan P2H",
          icon: "book-plus",
          url: "https://docs.google.com/spreadsheets/d/1KLUQz2UWLEtJfdjgdu6EG0REPHK3E1ZIfjLBfl0oYkY/edit?usp=sharing",
        },
      ],
    },
    {
      group: "Post Test & Nilai Post Test",
      items: [
        {
          title: "Post Test 1",
          desc: "Post test 1 safety induction",
          icon: "sticky-note",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSe3vdISiCyd0dUvl49-DKXV6efXq64Nc4KPDTkLSGQuNtNX-g/viewform?usp=header",
        },
        {
          title: "Post Test 2",
          desc: "Post test 2 safety induction",
          icon: "sticky-note",
          url: "https://docs.google.com/forms/d/e/1FAIpQLScum_kHErq19cMP5zEKn6z-Bzbswq-fBZY_DRE69pMCKX9sUA/viewform?usp=header",
        },
        {
          title: "Post Test CLSR Mahasiswa",
          desc: "Post test CLSR untuk mahasiswa",
          icon: "book-check",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSfpvcLxDANNEgUG9y6Sn6rdFtV6JEhz5XVII2xf3KJd2Ra1pQ/viewform",
        },
        {
          title: "Post Test CLSR Pekerja",
          desc: "Post test CLSR untuk pekerja",
          icon: "book-check",
          url: "https://forms.gle/iPWbJuhubP2ownSm8",
        },
        {
          title: "Nilai Post Test 1",
          desc: "Nilai post test 1 safety induction",
          icon: "book-open-check",
          url: "https://docs.google.com/spreadsheets/d/1EMv6X92clNOPtNUYbcjByUucOX5N-5wR74Hz8rC6T-0/edit?resourcekey=&gid=229858421#gid=229858421",
        },
        {
          title: "Nilai Post Test 2",
          desc: "Nilai post test 2 safety induction",
          icon: "book-open-check",
          url: "https://docs.google.com/spreadsheets/d/1AFv0InPc_IqRwUQSFoS9Z30X86B6bR8-WgzAWJ7lz3A/edit?resourcekey=&gid=934005915#gid=934005915",
        },
        {
          title: "Nilai Post Test Mahasiswa",
          desc: "Nilai post test CLSR untuk mahasiswa",
          icon: "clipboard-check",
          url: "https://docs.google.com/spreadsheets/d/1EDORrMTt6mwd6-xlEyr5Sx1Vl_NvfCvfnHu1W90LMsA/edit?resourcekey=&gid=24095268#gid=24095268",
        },
        {
          title: "Nilai Post Test Pekerja",
          desc: "Nilai post test CLSR untuk pekerja",
          icon: "clipboard-check",
          url: "https://docs.google.com/spreadsheets/d/1BXMDYab4CQYPkAM3Uly90brBAnKziF4sjNImnuNk_hI/edit?resourcekey=&gid=417053288#gid=417053288",
        },
      ],
    },
    {
      group: "Pendaftaran",
      items: [
        {
          title: "Pendaftaran Izin Kerja",
          desc: "Pendaftaran izin kerja",
          icon: "file-text",
          url: "https://www.google.com/url?q=https%3A%2F%2Fohs-sementonasa.com%2F&sa=D&sntz=1&usg=AOvVaw2NUjkO2iyWvSz0Rj2NgMKj",
        },
      ],
    },
    {
      group: "Keorganisasian & Perencanaan K3",
      items: [
        {
          title: "Struktur OHS",
          desc: "Struktur organisasi unit OHS",
          icon: "landmark",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FStruktur%2FStruktur%2520OHS%3Fd%3Dw62d09861c5e94fb6bd2afea55801cc8a%26csf%3D1%26web%3D1%26e%3D9CREo9&sa=D&sntz=1&usg=AOvVaw3IHZaGzEbU6rwTYZns_C7D",
        },
        {
          title: "Job Profile",
          desc: "Profile Job Unit OHS",
          icon: "user-round-pen",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FAudit%2520Integrasi%2F2.%2520Struktur%2C%2520Jobdesc%2C%2520Kebijakan%2520MD%2520Internal%2FJob%2520Profile%3Fd%3Dwacfe7ffd0e8048f7817305b9fd23ef3d%26csf%3D1%26web%3D1%26e%3DtVa5KI&sa=D&sntz=1&usg=AOvVaw1ZD2D7E5AsNCMMrhCAb4WQ",
        },
        {
          title: "Program Kerja",
          desc: "Program kerja Unit OHS",
          icon: "square-chart-gantt",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FProgram%2520Kerja%3Fd%3Dwd4db2212b69f4ee0ad80345060c3ba4c%26csf%3D1%26web%3D1%26e%3DyGADXl&sa=D&sntz=1&usg=AOvVaw23u8UqrtmwnUH-vfafgg8-",
        },
        {
          title: "OPEX & CAPEX",
          desc: "OPEX & CAPEX Unit OHS",
          icon: "hand-coins",
          linkKey: "opex",
        },
        {
          title: "KPI",
          desc: "KPI Unit OHS",
          icon: "waypoints",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FKPI%3Fd%3Dw448a18cdf8c4440b99842e46d027d94c%26csf%3D1%26web%3D1%26e%3DAT1wx7&sa=D&sntz=1&usg=AOvVaw2y9u0xB8Id0d0I-bUh8mdq",
        },
        {
          title: "Laporan Kinerja Bulanan",
          desc: "Laporan kinerja bulanan Unit OHS",
          icon: "book-down",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FLaporan%2520Kinerja%2520K3%3Fd%3Dw07ce38463ad744dd933167dabd646bdd%26csf%3D1%26web%3D1%26e%3DpkouqS&sa=D&sntz=1&usg=AOvVaw3rGV0EM1QLuq-THSXF8Kh4",
        },
        {
          title: "Penghargaan K3",
          desc: "Penghargaan Unit K3 Unit OHS",
          icon: "award",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FPiagam%2520Penghargaan%3Fd%3Dw34b38768f18a49f79e242236ba68fdfa%26csf%3D1%26web%3D1%26e%3DReksla&sa=D&sntz=1&usg=AOvVaw0zTK74F4ZUW1IUTXtjwSZx",
        },
        {
          title: "P2K3",
          desc: "Panitia Pembina Keselamatan dan Kesehatan Kerja",
          icon: "person-standing",
          linkKey: "p2k3",
        },
      ],
    },
    {
      group: "Tanggap Darurat & Fasilitas Keselamatan",
      items: [
        {
          title: "Struktur Tanggap Darurat",
          desc: "Struktur tanggap darurat",
          icon: "shield-alert",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FStruktur%2FStruktur%2520Tanggap%2520Darurat%2520Unit%2520Kerja%3Fd%3Dw0b34d5ada3644e78b780f6ebcc7a14ac%26csf%3D1%26web%3D1%26e%3DZAzLo3&sa=D&sntz=1&usg=AOvVaw3SUpZ_Vumu3OrrZ0a7exIC",
        },
        {
          title: "Informasi Emergency Response",
          desc: "Informasi emergency response",
          icon: "siren",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FTanggap%2520Darurat%2FNomor%2520Emergency%2520Call%3Fd%3Dw438c6073be6b4631a6f2de0404c7caab%26csf%3D1%26web%3D1%26e%3Dw0jWG9&sa=D&sntz=1&usg=AOvVaw0hsumOyXujXWo3Sw8cQzGp",
        },
        {
          title: "Simulasi Tanggap Darurat (Drill)",
          desc: "Latihan simulasi tanggap darurat",
          icon: "footprints",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FTanggap%2520Darurat%3Fd%3Dwc93ffb01fe2d4bd7b50db5620d43926f%26csf%3D1%26web%3D1%26e%3DEFpueO&sa=D&sntz=1&usg=AOvVaw2i5xOunt3M6rYQalStOm3S",
        },
        {
          title: "Peta APAR & Rambu K3",
          desc: "Sebaran Peta APAR & Rambu K3",
          icon: "map",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FPeta%3Fd%3Dw6af726420f154df0ba79445df664b65d%26csf%3D1%26web%3D1%26e%3D8ZZw4N&sa=D&sntz=1&usg=AOvVaw1fr5w8KcKrSwIQfLDjgQbO",
        },
      ],
    },
    {
      group: "Operasional & Kepatuhan Standar",
      items: [
        {
          title: "Sertifikasi Personil",
          desc: "Sertifikasi personil",
          icon: "certificate",
          linkKey: "sertif",
        },
        {
          title: "Monitoring APD",
          desc: "Monitoring APD",
          icon: "binoculars",
          url: "https://script.google.com/macros/s/AKfycbz0V0oWBVUD_nDOKIBf7dwZ1GuU-f55awbkFk_LJzPSyIhTUMW2XrCvDxSqB2E1EUla/exec",
        },
        {
          title: "SLO",
          desc: "Sertifikat Laik Operasi",
          icon: "file-text",
          linkKey: "slo",
        },
      ],
    },
    {
      group: "Manajemen Kontraktor",
      items: [
        {
          title: "Manajemen Kontraktor",
          desc: "manajemen kontraktor",
          icon: "contact-round",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FCSMS%3Fd%3Dw5bf9cf38bec54ddab55da51e8d5126e8%26csf%3D1%26web%3D1%26e%3DtRY42c&sa=D&sntz=1&usg=AOvVaw2bPsLeuGfpwdgBY0K2bevt",
        },
        {
          title: "CSMS",
          desc: "Contractor Safety Management System",
          icon: "hard-hat",
          linkKey: "csms",
        },
      ],
    },
    {
      group: "Evaluasi Risiko",
      items: [
        {
          title: "IPDK",
          desc: "Identifikasi dan Penilaian Dampak Kegiatan",
          icon: "scan-eye",
          url: "https://drive.google.com/drive/folders/1II-Oj6VDbNx-QgX3-NwkgO4dkEU0Xw4P?usp=sharing",
        },
        {
          title: "CLSR IP",
          desc: "CLSR IP",
          icon: "shield-plus",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia-my.sharepoint.com%2F%3Af%3A%2Fr%2Fpersonal%2Fdep_she_sig_id%2FDocuments%2F2.%2520SAFETY%2F6.%2520PLANNING%2520%28Perencanaan%29%2F6.2%2520SASARAN%2520K3%2520DAN%2520PENCAPAIANNYA%2Fc.%2520PROGRAM%2520KERJA%2F4.%2520Program%2520Kerja%25202026%2FBukti%2520Implementasi%2520CLSRIP%2FPT%2520Semen%2520Tonasa%3Fd%3Dw5edca27bafca464b9963dd59e27ca625%26csf%3D1%26web%3D1%26e%3Dcq1uhn&sa=D&sntz=1&usg=AOvVaw3LIVnX8GeV_6jE-s6VsXht",
        },
        {
          title: "Assessment CLSR",
          desc: "Assessment CLSR",
          icon: "shield-half",
          url: "https://www.google.com/url?q=https%3A%2F%2Fsemenindonesia.sharepoint.com%2F%3Af%3A%2Fr%2Fsites%2FOHS974%2FShared%2520Documents%2FFolder%2520OHS%2FAssessment%2520CLSR%3Fd%3Dw5be19c26f74d48d58add4464cf98b105%26csf%3D1%26web%3D1%26e%3DazbjVY&sa=D&sntz=1&usg=AOvVaw0tAHG8WW2ecHuCyDUiYq86",
        },
      ],
    },
  ],

  /* Kartu Quick Access */
  quickAccess: [
    {
      title: "Sertifikasi",
      desc: "Sertifikasi personil",
      icon: "certificate",
      linkKey: "sertif",
    },
    {
      title: "P2K3",
      desc: "Panitia P2K3",
      icon: "user-group",
      linkKey: "p2k3",
    },
    {
      title: "CSMS",
      desc: "Manajemen Kontraktor",
      icon: "hard-hat",
      linkKey: "csms",
    },
    {
      title: "SLO",
      desc: "SLO Unit OHS",
      icon: "book-open",
      linkKey: "slo",
    },
    {
      title: "Opex & Capex",
      desc: "Opex & Capex Unit OHS",
      icon: "wallet",
      linkKey: "opex",
    },
  ],
};

/* ---------- 4. Fungsi bantu kecil (dipakai banyak file) ---------- */
const ohsUtils = {
  /* Escape teks sebelum disisipkan ke innerHTML. */
  esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  },

  /* Hanya https:// yang dianggap link valid (menolak javascript:, data:, http:). */
  isSafeUrl(value) {
    if (typeof value !== "string" || value.trim() === "") return false;
    try {
      return new URL(value.trim()).protocol === "https:";
    } catch (e) {
      return false;
    }
  },

  /* Ubah <i data-lucide="..."> menjadi SVG. Aman bila Lucide gagal dimuat. */
  icons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  },

  /* "2026-10-06" -> "06 Oktober 2026" (tanpa objek Date agar bebas zona waktu). */
  formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "-";
    const month = ohsConfig.monthsLong[Number(m[2]) - 1];
    return month ? `${m[3]} ${month} ${m[1]}` : "-";
  },

  /* 95 -> "95", 92.5 -> "92,5" */
  formatNumber(n) {
    return String(Math.round(n * 10) / 10).replace(".", ",");
  }
};
