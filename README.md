# OHS Safety Performance Dashboard

Dashboard publik statis untuk menampilkan performa keselamatan kerja (OHS) bulanan dan menjadi pintu masuk ke sumber daya OHS eksternal.

> **Status data: DATA CONTOH (mock).** Semua angka dan status di `dashboard-data.json` adalah placeholder pengembangan, bukan data resmi. Dashboard menampilkan banner "Data contoh" selama `meta.isMockData` bernilai `true`.

## 1. Tujuan

- Menampilkan 8 indikator: Fatality, LTIFR, LTISR, NoFA, SOT, MCU, CAM, SSD.
- Tiap indikator menampilkan **performance percentage** (angka pencapaian, bukan nilai mentah) dan status **Good / Warning / Critical**.
- Tren bulanan (Chart.js) dengan pilihan indikator dan tahun.
- Akses cepat ke Google Sheets / Forms / Drive dan sistem lain lewat sidebar dan Quick Access.
- Hanya membaca dan menampilkan data. Tanpa login, CRUD, backend, atau database.

Dashboard **tidak** membuat "Overall Safety Score". Delapan indikator ditampilkan satu per satu sampai ada metode agregasi resmi.

## 2. Menjalankan secara lokal

Browser memblokir `fetch()` untuk file JSON jika halaman dibuka lewat `file://`. Jalankan server statis sederhana:

```bash
cd ohs-dashboard
python -m http.server 8000
# buka http://localhost:8000
```

Tidak ada langkah build dan tidak ada `npm install`. Bootstrap, Chart.js, Lucide, dan font Inter dimuat dari CDN (versi dipatok di `index.html`), jadi perlu koneksi internet.

## 3. Struktur proyek

```
ohs-dashboard/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── config.js        link OHS, sumber data, daftar indikator, menu
│   │   ├── data-service.js  satu-satunya file yang tahu asal data
│   │   ├── dashboard.js     render KPI, chart, ringkasan status
│   │   └── app.js           sidebar, Quick Access, loading/error, start
│   ├── img/                 (kosong; tempat logo resmi)
│   └── data/dashboard-data.json
└── README.md
```

Alur: `data-service.js` -> model data seragam -> `dashboard.js` -> tampilan. UI tidak tahu data berasal dari JSON atau Google Sheets.

## 4. Model data

```json
{
  "meta": { "isMockData": true, "lastUpdated": "2026-10-06" },
  "years": {
    "2026": {
      "indicators": [
        {
          "id": "ltifr",
          "target": 95,
          "monthly": [
            { "month": 1, "performance": 95, "status": "Good" },
            { "month": 11, "performance": null, "status": null }
          ]
        }
      ]
    }
  }
}
```

Aturan penting:

- `month` berupa angka 1-12. Nama bulan diatur di `config.js`.
- Bulan yang belum dilaporkan harus `null`, **bukan `0`**. `0` dibaca sebagai performa buruk, sedangkan `null` berarti belum ada data (garis chart terputus).
- `status` dibaca dari data. Dashboard tidak menghitung status.
- Nama indikator, ikon, dan deskripsi ada di `config.js`, bukan di data.
- Kartu KPI menampilkan **bulan terakhir yang berisi data** pada tahun terpilih.

### Memperbarui data contoh

1. Buka `assets/data/dashboard-data.json`.
2. Ubah `performance`, `status`, dan `target`; isi bulan baru menggantikan `null`.
3. Perbarui `meta.lastUpdated` (format `YYYY-MM-DD`).
4. Untuk tahun baru, tambahkan blok baru di `years` (misal `"2027"`). Selector tahun otomatis mengikuti.
5. Saat data resmi sudah dipakai, ubah `meta.isMockData` menjadi `false` agar banner hilang.

## 5. Mengatur link eksternal

Semua URL ada di `ohsLinks` pada `assets/js/config.js`. Sidebar dan Quick Access sama-sama membacanya.

- Hanya URL `https://` yang diterima. Selain itu (kosong, `http:`, `javascript:`) membuat menu / kartu tampil redup dan tidak bisa diklik.
- Link eksternal dibuka dengan `target="_blank"` dan `rel="noopener noreferrer"`.
- Saat ini semua link **kosong** karena URL resmi belum tersedia.

## 6. Integrasi Google Sheets (rencana)

Jangan memakai API key atau OAuth di frontend. Pendekatan yang disarankan:

1. Buat **sheet khusus publik** yang hanya berisi data agregat, terpisah dari sheet internal/operasional. Jangan hanya menyembunyikan tab atau kolom.
2. Format satu baris = satu indikator-bulan, dengan header tepat seperti ini:

   | year | month | indicator | performance | status | target | last_updated |
   |---|---|---|---|---|---|---|
   | 2026 | 1 | ltifr | 95 | Good | 95 | 2026-10-06 |

   `indicator` memakai `id` dari `config.js` (huruf kecil). Kolom `status` diisi pemilik OHS.
3. Di Google Sheets: **File > Share > Publish to web**, pilih sheet tersebut dan format **CSV**, lalu salin URL-nya.
4. Di `config.js`:
   ```js
   const dataSource = { type: "sheets", localUrl: "...", sheetsCsvUrl: "https://docs.google.com/.../pub?output=csv" };
   ```
5. `data-service.js` sudah memuat parser CSV dan konversi baris datar ke model bersarang. UI tidak berubah.

Catatan:

- "Publish to web" benar-benar publik. Siapa pun yang punya link dapat membacanya.
- Google menyimpan hasil publish di cache beberapa menit, jadi perubahan tidak langsung muncul.
- Parser toleran terhadap `95%`, koma desimal, dan huruf besar/kecil pada status. Status yang tidak dikenal ditampilkan sebagai "Belum ada data".
- **Belum diuji dengan sheet sungguhan.** Uji CORS dan format dari domain GitHub Pages sebelum dipakai.

## 7. Deploy ke GitHub Pages

1. Buat repository di GitHub dan unggah isi folder `ohs-dashboard/` (`index.html` di root repository).
2. **Settings > Pages**, pada *Build and deployment* pilih *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Tunggu beberapa menit. Situs tersedia di `https://USERNAME.github.io/REPOSITORY/`.

Semua path aset bersifat relatif (`assets/...`) dan tidak ada routing sisi server, sehingga berjalan di sub-path repository.

## 8. Responsif

| Lebar | Sidebar | Grid KPI | Chart & ringkasan status |
|---|---|---|---|
| 1200px ke atas | tetap, 256px | 4 kolom | berdampingan |
| 576-1199px | drawer (tombol menu) | 2 kolom | chart penuh, ringkasan di bawah |
| di bawah 576px | drawer | 1 kolom | tersusun vertikal, kontrol bertumpuk |

Breakpoint sidebar sengaja di 1200px: pada 1024px, sidebar permanen akan menyisakan ruang yang terlalu sempit.

## 9. Aksesibilitas

- HTML semantik, hierarki heading, skip link, fokus terlihat, navigasi keyboard (drawer memakai Bootstrap Offcanvas).
- Status selalu berupa teks (Good / Warning / Critical), bukan hanya warna. Di chart, bentuk titik juga berbeda per status.
- Tabel tersembunyi di bawah chart menyediakan data bulanan untuk pembaca layar.
- Teks memakai `#64748B` atau lebih gelap. `#94A3B8` hanya untuk elemen dekoratif karena kontrasnya di bawah 4,5:1.
- Target sentuh minimal 44x44px di layar kecil.
- Belum diuji dengan pembaca layar sungguhan atau alat audit otomatis.

## 10. Asumsi yang diambil

- Nilai KPI = bulan terakhir yang berisi data (apakah data kumulatif atau bulanan belum diputuskan).
- Nilai lebih tinggi dianggap lebih baik hanya untuk arah panah tren. Panah sengaja netral (tanpa warna hijau/merah).
- Target selalu ditampilkan (garis putus-putus di chart dan teks di kartu).
- Sumbu Y chart tidak dimulai dari 0 agar variasi terbaca; hal ini dicatat di bawah chart.
- Aturan status pada data contoh (>= target = Good, sampai 10 poin di bawah = Warning, selain itu Critical) hanya ada di skrip pembuat data contoh dan **bukan aturan resmi**.

## 11. Pertanyaan terbuka untuk pemilik OHS

1. Rumus resmi performance percentage untuk tiap indikator.
2. Ambang batas resmi Good / Warning / Critical per indikator.
3. Nama menu final.
4. URL eksternal final.
5. Logo dan branding perusahaan resmi.
6. Apakah target selalu ditampilkan?
7. Apakah data bulanan kumulatif, hanya bulan berjalan, atau definisi lain?
8. Untuk MCU dan CAM: berapa jumlah minimum peserta agar angka agregat aman dipublikasikan?
