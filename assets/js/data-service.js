/* ==========================================================
   data-service.js
   Satu-satunya file yang tahu DARI MANA data berasal.
   Apa pun sumbernya, hasilnya selalu berbentuk sama:

   {
     meta:  { isMockData, lastUpdated: "YYYY-MM-DD", note },
     years: {
       "2026": { indicators: [
         { id, target, monthly: [ { month: 1..12, performance: number|null, status: "Good"|"Warning"|"Critical"|null } x12 ] }
       ] }
     }
   }

   Bulan tanpa data = performance null (BUKAN 0).
   Status tidak dihitung di sini; status dibaca dari data.
   ========================================================== */

const DataService = (() => {
  const STATUSES = ["Good", "Warning", "Critical"];

  /* ---------- Normalisasi nilai ---------- */

  /* "95", "95%", " 92,5 " -> angka; kosong / tidak valid -> null */
  function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).trim().replace("%", "").replace(",", ".");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  /* "good", "GOOD " -> "Good"; tidak dikenal -> null */
  function toStatus(value) {
    if (value === null || value === undefined) return null;
    const v = String(value).trim().toLowerCase();
    return STATUSES.find((s) => s.toLowerCase() === v) || null;
  }

  /* Pastikan tiap indikator punya tepat 12 bulan. */
  function normalizeMonthly(rawMonthly) {
    const byMonth = {};
    (Array.isArray(rawMonthly) ? rawMonthly : []).forEach((m) => {
      const month = toNumber(m && m.month);
      if (month >= 1 && month <= 12) byMonth[month] = m;
    });
    return Array.from({ length: 12 }, (_, i) => {
      const m = byMonth[i + 1];
      const performance = m ? toNumber(m.performance) : null;
      return {
        month: i + 1,
        performance,
        // Status tanpa angka tidak berarti apa-apa.
        status: performance === null ? null : toStatus(m && m.status)
      };
    });
  }

  /* Validasi + rapikan model (dipakai oleh sumber lokal maupun Sheets). */
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !raw.years || typeof raw.years !== "object") {
      throw new Error("Format data tidak dikenali: properti 'years' tidak ada.");
    }
    const years = {};
    Object.keys(raw.years).forEach((year) => {
      const list = (raw.years[year] && raw.years[year].indicators) || [];
      years[String(year)] = {
        indicators: list.map((ind) => ({
          id: String(ind.id || "").trim().toLowerCase(),
          target: toNumber(ind.target),
          monthly: normalizeMonthly(ind.monthly)
        }))
      };
    });
    const meta = raw.meta || {};
    return {
      meta: {
        isMockData: Boolean(meta.isMockData),
        lastUpdated: meta.lastUpdated || null,
        note: meta.note || ""
      },
      years
    };
  }

  /* ---------- Sumber 1: JSON lokal ---------- */
  async function loadLocal() {
    const res = await fetch(dataSource.localUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Gagal memuat ${dataSource.localUrl} (HTTP ${res.status})`);
    return normalize(await res.json());
  }

  /* ---------- Sumber 2: Google Sheets (CSV hasil "Publish to web") ----------
     Kolom yang dibaca (baris pertama = header):
       year, month, indicator, performance, status, target, last_updated  */

  /* Parser CSV kecil yang paham tanda kutip. Mengembalikan array of array. */
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const src = String(text).replace(/^﻿/, "");
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cell += ch; }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell); cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && src[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        rows.push(row); row = [];
      } else {
        cell += ch;
      }
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  /* Baris datar (satu baris = satu indikator-bulan) -> model bersarang. */
  function fromRows(rows) {
    if (!rows.length) throw new Error("Sheet kosong.");
    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    const col = (name) => header.indexOf(name);
    ["year", "month", "indicator", "performance"].forEach((name) => {
      if (col(name) === -1) throw new Error(`Kolom '${name}' tidak ditemukan di sheet.`);
    });

    const years = {};
    let lastUpdated = null;
    rows.slice(1).forEach((r) => {
      const get = (name) => (col(name) === -1 ? "" : r[col(name)]);
      const year = toNumber(get("year"));
      const month = toNumber(get("month"));
      const id = String(get("indicator")).trim().toLowerCase();
      if (!year || !(month >= 1 && month <= 12) || !id) return; // lewati baris rusak

      const y = (years[year] = years[year] || { indicators: {} });
      const ind = (y.indicators[id] = y.indicators[id] || { id, target: null, monthly: [] });
      const target = toNumber(get("target"));
      if (target !== null) ind.target = target;
      ind.monthly.push({ month, performance: get("performance"), status: get("status") });

      const lu = String(get("last_updated")).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(lu) && (!lastUpdated || lu > lastUpdated)) lastUpdated = lu;
    });

    const out = { meta: { isMockData: false, lastUpdated }, years: {} };
    Object.keys(years).forEach((year) => {
      out.years[year] = { indicators: Object.values(years[year].indicators) };
    });
    return normalize(out);
  }

  async function loadSheets() {
    if (!ohsUtils.isSafeUrl(dataSource.sheetsCsvUrl)) {
      throw new Error("dataSource.sheetsCsvUrl belum diisi dengan URL https:// yang valid.");
    }
    const res = await fetch(dataSource.sheetsCsvUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Gagal memuat Google Sheets (HTTP ${res.status})`);
    return fromRows(parseCsv(await res.text()));
  }

  /* ---------- API publik ---------- */
  async function load() {
    return dataSource.type === "sheets" ? loadSheets() : loadLocal();
  }

  return { load, normalize, parseCsv, fromRows, toNumber, toStatus };
})();
