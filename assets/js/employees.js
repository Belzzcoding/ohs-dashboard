/* ==========================================================
   employees.js
   Halaman Karyawan: KPI jumlah karyawan, popup rincian per unit,
   dan grafik tren dengan filter (unit kerja, bulan, tahun).

   Bentuk data (satu baris = satu unit pada satu bulan):
     { year, month, unit, tetap, kontrak }
   Sumber data: lihat employeeSource di config.js.
   ========================================================== */

const Employees = (function () {
  const $ = (id) => document.getElementById(id);
  const cfg = ohsConfig;
  const { esc } = ohsUtils;

  const state = {
    rows: [], // semua data (sudah dibersihkan)
    filters: { unit: "all", month: "all", year: null },
    latest: null, // { year, month } = periode data terbaru
    chart: null,
  };

  /* ---------- Fungsi bantu kecil ---------- */
  const fmt = (n) => Number(n).toLocaleString("id-ID");
  const periodKey = (year, month) => year * 12 + month;
  const periodText = (p) => `${cfg.monthsLong[p.month - 1]} ${p.year}`;

  /* Jumlahkan tetap, kontrak, dan total dari sekumpulan baris. */
  function sum(rows) {
    const tetap = rows.reduce((n, r) => n + r.tetap, 0);
    const kontrak = rows.reduce((n, r) => n + r.kontrak, 0);
    return { tetap, kontrak, total: tetap + kontrak };
  }

  /* Baris pada satu periode (opsional: hanya satu unit). */
  function rowsAt(year, month, unit = "all") {
    return state.rows.filter(
      (r) =>
        r.year === year &&
        r.month === month &&
        (unit === "all" || r.unit === unit),
    );
  }

  /* ---------- 1. Memuat data ---------- */

  /* Sel kosong harus dianggap tidak ada (Number("") akan menjadi 0). */
  const toNumber = (v) =>
    v === null || v === undefined || String(v).trim() === "" ? NaN : Number(v);

  /* Buang baris yang rusak. Angka kosong atau bukan angka = baris dilewati. */
  function cleanRows(list) {
    return (Array.isArray(list) ? list : [])
      .map((r) => ({
        year: toNumber(r.year),
        month: toNumber(r.month),
        unit: String(r.unit || "").trim(),
        tetap: toNumber(r.tetap),
        kontrak: toNumber(r.kontrak),
      }))
      .filter(
        (r) =>
          r.year > 0 &&
          r.month >= 1 &&
          r.month <= 12 &&
          r.unit !== "" &&
          Number.isFinite(r.tetap) &&
          r.tetap >= 0 &&
          Number.isFinite(r.kontrak) &&
          r.kontrak >= 0,
      );
  }

  /* CSV Google Sheets (header: year, month, unit, tetap, kontrak) -> daftar baris. */
  function rowsFromCsv(csvRows) {
    if (!csvRows.length) throw new Error("Sheet karyawan kosong.");
    const header = csvRows[0].map((h) => String(h).trim().toLowerCase());
    const need = ["year", "month", "unit", "tetap", "kontrak"];
    need.forEach((name) => {
      if (header.indexOf(name) === -1)
        throw new Error(`Kolom '${name}' tidak ada di sheet karyawan.`);
    });
    return csvRows.slice(1).map((cells) => {
      const row = {};
      need.forEach((name) => {
        row[name] = cells[header.indexOf(name)];
      });
      return row;
    });
  }

  async function fetchData() {
    if (employeeSource.type === "sheets") {
      if (!ohsUtils.isSafeUrl(employeeSource.sheetsCsvUrl)) {
        throw new Error(
          "employeeSource.sheetsCsvUrl belum diisi dengan URL https:// yang valid.",
        );
      }
      const res = await fetch(employeeSource.sheetsCsvUrl, {
        cache: "no-cache",
      });
      if (!res.ok)
        throw new Error(`Gagal memuat Google Sheets (HTTP ${res.status})`);
      const csv = DataService.parseCsv(await res.text());
      return { isMock: false, rows: cleanRows(rowsFromCsv(csv)) };
    }
    const res = await fetch(employeeSource.localUrl);
    if (!res.ok)
      throw new Error(
        `Gagal memuat ${employeeSource.localUrl} (HTTP ${res.status})`,
      );
    const json = await res.json();
    return {
      isMock: Boolean(json.meta && json.meta.isMockData),
      rows: cleanRows(json.rows),
    };
  }

  /* ---------- 2. KPI ---------- */

  /* Periode data terbaru, dan periode sebelumnya (untuk selisih). */
  function findPeriods() {
    const keys = [
      ...new Set(state.rows.map((r) => periodKey(r.year, r.month))),
    ].sort((a, b) => a - b);
    const toPeriod = (k) => ({
      year: Math.floor((k - 1) / 12),
      month: ((k - 1) % 12) + 1,
    });
    return {
      latest: keys.length ? toPeriod(keys[keys.length - 1]) : null,
      previous: keys.length > 1 ? toPeriod(keys[keys.length - 2]) : null,
    };
  }

  function deltaHtml(now, before, previousPeriod) {
    if (before === null) return "";
    const diff = now - before;
    const icon =
      diff > 0 ? "arrow-up-right" : diff < 0 ? "arrow-down-right" : "minus";
    const text =
      diff === 0
        ? "Tetap"
        : `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))} orang`;
    return `<span class="kpi-trend"><i data-lucide="${icon}" aria-hidden="true"></i>${text} vs ${cfg.monthsShort[previousPeriod.month - 1]}</span>`;
  }

  function kpiCard(def, now, before, periods) {
    const value = now[def.key];
    const ariaLabel = `Lihat rincian per unit untuk ${def.name}, ${fmt(value)} orang`;
    return `
      <div class="col-12 col-md-4">
        <article class="kpi-card is-clickable">
          <div class="kpi-top">
            <span class="kpi-icon"><i data-lucide="${def.icon}" aria-hidden="true"></i></span>
            <div class="kpi-names">
              <h3 class="kpi-name">${esc(def.name)}</h3>
              <div class="kpi-full">${esc(def.desc)}</div>
            </div>
          </div>
          <div class="kpi-value">${fmt(value)}<span class="unit">orang</span></div>
          <div class="kpi-bottom">
            <div class="kpi-foot">${deltaHtml(value, before ? before[def.key] : null, periods.previous)}</div>
            <div class="kpi-foot">Data: ${esc(cfg.monthsShort[periods.latest.month - 1])} ${periods.latest.year}</div>
            <div class="kpi-foot"><button type="button" class="kpi-more stretched-link" data-kpi="${esc(def.key)}" aria-haspopup="dialog" aria-label="${esc(ariaLabel)}">Lihat rincian per unit<i data-lucide="chevron-right" aria-hidden="true"></i></button></div>
          </div>
        </article>
      </div>`;
  }

  function renderKpis() {
    const periods = findPeriods();
    state.latest = periods.latest;
    const grid = $("kpiGrid");

    if (!periods.latest) {
      grid.innerHTML = `<div class="col-12"><div class="state-box">Belum ada data karyawan.</div></div>`;
      $("periodLabel").textContent = "-";
      return;
    }
    const now = sum(rowsAt(periods.latest.year, periods.latest.month));
    const before = periods.previous
      ? sum(rowsAt(periods.previous.year, periods.previous.month))
      : null;
    grid.innerHTML = cfg.employeeKpis
      .map((def) => kpiCard(def, now, before, periods))
      .join("");
    $("periodLabel").textContent = periodText(periods.latest);
  }

  /* ---------- 3. Popup rincian per unit ---------- */

  function unitTable(focusKey) {
    const { year, month } = state.latest;
    const byUnit = {};
    rowsAt(year, month).forEach((r) => {
      byUnit[r.unit] = sum(rowsAt(year, month, r.unit));
    });
    const list = Object.keys(byUnit)
      .map((unit) => ({ unit, ...byUnit[unit] }))
      .sort((a, b) => b.total - a.total);
    const grand = sum(rowsAt(year, month));
    const maxTotal = Math.max(1, ...list.map((u) => u.total));
    const cls = (key) => (key === focusKey ? ' class="is-focus"' : "");

    const body = list
      .map(
        (u) => `
        <tr>
          <th scope="row">${esc(u.unit)}</th>
          <td${cls("tetap")}>${fmt(u.tetap)}</td>
          <td${cls("kontrak")}>${fmt(u.kontrak)}</td>
          <td${cls("total")}>
            <span class="emp-total">${fmt(u.total)}</span>
            <span class="emp-bar" aria-hidden="true"><span style="width:${Math.round((u.total / maxTotal) * 100)}%"></span></span>
          </td>
        </tr>`,
      )
      .join("");

    return `
      <div class="table-responsive">
        <table class="table table-sm emp-table">
          <caption class="visually-hidden">Jumlah karyawan per unit kerja, ${esc(periodText(state.latest))}</caption>
          <thead>
            <tr>
              <th scope="col">Unit kerja</th>
              <th scope="col"${cls("tetap")}>Tetap</th>
              <th scope="col"${cls("kontrak")}>Kontrak</th>
              <th scope="col"${cls("total")}>Total</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
          <tfoot>
            <tr>
              <th scope="row">Seluruh unit</th>
              <td${cls("tetap")}>${fmt(grand.tetap)}</td>
              <td${cls("kontrak")}>${fmt(grand.kontrak)}</td>
              <td${cls("total")}>${fmt(grand.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  function openModal(key, trigger) {
    if (!state.latest) return;
    const def = cfg.employeeKpis.find((d) => d.key === key);
    $("empModalTitle").textContent = `Jumlah Karyawan per Unit: ${def.name}`;
    $("empModalSub").textContent =
      `Periode ${periodText(state.latest)}.`;
    $("empModalBody").innerHTML = unitTable(key);

    const modalEl = $("empModal");
    modalEl.addEventListener("hidden.bs.modal", () => trigger.focus(), {
      once: true,
    });
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  /* ---------- 4. Filter ---------- */

  function fillFilters() {
    const units = [...new Set(state.rows.map((r) => r.unit))].sort((a, b) =>
      a.localeCompare(b, "id"),
    );
    const years = [...new Set(state.rows.map((r) => r.year))].sort(
      (a, b) => b - a,
    );

    $("unitSelect").innerHTML =
      `<option value="all">Semua unit</option>` +
      units.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join("");
    $("monthSelect").innerHTML =
      `<option value="all">Semua bulan</option>` +
      cfg.monthsLong
        .map((m, i) => `<option value="${i + 1}">${m}</option>`)
        .join("");
    $("yearSelect").innerHTML = years
      .map((y) => `<option value="${y}">${y}</option>`)
      .join("");

    // Tahun awal = tahun data terbaru.
    state.filters.year = state.latest ? state.latest.year : years[0];
    $("yearSelect").value = String(state.filters.year);
  }

  function bindFilters() {
    const update = () => {
      state.filters.unit = $("unitSelect").value;
      state.filters.month = $("monthSelect").value;
      state.filters.year = Number($("yearSelect").value);
      renderChart();
    };
    ["unitSelect", "monthSelect", "yearSelect"].forEach((id) =>
      $(id).addEventListener("change", update),
    );
  }

  /* ---------- 5. Grafik tren ---------- */

  /* Satu titik per bulan sampai bulan terpilih. Bulan tanpa data = null (garis putus). */
  function monthlySeries() {
    const { unit, month, year } = state.filters;
    const lastMonth = month === "all" ? 12 : Number(month);
    const points = [];
    for (let m = 1; m <= lastMonth; m++) {
      const rows = rowsAt(year, m, unit);
      points.push(rows.length ? sum(rows) : null);
    }
    return points;
  }

  function renderChart() {
    const { unit, year, month } = state.filters;
    const points = monthlySeries();
    const labels = cfg.monthsShort.slice(0, points.length);
    const hasData = points.some((p) => p !== null);

    $("trendSub").textContent =
      `${unit === "all" ? "Seluruh unit" : unit}, ${month === "all" ? "Januari sampai Desember" : `Januari sampai ${cfg.monthsLong[Number(month) - 1]}`} ${year}`;
    $("chartEmpty").hidden = hasData;
    $("trendChart").hidden = !hasData;
    $("chartNote").textContent = hasData
      ? "Garis biru = karyawan tetap; garis putus-putus = karyawan kontrak. Sumbu Y tidak dimulai dari 0."
      : "";

    // Alternatif teks untuk pembaca layar
    $("chartTable").querySelector("tbody").innerHTML = points
      .map(
        (p, i) => `
      <tr><th scope="row">${cfg.monthsLong[i]}</th>
      <td>${p ? fmt(p.tetap) : "Belum ada data"}</td>
      <td>${p ? fmt(p.kontrak) : "Belum ada data"}</td></tr>`,
      )
      .join("");
    $("trendChart").setAttribute(
      "aria-label",
      `Grafik garis tren jumlah karyawan tetap dan kontrak, ${unit === "all" ? "seluruh unit" : unit}, tahun ${year}. Data lengkap ada di tabel tersembunyi di bawah grafik.`,
    );

    if (!hasData) {
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
      return;
    }

    const datasets = [
      {
        label: "Tetap",
        data: points.map((p) => (p ? p.tetap : null)),
        borderColor: "#2563EB",
        backgroundColor: "#2563EB",
        pointStyle: "circle",
        pointRadius: 4,
        tension: 0.25,
        spanGaps: false,
      },
      {
        label: "Kontrak",
        data: points.map((p) => (p ? p.kontrak : null)),
        borderColor: "#0F766E",
        backgroundColor: "#0F766E",
        borderDash: [6, 4],
        pointStyle: "rectRot",
        pointRadius: 5,
        tension: 0.25,
        spanGaps: false,
      },
    ];

    if (state.chart) {
      state.chart.data.labels = labels;
      state.chart.data.datasets = datasets;
      state.chart.update();
      return;
    }

    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.color = "#64748B";
    state.chart = new Chart($("trendChart"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 10 },
          },
          tooltip: {
            callbacks: {
              title: (items) => cfg.monthsLong[items[0].dataIndex],
              label: (item) =>
                item.raw === null
                  ? `${item.dataset.label}: belum ada data`
                  : `${item.dataset.label}: ${fmt(item.raw)} orang`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true },
          },
          y: {
            grace: "10%",
            grid: { color: "#E2E8F0" },
            ticks: { callback: (v) => fmt(v) },
          },
        },
      },
    });
  }

  /* ---------- 6. Mulai ---------- */

  async function load() {
    $("stateLoading").hidden = false;
    $("stateError").hidden = true;
    try {
      const data = await fetchData();
      state.rows = data.rows;
      $("mockBanner").hidden = !data.isMock;
      renderKpis();
      fillFilters();
      renderChart();
      $("employees").hidden = false;
    } catch (err) {
      console.error("[Karyawan]", err);
      $("employees").hidden = true;
      $("stateError").hidden = false;
    } finally {
      $("stateLoading").hidden = true;
      ohsUtils.icons();
    }
  }

  function start() {
    bindFilters();
    $("retryBtn").addEventListener("click", load);
    // Satu listener untuk semua tombol "Lihat rincian" (kartu dibuat ulang oleh JS).
    $("kpiGrid").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-kpi]");
      if (btn) openModal(btn.dataset.kpi, btn);
    });
    load();
  }

  return { start, load, cleanRows, rowsFromCsv };
})();