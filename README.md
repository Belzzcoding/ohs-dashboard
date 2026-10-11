# 🦺 OHS Safety Performance Dashboard

**See the performance. Understand the risks. Stay safety-aware.**

Dashboard web untuk memantau performa *Occupational Health & Safety* (OHS) di **PT. Semen Tonasa**. Dirancang sebagai pusat informasi visual yang menyatukan indikator keselamatan kerja, tren performa bulanan, status indikator, peringatan keselamatan, jadwal kegiatan, dan akses cepat ke sumber daya OHS.

Bukan sekadar kumpulan angka dan grafik. Dashboard ini membantu pengguna melihat gambaran performa keselamatan dengan lebih cepat, memahami indikator yang perlu diperhatikan, dan menemukan informasi OHS yang dibutuhkan tanpa harus berpindah-pindah sumber secara manual.

🔗 **Live Dashboard:** [Buka OHS Safety Performance Dashboard](https://belzzcoding.github.io/ohs-dashboard/)

---

## 👀 A Look Inside the Dashboard

Dashboard dirancang agar informasi penting dapat ditemukan dalam beberapa detik, dengan tampilan yang terstruktur dan berorientasi pada kebutuhan pengguna.

### 📊 Safety Performance at a Glance

Delapan indikator utama ditampilkan dalam kartu KPI sehingga kondisi performa keselamatan dapat dipahami sekilas.

| Indicator | Full Name                       |
| --------- | ------------------------------- |
| ZFR       | Zero Fatality Rate              |
| LTIFR     | Lost Time Injury Frequency Rate |
| LTISR     | Lost Time Injury Severity Rate  |
| NoFA      | Number of Fire Accident         |
| SOT       | Safety Observation Tool         |
| MCU       | Medical Check Up                |
| CAM       | Consultation After MCU          |
| SSD       | SHE Self Development            |

Setiap kartu menampilkan persentase performa dan status **Good**, **Warning**, atau **Critical**. Pengguna juga dapat membuka detail indikator untuk melihat grafik bulanan, target, penjelasan performa, rumus, dan ambang batas yang dikonfigurasi.

### 📈 Follow the Monthly Trend

Grafik *Monthly Performance Trend* membantu pengguna melihat perubahan performa dari Januari hingga Desember, memilih indikator yang ingin ditinjau, serta berpindah antarperiode tahunan.

Data yang belum tersedia tetap diperlakukan sebagai data kosong, bukan dianggap sebagai nilai nol. Dengan begitu, grafik tidak menggambarkan penurunan yang sebenarnya belum tentu terjadi.

### 🚨 Stay Informed with OHS Updates

Kolom **Informasi Terkini** menampilkan informasi yang relevan di luar angka KPI, meliputi:

* **Safety Alert** — peringatan keselamatan yang masih berlaku.
* **Jadwal Kegiatan OHS** — kegiatan hari ini dan mendatang.
* **Quick Access** — akses ringkas ke sumber daya OHS yang sering digunakan.

Tanggal dan jam ditampilkan menggunakan zona waktu WITA. Informasi jadwal dan peringatan dapat diperbarui melalui sumber data yang dikonfigurasi tanpa harus mengubah tata letak dashboard.

### 🔎 Find OHS Resources Easily

Halaman **Dokumen** menjadi tempat untuk menemukan berbagai dokumen dan sumber daya OHS yang dikelompokkan berdasarkan kategori.

Pengguna dapat mencari dokumen berdasarkan judul atau deskripsi, memfilter berdasarkan grup, lalu membuka sumber terkait melalui tautan eksternal.

---

## ✨ What Makes It Different?

* **Beyond the numbers.** KPI tidak hanya menampilkan persentase, tetapi juga menyediakan detail dan penjelasan melalui modal interaktif.
* **One place, multiple resources.** Informasi performa dan akses ke sumber daya OHS tersedia dalam satu portal.
* **Monthly perspective.** Tren bulanan membantu pengguna memahami perubahan performa dari waktu ke waktu.
* **Designed for different screens.** Tata letak menyesuaikan desktop, tablet, dan perangkat seluler.
* **Lightweight by design.** Menggunakan teknologi web sederhana tanpa backend atau database khusus.
* **Easy to maintain.** Data dan konfigurasi dipisahkan dari tampilan agar pembaruan lebih mudah dilakukan.

---

## 🛠️ Built With

| Technology         | Purpose                             |
| ------------------ | ----------------------------------- |
| HTML5 & CSS3       | Struktur halaman dan tampilan       |
| Bootstrap 5        | Komponen UI dan responsivitas       |
| Vanilla JavaScript | Interaksi dan pengelolaan tampilan  |
| Chart.js           | Visualisasi data performa           |
| Lucide Icons       | Ikon antarmuka                      |
| Google Sheets      | Sumber data eksternal yang didukung |
| GitHub Pages       | Hosting website statis              |

Tidak menggunakan framework frontend tambahan, backend, atau database. Dashboard berfokus pada penyajian informasi, bukan pengelolaan data melalui operasi CRUD.

---

## 🚀 Run Locally

Ingin menjalankan dashboard di komputer sendiri?

1. Clone repository:

   ```bash
   git clone https://github.com/USERNAME/ohs-dashboard.git
   ```

2. Masuk ke direktori proyek:

   ```bash
   cd ohs-dashboard
   ```

3. Jalankan menggunakan local web server, misalnya ekstensi **Live Server** di Visual Studio Code.

4. Buka halaman `index.html` melalui server lokal.

Pastikan berkas aset dan sumber data tersedia sesuai struktur direktori proyek. Jika menggunakan Google Sheets, konfigurasi URL CSV dan akses publik sumber data juga harus benar.

---

## 🎯 Project Vision

Tujuan proyek ini adalah membuat informasi keselamatan kerja lebih mudah diakses, lebih mudah dipahami, dan lebih mudah ditelusuri.

Dengan menggabungkan performa, tren, status, peringatan, jadwal, dan akses sumber daya dalam satu antarmuka, dashboard diharapkan dapat mendukung pengalaman pemantauan OHS yang lebih terstruktur.

**A clearer view of safety performance starts with better access to information.**

---

<sub>OHS Safety Performance Dashboard · PT. Semen Tonasa · 2026</sub>
