/* ==========================================================
    dashboard.js
    Merender KPI, chart, dan ringkasan status dari model data.
    File ini TIDAK tahu asal data dan TIDAK menghitung status.
    ========================================================== */

const Dashboard = (() => {
  const $ = (id) => document.getElementById(id);
  const { esc, formatNumber } = ohsUtils;
  const cfg = ohsConfig;

  const EMPTY_TEXT = "No performance data available for this period.";
  const STATUS_CLASS = {
    Good: "status-good",
    Warning: "status-warning",
    Critical: "status-critical",
  };
  // Bentuk titik berbeda per status, supaya status di chart tidak hanya dibedakan lewat warna.
  const STATUS_POINT = {
    Good: "circle",
    Warning: "triangle",
    Critical: "rectRot",
  };
  const STATUS_COLOR = {
    Good: "#16A34A",
    Warning: "#D97706",
    Critical: "#DC2626",
  };

  const state = {
    model: null,
    year: null,
    indicatorId: cfg.defaultIndicator,
    chart: null,
    // state modal detail
    detailChart: null,
    detailModal: null,
    pendingIndicatorId: null,
    lastFocusedCard: null,
  };

  /* ---------- Akses data ---------- */
  const yearData = () =>
    state.model && state.year !== null
      ? state.model.years[String(state.year)] || null
      : null;

  const getIndicator = (id) => {
    const y = yearData();
    return y ? y.indicators.find((i) => i.id === id) || null : null;
  };
  const getIndicatorDef = (id) =>
    cfg.indicators.find((d) => d.id === id) || null;

  /* Bulan terakhir yang punya data (bukan null). */
  const latestEntry = (ind) => {
    const filled = ind.monthly.filter((m) => m.performance !== null);
    return filled.length ? filled[filled.length - 1] : null;
  };
  const previousEntry = (ind, latest) => {
    const earlier = ind.monthly.filter(
      (m) => m.performance !== null && m.month < latest.month,
    );
    return earlier.length ? earlier[earlier.length - 1] : null;
  };

  const badge = (status) => {
    const key = STATUS_CLASS[status] ? status : "none";
    return `<span class="badge-status ${STATUS_CLASS[key] || "status-none"}">${esc(cfg.statusLabels[key])}</span>`;
  };

  /* ---------- Header: tanggal update, banner data contoh ---------- */
  function renderMeta() {
    const meta = state.model.meta;
    $("lastUpdatedValue").textContent = ohsUtils.formatDate(meta.lastUpdated);
    $("mockBanner").hidden = !meta.isMockData;
  }

  /* ---------- Kontrol (select) ---------- */
  function renderControls() {
    const years = Object.keys(state.model.years)
      .map(Number)
      .sort((a, b) => b - a);

    // Pertahankan pilihan lama bila masih ada; jika tidak, pakai default; jika tidak, tahun terbaru.
    if (!years.includes(state.year)) {
      state.year = years.includes(cfg.defaultYear)
        ? cfg.defaultYear
        : (years[0] ?? null);
    }

    const yearOptions = years
      .map(
        (y) =>
          `<option value="${y}"${y === state.year ? " selected" : ""}>${y}</option>`,
      )
      .join("");
    ["yearSelect", "yearSelectChart"].forEach((id) => {
      $(id).innerHTML = yearOptions || `<option value="">-</option>`;
      $(id).disabled = years.length === 0;
    });

    $("indicatorSelect").innerHTML = cfg.indicators
      .map(
        (d) =>
          `<option value="${d.id}"${d.id === state.indicatorId ? " selected" : ""}>${esc(d.name)}</option>`,
      )
      .join("");
  }

  /* ---------- KPI ---------- */
  function kpiCard(def, ind) {
    const latest = ind ? latestEntry(ind) : null;
    const prev = latest ? previousEntry(ind, latest) : null;
    const target = ind && ind.target !== null ? ind.target : null;

    const value = latest
      ? `${formatNumber(latest.performance)}<span class="unit">%</span>`
      : `&ndash;`;

    let trend = "";
    if (latest && prev) {
      const delta =
        Math.round((latest.performance - prev.performance) * 10) / 10;
      const icon =
        delta > 0 ? "arrow-up-right" : delta < 0 ? "arrow-down-right" : "minus";
      const text =
        delta === 0
          ? "Tetap"
          : `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} poin`;
      trend = `<span class="kpi-trend"><i data-lucide="${icon}" aria-hidden="true"></i>${text} vs ${cfg.monthsShort[prev.month - 1]}</span>`;
    }

    const meta = [
      target !== null ? `Target ${formatNumber(target)}%` : null,
      latest
        ? `Data: ${cfg.monthsShort[latest.month - 1]} ${state.year}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const fullName =
      def.fullName && def.fullName !== def.name
        ? `<div class="kpi-full">${esc(def.fullName)}</div>`
        : "";

    // aria-label untuk tombol overlay
    const ariaLabel = latest
      ? `Lihat detail indikator ${def.name}, performa ${formatNumber(latest.performance)} persen, status ${latest.status}`
      : `Lihat detail indikator ${def.name}, belum ada data`;

    // Struktur: <article> sebagai kartu visual + <button> overlay (inset: 0).
    // Heading <h3> tetap di dalam <article> (bukan di dalam <button>),
    // sehingga struktur heading valid & terbaca screen reader.
    return `
      <div class="col-12 col-sm-6 col-xl-3">
        <article class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-icon"><i data-lucide="${def.icon}" aria-hidden="true"></i></span>
            <div class="kpi-names">
              <h3 class="kpi-name">${esc(def.name)}</h3>
              ${fullName}
            </div>
          </div>
          <div class="kpi-value">${value}</div>
          <div class="kpi-bottom">
            <div class="kpi-foot">${badge(latest ? latest.status : null)}${trend}</div>
            <div class="kpi-foot">${esc(meta)}</div>
          </div>
          <span class="kpi-hint">
            <i data-lucide="info" aria-hidden="true"></i>
            Klik untuk melihat detail &amp; penjelasan
          </span>
          <button type="button"
                  class="kpi-card-btn"
                  data-indicator-id="${esc(def.id)}"
                  aria-haspopup="dialog"
                  aria-label="${esc(ariaLabel)}"></button>
        </article>
      </div>`;
  }

  function renderKpis() {
    const grid = $("kpiGrid");
    if (!yearData()) {
      grid.innerHTML = `<div class="col-12"><div class="state-box">${EMPTY_TEXT}</div></div>`;
      $("periodLabel").textContent =
        state.year !== null ? String(state.year) : "-";
      return;
    }
    grid.innerHTML = cfg.indicators
      .map((def) => kpiCard(def, getIndicator(def.id)))
      .join("");

    // Periode: tahun + bulan terakhir yang punya data di antara semua indikator.
    const lastMonth = Math.max(
      0,
      ...cfg.indicators.map((d) => {
        const ind = getIndicator(d.id);
        const l = ind ? latestEntry(ind) : null;
        return l ? l.month : 0;
      }),
    );
    $("periodLabel").textContent = lastMonth
      ? `${state.year} · data s.d. ${cfg.monthsLong[lastMonth - 1]}`
      : String(state.year);
  }

  /* ---------- Ringkasan status ---------- */
  function renderSummary() {
    const list = $("summaryList");
    const sub = $("summarySub");
    if (!yearData()) {
      sub.textContent = "";
      list.innerHTML = `<li>${EMPTY_TEXT}</li>`;
      return;
    }
    sub.textContent = `Status bulan terbaru dari tiap indikator, ${state.year}.`;

    const groups = { Good: [], Warning: [], Critical: [], none: [] };
    cfg.indicators.forEach((def) => {
      const ind = getIndicator(def.id);
      const latest = ind ? latestEntry(ind) : null;
      const key = latest && groups[latest.status] ? latest.status : "none";
      groups[key].push(def.name);
    });

    const order = ["Good", "Warning", "Critical"].concat(
      groups.none.length ? ["none"] : [],
    );
    list.innerHTML = order
      .map((key) => {
        const names = groups[key];
        return `
          <li>
            ${badge(key === "none" ? null : key)}
            <div class="summary-body">
              <div class="summary-names">${names.length ? esc(names.join(", ")) : "Tidak ada indikator"}</div>
            </div>
            <div class="summary-count"><span class="visually-hidden">Jumlah: </span>${names.length}</div>
          </li>`;
      })
      .join("");
  }

  /* ---------- Chart ---------- */
  function setChartEmpty(message) {
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
    $("trendChart").hidden = true;
    $("chartEmpty").textContent = message;
    $("chartEmpty").hidden = false;
    $("chartNote").textContent = "";
    $("chartTable").querySelector("tbody").innerHTML = "";
  }

  function renderChart() {
    const def = cfg.indicators.find((d) => d.id === state.indicatorId);
    const ind = getIndicator(state.indicatorId);
    const hasData = ind && ind.monthly.some((m) => m.performance !== null);

    if (!hasData) {
      setChartEmpty(EMPTY_TEXT);
      return;
    }
    if (typeof Chart === "undefined") {
      setChartEmpty("Grafik tidak dapat dimuat.");
      return;
    }

    $("trendChart").hidden = false;
    $("chartEmpty").hidden = true;

    const labels = cfg.monthsShort;
    const values = ind.monthly.map((m) => m.performance);
    const statuses = ind.monthly.map((m) => m.status);
    const showTarget = cfg.showTargetLine && ind.target !== null;

    // Sumbu Y tidak mulai dari 0 agar variasi terlihat; ini dicatat di bawah chart.
    const nums = values
      .filter((v) => v !== null)
      .concat(showTarget ? [ind.target] : []);
    const yMin = Math.max(0, Math.floor((Math.min(...nums) - 5) / 10) * 10);

    const datasets = [
      {
        label: `${def.name} (%)`,
        data: values,
        borderColor: "#2563EB",
        backgroundColor: "#2563EB",
        borderWidth: 2.5,
        tension: 0.25,
        spanGaps: false,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBorderColor: "#FFFFFF",
        pointBorderWidth: 1.5,
        pointStyle: statuses.map((s) => STATUS_POINT[s] || "circle"),
        pointBackgroundColor: statuses.map((s) => STATUS_COLOR[s] || "#94A3B8"),
      },
    ];
    if (showTarget) {
      datasets.push({
        label: "Target",
        data: labels.map(() => ind.target),
        borderColor: "#64748B",
        borderDash: [6, 6],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      });
    }

    if (state.chart) {
      state.chart.data.labels = labels;
      state.chart.data.datasets = datasets;
      state.chart.options.scales.y.min = yMin;
      state.chart.update();
    } else {
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
            legend: { display: false },
            tooltip: {
              filter: (item) => item.datasetIndex === 0 || item.raw !== null,
              callbacks: {
                title: (items) => cfg.monthsLong[items[0].dataIndex],
                label: (item) => {
                  if (item.datasetIndex === 1)
                    return `Target: ${formatNumber(item.raw)}%`;
                  if (item.raw === null) return "Belum ada data";
                  const status = state.chart.$statuses[item.dataIndex];
                  return (
                    `Performa: ${formatNumber(item.raw)}%` +
                    (status ? ` (${status})` : "")
                  );
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkip: true },
            },
            y: {
              min: yMin,
              suggestedMax: 100,
              grid: { color: "#E2E8F0" },
              ticks: { callback: (v) => `${v}%` },
            },
          },
        },
      });
    }
    state.chart.$statuses = statuses; // dipakai oleh tooltip

    // Catatan di bawah chart
    $("chartNote").textContent =
      (showTarget
        ? `Garis putus-putus = target (${formatNumber(ind.target)}%). `
        : "") +
      "Titik: lingkaran = Good, segitiga = Warning, belah ketupat = Critical.";

    // Alternatif teks untuk pembaca layar
    $("trendChart").setAttribute(
      "aria-label",
      `Grafik garis tren performa bulanan ${def.name} tahun ${state.year}. Data lengkap tersedia di tabel tersembunyi di bawah grafik.`,
    );
    $("chartTable").querySelector("tbody").innerHTML = ind.monthly
      .map(
        (m) => `
        <tr>
          <th scope="row">${cfg.monthsLong[m.month - 1]}</th>
          <td>${m.performance === null ? "Belum ada data" : formatNumber(m.performance) + "%"}</td>
          <td>${m.status ? esc(m.status) : "-"}</td>
        </tr>`,
      )
      .join("");
  }

  /* ==========================================================
     MODAL DETAIL KPI
     ========================================================== */

  /* Kalimat penjelas netral.
    TIDAK menyimpulkan status dari angka, karena aturan bisnis OHS
    belum ditetapkan. Status dibaca langsung dari data. */
  function buildExplanation(ind, def, latest) {
    if (!latest) {
      return "Belum ada data untuk periode ini.";
    }

    const perf      = formatNumber(latest.performance);
    const targetTxt = ind.target !== null
      ? `target ${formatNumber(ind.target)}%`
      : "target belum ditetapkan";
    const statusTxt = latest.status
      ? `status ${latest.status}`
      : "status belum tercatat";

    let sentence = `Performa ${perf}%, ${targetTxt}, ${statusTxt}.`;

    if (def.explanationTemplate) {
      sentence += ` ${def.explanationTemplate}`;
    }
    return sentence;
  }

  /* Buka modal & isi konten. */
  function openDetail(indicatorId) {
    const def = getIndicatorDef(indicatorId);
    const ind = getIndicator(indicatorId);
    if (!def || !ind) return;

    state.lastFocusedCard = document.activeElement;

    const latest = latestEntry(ind);
    const perf = latest ? latest.performance : null;
    const target = ind.target;

    // Header
    $("kpiDetailTitle").textContent =
      def.name +
      (def.fullName && def.fullName !== def.name ? ` — ${def.fullName}` : "");
    $("kpiDetailPeriod").textContent = latest
      ? `Data terakhir: ${cfg.monthsLong[latest.month - 1]} ${state.year}`
      : `Periode: ${state.year} · belum ada data`;

    // Nilai + status + target
    $("kpiDetailValue").textContent =
      perf !== null ? `${formatNumber(perf)}%` : "–";
    const badgeEl = $("kpiDetailStatus");
    const statusKey =
      latest && STATUS_CLASS[latest.status] ? latest.status : "none";
    badgeEl.className = `badge-status ${STATUS_CLASS[statusKey] || "status-none"}`;
    badgeEl.textContent = cfg.statusLabels[statusKey];
    $("kpiDetailTarget").textContent =
      target !== null
        ? `Target: ${formatNumber(target)}%`
        : "Target: belum ditetapkan";

    // Panel penjelasan
    $("kpiDetailExplanation").textContent = buildExplanation(ind, def, latest);
    $("kpiDetailFormula").textContent = def.formulaText || "—";
    $("kpiDetailGood").textContent = def.thresholds?.good || "—";
    $("kpiDetailWarning").textContent = def.thresholds?.warning || "—";
    $("kpiDetailCritical").textContent = def.thresholds?.critical || "—";

    // Tampilkan notice TODO kalau masih placeholder
    const isTodo =
      (def.formulaText || "").trim().toUpperCase().startsWith("TODO") ||
      (def.thresholds?.good || "").trim().toUpperCase() === "TODO";
    $("kpiDetailTodo").hidden = !isTodo;

    // Simpan untuk render chart setelah modal benar-benar tampil
    state.pendingIndicatorId = indicatorId;

    state.detailModal.show();
    ohsUtils.icons();
  }

  /* Render chart di dalam modal. */
  function renderDetailChart(indicatorId) {
    const def = getIndicatorDef(indicatorId);
    const ind = getIndicator(indicatorId);
    if (!def || !ind) return;

    if (state.detailChart) {
      state.detailChart.destroy();
      state.detailChart = null;
    }

    const canvas = $("kpiDetailChart");
    const empty = $("kpiDetailChartEmpty");
    const note = $("kpiDetailChartNote");

    const hasData = ind.monthly.some((m) => m.performance !== null);
    if (!hasData || typeof Chart === "undefined") {
      canvas.hidden = true;
      empty.hidden = false;
      note.textContent = "";
      return;
    }
    canvas.hidden = false;
    empty.hidden = true;

    const labels = cfg.monthsShort;
    const values = ind.monthly.map((m) => m.performance);
    const statuses = ind.monthly.map((m) => m.status);
    const target = ind.target;
    const chartType = ["line", "bar", "doughnut"].includes(def.chartType)
      ? def.chartType
      : "line";

    const statusColors = values.map((v, i) =>
      v === null ? "#E2E8F0" : STATUS_COLOR[statuses[i]] || "#94A3B8",
    );

    const tooltipBase = {
      callbacks: {
        title: (items) => cfg.monthsLong[items[0].dataIndex],
        label: (item) => {
          if (item.datasetIndex === 1)
            return `Target: ${formatNumber(item.raw)}%`;
          if (item.raw === null) return "Belum ada data";
          const st = statuses[item.dataIndex];
          return (
            `Performa: ${formatNumber(item.raw)}%` + (st ? ` (${st})` : "")
          );
        },
      },
    };

    let config;

    if (chartType === "bar") {
      const datasets = [
        {
          type: "bar",
          label: `${def.name} (%)`,
          data: values,
          backgroundColor: statusColors,
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ];
      if (target !== null) {
        datasets.push({
          type: "line",
          label: "Target",
          data: labels.map(() => target),
          borderColor: "#64748B",
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        });
      }
      config = {
        type: "bar",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, padding: 16 },
            },
            tooltip: tooltipBase,
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: 110,
              grid: { color: "#E2E8F0" },
              ticks: { callback: (v) => `${v}%` },
            },
            x: { grid: { display: false } },
          },
        },
      };
    } else if (chartType === "doughnut") {
      const counts = { Good: 0, Warning: 0, Critical: 0 };
      statuses.forEach((s) => {
        if (s) counts[s] = (counts[s] || 0) + 1;
      });
      config = {
        type: "doughnut",
        data: {
          labels: ["Good", "Warning", "Critical"],
          datasets: [
            {
              data: [counts.Good, counts.Warning, counts.Critical],
              backgroundColor: [
                STATUS_COLOR.Good,
                STATUS_COLOR.Warning,
                STATUS_COLOR.Critical,
              ],
              borderColor: "#fff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "60%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, padding: 16 },
            },
            tooltip: {
              callbacks: { label: (c) => `${c.label}: ${c.parsed} bulan` },
            },
          },
        },
      };
    } else {
      const datasets = [
        {
          label: `${def.name} (%)`,
          data: values,
          borderColor: "#2563EB",
          backgroundColor: "rgba(37, 99, 235, 0.10)",
          borderWidth: 2.5,
          tension: 0.25,
          spanGaps: false,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 1.5,
          pointStyle: statuses.map((s) => STATUS_POINT[s] || "circle"),
          pointBackgroundColor: statuses.map(
            (s) => STATUS_COLOR[s] || "#94A3B8",
          ),
          fill: true,
        },
      ];
      if (target !== null) {
        datasets.push({
          label: "Target",
          data: labels.map(() => target),
          borderColor: "#64748B",
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        });
      }
      config = {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, padding: 16 },
            },
            tooltip: tooltipBase,
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: 110,
              grid: { color: "#E2E8F0" },
              ticks: { callback: (v) => `${v}%` },
            },
            x: { grid: { display: false } },
          },
        },
      };
    }

    state.detailChart = new Chart(canvas, config);

    // Catatan di bawah chart modal
    const bits = [];
    if (target !== null)
      bits.push(`Garis putus-putus = target (${formatNumber(target)}%).`);
    if (chartType === "doughnut")
      bits.push("Diagram menunjukkan distribusi status per bulan.");
    else
      bits.push("Titik/bar: hijau = Good, kuning = Warning, merah = Critical.");
    note.textContent = bits.join(" ");
  }

  /* Init modal (sekali). */
  function initDetailModal() {
    if (!cfg.kpiDetailEnabled) return;
    const modalEl = $("kpiDetailModal");
    if (!modalEl) return;

    state.detailModal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Render chart setelah modal benar-benar tampil → canvas punya ukuran.
    modalEl.addEventListener("shown.bs.modal", () => {
      if (state.pendingIndicatorId) {
        renderDetailChart(state.pendingIndicatorId);
        state.pendingIndicatorId = null;
      }
    });

    // Bersihkan chart & kembalikan fokus saat modal tertutup.
    modalEl.addEventListener("hidden.bs.modal", () => {
      if (state.detailChart) {
        state.detailChart.destroy();
        state.detailChart = null;
      }
      if (
        state.lastFocusedCard &&
        typeof state.lastFocusedCard.focus === "function"
      ) {
        state.lastFocusedCard.focus();
      }
      state.lastFocusedCard = null;
    });
  }

  /* ---------- Render semua ---------- */
  function renderAll() {
    renderKpis();
    renderSummary();
    renderChart();
    ohsUtils.icons();
  }

  /* Dipanggil setiap kali data (re)load. */
  function render(model) {
    state.model = model;
    renderMeta();
    renderControls();
    renderAll();
  }

  /* ---------- Bind kontrol ---------- */
  /* Dipasang sekali saat start. */
  function bindControls() {
    $("indicatorSelect").addEventListener("change", (e) => {
      state.indicatorId = e.target.value;
      renderChart();
    });

    const onYear = (e) => {
      state.year = Number(e.target.value);
      $("yearSelect").value = $("yearSelectChart").value = String(state.year);
      renderAll();
    };
    $("yearSelect").addEventListener("change", onYear);
    $("yearSelectChart").addEventListener("change", onYear);

    // Delegasi klik kartu KPI → buka modal
    if (cfg.kpiDetailEnabled) {
      $("kpiGrid").addEventListener("click", (e) => {
        const btn = e.target.closest(".kpi-card-btn");
        if (btn && btn.dataset.indicatorId) openDetail(btn.dataset.indicatorId);
      });

      // Dukungan keyboard: Enter/Space pada <button> sudah otomatis
      // memicu 'click' di semua browser modern.
      initDetailModal();
    }
  }

  return { render, bindControls };
})();
