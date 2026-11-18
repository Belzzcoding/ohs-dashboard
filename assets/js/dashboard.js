/* ==========================================================
    dashboard.js
    Merender skor total, KPI, chart, dan ringkasan status dari model data.
    File ini TIDAK tahu asal data. Skor dan status sudah dihitung oleh
    scoring.js (lewat data-service.js); di sini hanya ditampilkan.
   ========================================================= */

const Dashboard = (() => {
  const $ = (id) => document.getElementById(id);
  const { esc, formatNumber } = ohsUtils;
  const cfg = ohsConfig;

  const EMPTY_TEXT = "No performance data available for this period.";
  // Status: "met" | "notMet" | null. Label, kelas, warna, dan bentuk titik ada di ohsConfig.statuses.
  // Bentuk titik berbeda per status, supaya status di chart tidak hanya dibedakan lewat warna.
  const statusDef = (status) => cfg.statuses[status] || cfg.statuses.none;

  const state = {
    model: null,
    year: null,
    month: null,
    indicatorId: cfg.defaultIndicator,
    chart: null,
    totalChart: null,
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

  /* Bulan terakhir yang punya data di antara semua indikator tahun aktif. */
  const latestDataMonth = () => {
    const y = yearData();
    if (!y) return null;
    let latest = 0;
    y.indicators.forEach((ind) => {
      ind.monthly.forEach((m) => {
        if (m.performance !== null) latest = Math.max(latest, m.month);
      });
    });
    return latest || null;
  };

  /* Entri indikator untuk bulan yang sedang dipilih di header. */
  const selectedEntry = (ind) =>
    ind && state.month ? ind.monthly[state.month - 1] || null : null;

  const previousEntry = (ind, latest) => {
    const earlier = ind.monthly.filter(
      (m) => m.performance !== null && m.month < latest.month,
    );
    return earlier.length ? earlier[earlier.length - 1] : null;
  };

  const badge = (status) => {
    const d = statusDef(status);
    return `<span class="badge-status ${d.cls}">${esc(d.label)}</span>`;
  };

  const defOf = (id) => cfg.indicators.find((d) => d.id === id);

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

    // Bulan aktif harus punya data di tahun terpilih; jika tidak, pakai bulan terakhir yang tersedia.
    const y = yearData();
    const monthHasData =
      y &&
      state.month !== null &&
      y.indicators.some((ind) => {
        const entry = ind.monthly[state.month - 1];
        return (
          entry && (entry.performance !== null || entry.realisasi !== null)
        );
      });
    if (!monthHasData) state.month = latestDataMonth() || 1;

    $("monthSelect").innerHTML = cfg.monthsShort
      .map(
        (label, i) =>
          `<option value="${i + 1}"${i + 1 === state.month ? " selected" : ""}>${esc(label)}</option>`,
      )
      .join("");
    $("monthSelect").disabled = !y;

    $("indicatorSelect").innerHTML = cfg.indicators
      .map(
        (d) =>
          `<option value="${d.id}"${d.id === state.indicatorId ? " selected" : ""}>${esc(d.name)}</option>`,
      )
      .join("");
  }

  /* ---------- KPI ---------- */
  function kpiCard(def, ind) {
    const current = selectedEntry(ind);
    const hasScore = current && current.performance !== null;
    const prev = hasScore ? previousEntry(ind, current) : null;

    const value = hasScore
      ? `${formatNumber(current.performance)}<span class="unit">%</span>`
      : `&ndash;`;

    let trend = "";
    if (hasScore && prev) {
      const delta =
        Math.round((current.performance - prev.performance) * 10) / 10;
      const icon =
        delta > 0 ? "arrow-up-right" : delta < 0 ? "arrow-down-right" : "minus";
      const text =
        delta === 0
          ? "Tetap"
          : `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} poin`;
      trend = `<span class="kpi-trend"><i data-lucide="${icon}" aria-hidden="true"></i>${text} vs ${cfg.monthsShort[prev.month - 1]}</span>`;
    }

    const meta = current ? Scoring.summaryText(def, current) : "";
    const ytdLine =
      hasScore && cfg.scoring.showYtd && current.ytd
        ? `<div class="kpi-foot kpi-ytd">${esc(Scoring.ytdText(def, current.ytd))}</div>`
        : "";

    const ariaLabel = hasScore
      ? `Lihat detail indikator ${def.name}, ${cfg.monthsLong[current.month - 1]} ${state.year}, skor ${formatNumber(current.performance)} persen, status ${statusDef(current.status).label}`
      : `Lihat detail indikator ${def.name}, belum ada data untuk ${cfg.monthsLong[state.month - 1]} ${state.year}`;

    const fullName =
      def.fullName && def.fullName !== def.name
        ? `<div class="kpi-full">${esc(def.fullName)}</div>`
        : "";

    return `
      <div class="col-12 col-sm-6 col-xl-3">
        <article class="kpi-card is-clickable">
          <div class="kpi-top">
            <span class="kpi-icon"><i data-lucide="${def.icon}" aria-hidden="true"></i></span>
            <div class="kpi-names">
              <h3 class="kpi-name">${esc(def.name)}</h3>
              ${fullName}
            </div>
          </div>
          <div class="kpi-value">${value}</div>
          <div class="kpi-bottom">
            <div class="kpi-foot">${badge(current ? current.status : null)}${trend}</div>
            <div class="kpi-foot">${esc(meta)}</div>
            ${ytdLine}
            <div class="kpi-foot"><button type="button" class="kpi-more stretched-link" data-indicator-id="${esc(def.id)}" aria-haspopup="dialog" aria-label="${esc(ariaLabel)}">Lihat detail<i data-lucide="chevron-right" aria-hidden="true"></i></button></div>
          </div>
        </article>
      </div>`;
  }

  function renderKpis() {
    const grid = $("kpiGrid");
    const y = yearData();
    if (!y) {
      grid.innerHTML = `<div class="col-12"><div class="state-box">${EMPTY_TEXT}</div></div>`;
      $("periodLabel").textContent = "-";
      return;
    }
    grid.innerHTML = cfg.indicators
      .map((def) => kpiCard(def, getIndicator(def.id)))
      .join("");

    const monthName = cfg.monthsLong[state.month - 1];
    const hasData = y.indicators.some((ind) => {
      const entry = ind.monthly[state.month - 1];
      return entry && (entry.performance !== null || entry.realisasi !== null);
    });
    $("periodLabel").textContent = hasData
      ? `${monthName} ${state.year}`
      : `${monthName} ${state.year} · belum ada data`;
  }

  /* ---------- Skor total ----------
     Skor bulan yang sedang dipilih di header. Bila kedelapan indikator belum
     terisi pada bulan itu, skor total tidak ditampilkan (tidak memakai bulan lain). */
  function renderTotal() {
    const box = $("totalCard");
    const y = yearData();
    const month = state.month || 1;
    const totals = y ? Scoring.totalByMonth(y.indicators) : [];
    const totalsYtd = y ? Scoring.totalByMonth(y.indicators, "ytd") : [];
    const cur = totals[month - 1] || null;
    const hasTotal = cur && cur.total !== null;
    const monthName = cfg.monthsLong[month - 1];
    const yearLabel = state.year ?? "-";
    const ytdCur = totalsYtd[month - 1] || null;
    const useYtd =
      hasTotal && cfg.scoring.showYtd && ytdCur && ytdCur.total !== null;
    const main = useYtd ? ytdCur : cur;
    const sourceTotals = useYtd ? totalsYtd : totals;
    const prev = hasTotal
      ? sourceTotals
          .slice(0, month - 1)
          .reverse()
          .find((t) => t.total !== null) || null
      : null;
    const status = hasTotal ? (main.passed ? "met" : "notMet") : null;
    const when = month === 1 ? monthName : `Januari–${monthName}`;

    let trend = "";
    if (hasTotal && prev && prev.total !== null) {
      const delta = Math.round((main.total - prev.total) * 10) / 10;
      const icon =
        delta > 0 ? "arrow-up-right" : delta < 0 ? "arrow-down-right" : "minus";
      const text =
        delta === 0
          ? "Tetap"
          : `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} poin`;
      trend = `<span class="kpi-trend"><i data-lucide="${icon}" aria-hidden="true"></i>${text} vs ${cfg.monthsShort[prev.month - 1]}</span>`;
    }

    const basis = hasTotal
      ? useYtd
        ? `Target ≥ ${cfg.scoring.totalTarget}% · YTD ${esc(when)} ${yearLabel}`
        : cfg.scoring.showYtd
          ? `Target ≥ ${cfg.scoring.totalTarget}% · skor bulan ${esc(monthName)} ${yearLabel} (YTD belum lengkap)`
          : `Target ≥ ${cfg.scoring.totalTarget}% · skor bulan ${esc(monthName)} ${yearLabel}`
      : `Target ≥ ${cfg.scoring.totalTarget}% · skor bulan ${esc(monthName)} ${yearLabel}`;
    const monthLine = useYtd
      ? `<p class="total-sub">Skor bulan ${esc(monthName)}: ${formatNumber(cur.total)}%</p>`
      : "";

    let totalMain;
    let details;
    if (hasTotal) {
      const rows = cfg.indicators
        .map((def) => {
          const entry = getIndicator(def.id).monthly[month - 1];
          const score = useYtd ? entry.ytd.performance : entry.performance;
          const points = (def.weight / 100) * score;
          return `
        <tr>
          <th scope="row">${esc(def.name)}</th>
          <td>${def.weight}%</td>
          <td>${formatNumber(score)}%</td>
          <td>${formatNumber(points)}</td>
        </tr>`;
        })
        .join("");

      totalMain = `
        <div class="total-main">
          <div class="total-label">${esc(cfg.scoring.totalLabel)}</div>
          <div class="total-value">${formatNumber(main.total)}<span class="unit">%</span></div>
          <div class="kpi-foot">${badge(status)}${trend}</div>
          <p class="total-sub">${basis}</p>
          ${monthLine}
        </div>`;
      details = `
        <details class="total-detail">
          <summary>Lihat perhitungan skor total</summary>
          <table class="table table-sm total-table">
            <caption class="visually-hidden">Kontribusi tiap indikator pada skor total ${useYtd ? "YTD " + esc(when) : esc(monthName)} ${yearLabel}</caption>
            <thead><tr><th scope="col">Indikator</th><th scope="col">Bobot</th><th scope="col">Skor${useYtd ? " YTD" : ""}</th><th scope="col">Poin</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><th scope="row">Total</th><td>100%</td><td></td><td>${formatNumber(main.total)}</td></tr></tfoot>
          </table>
        </details>`;
    } else {
      const hasAnyData =
        y &&
        y.indicators.some((ind) => {
          const entry = ind.monthly[month - 1];
          return (
            entry && (entry.realisasi !== null || entry.performance !== null)
          );
        });
      const message = hasAnyData
        ? `Skor total bulan ${esc(monthName)} ${yearLabel} belum dapat dihitung karena belum semua indikator terisi.`
        : `Belum ada data untuk bulan ${esc(monthName)} ${yearLabel}.`;
      totalMain = `
        <div class="total-main">
          <div class="total-label">${esc(cfg.scoring.totalLabel)}</div>
          <div class="total-value">&ndash;</div>
          <div class="kpi-foot">${badge(null)}</div>
          <p class="total-sub">${message}</p>
          <p class="total-sub">${basis}</p>
        </div>`;
      details = `<p class="total-note">Rincian kontribusi indikator tampil setelah kedelapan indikator terisi pada bulan yang sama.</p>`;
    }

    box.innerHTML = `
      ${totalMain}
      <div class="total-chart">
        <div class="total-chart-head">
          <span class="total-chart-title">Tren Skor Total ${state.year ?? "-"}</span>
          <span class="total-chart-badge">Target ≥ ${cfg.scoring.totalTarget}%</span>
        </div>
        <div class="total-chart-wrap">
          <canvas id="totalChart" role="img" aria-label="Grafik tren skor total Safety Performance tahun ${state.year ?? "-"}"></canvas>
          <div class="chart-empty" id="totalChartEmpty" hidden>Belum ada data skor total untuk tahun ini.</div>
        </div>
        <div class="visually-hidden">
          <table id="totalChartTable">
            <caption>Data skor total per bulan ${state.year ?? "-"}</caption>
            <thead><tr><th scope="col">Bulan</th><th scope="col">Skor total</th><th scope="col">Status</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      ${details}`;
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
    sub.textContent = `Status bulan ${cfg.monthsLong[state.month - 1]} ${state.year} dari tiap indikator.`;

    const groups = { met: [], notMet: [], none: [] };
    cfg.indicators.forEach((def) => {
      const ind = getIndicator(def.id);
      const current = selectedEntry(ind);
      const key =
        current && groups[current.status] ? current.status : "none";
      groups[key].push(def.name);
    });

    const order = ["met", "notMet"].concat(groups.none.length ? ["none"] : []);
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
    const def = defOf(state.indicatorId);
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
    const realisasiText = ind.monthly.map((m) =>
      m.realisasi === null ? null : Scoring.actualText(def, m),
    );

    // Sumbu Y tidak mulai dari 0 agar variasi terlihat; ini dicatat di bawah chart.
    const nums = values
      .filter((v) => v !== null)
      .concat(showTarget ? [ind.target] : []);
    const lowest = Math.min(...nums);
    const yMin =
      lowest < 0
        ? Math.floor(lowest / 10) * 10
        : Math.max(0, Math.floor((lowest - 5) / 10) * 10);

    const datasets = [
      {
        label: `${def.name} (skor %)`,
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
        pointStyle: statuses.map((s) => statusDef(s).point),
        pointBackgroundColor: statuses.map((s) => statusDef(s).color),
      },
    ];
    if (showTarget) {
      datasets.push({
        label: "Batas Tercapai",
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
                    return `Batas Tercapai: skor ${formatNumber(item.raw)}%`;
                  if (item.raw === null) return "Belum ada data";
                  const i = item.dataIndex;
                  return `Skor: ${formatNumber(item.raw)}% · Realisasi ${state.chart.$real[i]} (${statusDef(state.chart.$statuses[i]).label})`;
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
    state.chart.$real = realisasiText;

    // Catatan di bawah chart
    $("chartNote").textContent =
      (showTarget
        ? `Garis putus-putus = batas Tercapai (skor ${formatNumber(ind.target)}%). `
        : "") +
      "Titik: lingkaran = Tercapai, belah ketupat = Belum tercapai. Nilai per bulan (bukan kumulatif). Sumbu Y tidak dimulai dari 0.";

    // Alternatif teks untuk pembaca layar
    $("trendChart").setAttribute(
      "aria-label",
      `Grafik garis tren skor bulanan ${def.name} tahun ${state.year}. Data lengkap tersedia di tabel tersembunyi di bawah grafik.`,
    );
    $("chartTable").querySelector("tbody").innerHTML = ind.monthly
      .map(
        (m) => `
      <tr>
        <th scope="row">${cfg.monthsLong[m.month - 1]}</th>
        <td>${m.realisasi === null ? "Belum ada data" : esc(Scoring.actualText(def, m))}</td>
        <td>${m.performance === null ? "-" : formatNumber(m.performance) + "%"}</td>
        <td>${m.status ? esc(statusDef(m.status).label) : "-"}</td>
      </tr>`,
      )
      .join("");
  }

  /* ---------- Chart tren skor total (kartu Skor Safety Performance) ---------- */
  function setTotalChartEmpty(message) {
    if (state.totalChart) {
      state.totalChart.destroy();
      state.totalChart = null;
    }
    const canvas = $("totalChart");
    if (canvas) canvas.hidden = true;
    const empty = $("totalChartEmpty");
    if (empty) {
      empty.textContent = message;
      empty.hidden = false;
    }
    const tbody = $("totalChartTable")?.querySelector("tbody");
    if (tbody) tbody.innerHTML = "";
  }

  function renderTotalChart() {
    const y = yearData();
    const totals = y ? Scoring.totalByMonth(y.indicators) : [];
    const hasData = totals.some((t) => t.total !== null);
    if (!hasData) {
      setTotalChartEmpty("Belum ada data skor total untuk tahun ini.");
      return;
    }
    if (typeof Chart === "undefined") {
      setTotalChartEmpty("Grafik tidak dapat dimuat.");
      return;
    }

    const canvas = $("totalChart");
    if (!canvas) return;
    canvas.hidden = false;
    const empty = $("totalChartEmpty");
    if (empty) empty.hidden = true;

    const labels = cfg.monthsShort;
    const values = totals.map((t) => t.total);
    const selectedIndex = state.month - 1;
    const numbered = values.filter((v) => v !== null);
    const lowest = Math.min(...numbered);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 170);
    gradient.addColorStop(0, "rgba(37, 99, 235, 0.24)");
    gradient.addColorStop(1, "rgba(37, 99, 235, 0)");

    if (state.totalChart) {
      state.totalChart.destroy();
      state.totalChart = null;
    }

    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.color = "#64748B";
    state.totalChart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Skor total",
            data: values,
            borderColor: "#2563EB",
            backgroundColor: gradient,
            fill: true,
            borderWidth: 2.5,
            tension: 0.4,
            spanGaps: false,
            pointRadius: (context) =>
              context.dataIndex === selectedIndex && context.raw !== null
                ? 5
                : 0,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2563EB",
            pointBorderColor: "#FFFFFF",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.raw !== null,
            callbacks: {
              title: (items) =>
                `${cfg.monthsLong[items[0].dataIndex]} ${state.year}`,
              label: (item) => {
                const passed = item.raw >= cfg.scoring.totalTarget;
                return `Skor total: ${formatNumber(item.raw)}% · ${statusDef(passed ? "met" : "notMet").label}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, font: { size: 10 } },
          },
          y: {
            display: false,
            suggestedMin: Math.max(0, lowest - 5),
            suggestedMax: 100,
          },
        },
      },
    });

    canvas.setAttribute(
      "aria-label",
      `Grafik tren skor total Safety Performance tahun ${state.year}. Bulan terpilih: ${cfg.monthsLong[selectedIndex]}. Data lengkap tersedia di tabel tersembunyi.`,
    );

    const tbody = $("totalChartTable")?.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = totals
        .map(
          (t, i) => `
        <tr${i === selectedIndex ? ' class="is-latest"' : ""}>
          <th scope="row">${cfg.monthsLong[i]}</th>
          <td>${t.total === null ? "Belum lengkap" : formatNumber(t.total) + "%"}</td>
          <td>${t.total === null ? "&ndash;" : esc(statusDef(t.passed ? "met" : "notMet").label)}</td>
        </tr>`,
        )
        .join("");
    }
  }

  /* ---------- Popup detail KPI ----------
     Klik kartu KPI -> popup: skor + status + realisasi, grafik (chartType dari config),
     penjelasan hitungan, rumus, batas Tercapai, bobot. Skor dan status dihitung oleh
     scoring.js dari aturan di ohsConfig.indicators; popup hanya menampilkannya. */
  const modal = { id: null, chart: null };
  const textOrEmpty = (v) =>
    v && String(v).trim()
      ? esc(v)
      : '<span class="kpi-note-empty">Belum ditetapkan</span>';

  /* Kalimat penjelas: hitungan bulan itu dari Scoring.explain, plus baris YTD bila ada. */
  function buildExplanation(def, latest) {
    if (!latest)
      return "Belum ada data untuk periode ini sehingga skor belum dapat dihitung.";
    const ytd =
      cfg.scoring.showYtd && latest.ytd
        ? ` ${Scoring.ytdText(def, latest.ytd)}.`
        : "";
    return esc(
      `Bulan ${cfg.monthsLong[latest.month - 1]} ${state.year}. ${Scoring.explain(def, latest.realisasi, latest.target)}${ytd}`,
    );
  }

  function modalBodyHtml(def, ind) {
    const current = selectedEntry(ind);
    const hasScore = current && current.performance !== null;
    const unit = '<span class="unit">%</span>';
    const hasData = ind.monthly.some((m) => m.performance !== null);
    const type = ["line", "bar", "doughnut"].includes(def.chartType)
      ? def.chartType
      : "line";
    const typeName = { line: "garis", bar: "batang", doughnut: "donat" }[type];
    // Ada aturan yang masih asumsi sementara (menunggu konfirmasi unit OHS)?
    const assumed = def.assumed;

    const headline = `
      <div class="kpi-headline">
        <div class="kpi-big">${hasScore ? formatNumber(current.performance) + unit : "&ndash;"}</div>
        <div>${badge(hasScore ? current.status : null)}</div>
        <div class="kpi-target">${current ? esc(Scoring.summaryText(def, current)) : "Target " + esc(Scoring.targetText(def))}</div>
      </div>`;

    const note = {
      line: "Titik: lingkaran = Tercapai, belah ketupat = Belum tercapai. Garis putus-putus = batas Tercapai. Sumbu Y tidak dimulai dari 0.",
      bar: "Hijau: Tercapai, Merah: Belum tercapai). Garis putus-putus = batas Tercapai.",
      doughnut:
        "Donat menunjukkan berapa bulan berstatus Tercapai dan Belum tercapai pada tahun ini (hanya bulan yang sudah ada datanya).",
    }[type];

    const chartBox = `
      <h3 class="kpi-sec-title">Grafik bulanan ${state.year}</h3>
      ${
        hasData
          ? `<div class="kpi-chart-wrap"><canvas id="kpiModalChart" role="img" aria-label="Grafik ${typeName} ${esc(def.name)} tahun ${state.year}. Data lengkap ada di tabel di bawah penjelasan."></canvas></div>
            <p class="chart-note">${note}</p>`
          : '<div class="state-box">Belum ada data untuk periode ini.</div>'
      }`;

    const why = `
      <section class="kpi-why" aria-labelledby="kpiWhyTitle">
        <h3 class="kpi-sec-title" id="kpiWhyTitle">Mengapa nilainya demikian?</h3>
        <p class="kpi-explain">${buildExplanation(def, current)}</p>
        ${def.explanationTemplate && String(def.explanationTemplate).trim() ? `<p class="kpi-explain">${esc(def.explanationTemplate)}</p>` : ""}
        <dl class="kpi-notes">
          <dt>Rumus</dt>
          <dd>${textOrEmpty(def.formulaText)}</dd>
          <dt>Batas Tercapai</dt><dd>${esc(Scoring.targetText(def, current ? current.target : null))}</dd>
          <dt>Bobot skor total</dt><dd>${def.weight}%</dd>
          <dt>Sumber aturan</dt><dd>${esc(cfg.scoring.sourceNote)}</dd>
        </dl>
        ${
          assumed
            ? '<div class="kpi-notice" role="note"><i data-lucide="triangle-alert" aria-hidden="true"></i><span>' +
              esc(
                def.assumedNote ||
                  "Sebagian aturan indikator ini masih asumsi sementara menunggu konfirmasi unit OHS.",
              ) +
              "</span></div>"
            : ""
        }
        ${state.model.meta.isMockData ? '<p class="kpi-mock">Ini data contoh: angka dan status hanya placeholder pengembangan.</p>' : ""}
      </section>`;

    const table = `
      <h3 class="kpi-sec-title">Data per bulan ${state.year}</h3>
      <table class="table table-sm kpi-table">
        <caption class="visually-hidden">Realisasi bulanan, skor, dan status ${esc(def.name)} per bulan, tahun ${state.year}</caption>
        <thead><tr><th scope="col">Bulan</th><th scope="col">Realisasi</th><th scope="col">Skor</th><th scope="col">Status</th></tr></thead>
        <tbody>${ind.monthly
          .map(
            (m) => `
          <tr${current && m.month === current.month ? ' class="is-latest"' : ""}>
            <th scope="row">${cfg.monthsLong[m.month - 1]}</th>
            <td>${m.realisasi === null ? '<span class="kpi-muted">Belum ada data</span>' : esc(Scoring.actualText(def, m))}</td>
            <td>${m.performance === null ? "&ndash;" : formatNumber(m.performance) + "%"}</td>
            <td>${m.performance === null ? "&ndash;" : badge(m.status)}</td>
          </tr>`,
          )
          .join("")}
        </tbody>
      </table>`;

    return headline + chartBox + table;
  }

  function destroyModalChart() {
    if (modal.chart) {
      modal.chart.destroy();
      modal.chart = null;
    }
  }

  /* Digambar SETELAH popup tampil (canvas harus punya ukuran). */
  function drawModalChart() {
    const def = defOf(modal.id);
    const ind = getIndicator(modal.id);
    const canvas = $("kpiModalChart");
    if (!def || !ind || !canvas || typeof Chart === "undefined") return;
    destroyModalChart();

    const type = ["line", "bar", "doughnut"].includes(def.chartType)
      ? def.chartType
      : "line";
    const labels = cfg.monthsShort;
    const values = ind.monthly.map((m) => m.performance);
    const statuses = ind.monthly.map((m) => m.status);
    const target = ind.target;
    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.color = "#64748B";
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
    };

    /* ----- Donat: sebaran status per bulan (bukan "sisa menuju 100%") ----- */
    if (type === "doughnut") {
      const keys = ["met", "notMet"];
      const counts = keys.map(
        (k) => statuses.filter((s, i) => values[i] !== null && s === k).length,
      );
      modal.chart = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: keys.map(
            (k, i) => `${statusDef(k).label}: ${counts[i]} bulan`,
          ),
          datasets: [
            {
              data: counts,
              backgroundColor: keys.map((k) => statusDef(k).color),
              borderColor: "#FFFFFF",
              borderWidth: 2,
            },
          ],
        },
        options: {
          ...base,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { usePointStyle: true, boxWidth: 10 },
            },
          },
        },
      });
      return;
    }

    /* ----- Garis / batang ----- */
    const prevYear = state.model.years[String(state.year - 1)];
    const prevInd = prevYear
      ? prevYear.indicators.find((i) => i.id === modal.id)
      : null;
    const prevValues =
      type === "line" && prevInd
        ? prevInd.monthly.map((m) => m.performance)
        : null;
    const hasPrev = Boolean(prevValues && prevValues.some((v) => v !== null));

    const nums = values
      .concat(hasPrev ? prevValues : [])
      .filter((v) => v !== null)
      .concat(target !== null ? [target] : []);
    // Batang harus mulai dari 0; garis boleh dipotong agar variasi terlihat.
    const lowest = Math.min(...nums);
    const yMin =
      type === "bar"
        ? Math.min(0, Math.floor(lowest / 10) * 10)
        : lowest < 0
          ? Math.floor(lowest / 10) * 10
          : Math.max(0, Math.floor((lowest - 5) / 10) * 10);

    const main =
      type === "bar"
        ? {
            type: "bar",
            label: String(state.year),
            data: values,
            backgroundColor: statuses.map((s) => statusDef(s).color),
            borderRadius: 4,
            maxBarThickness: 36,
          }
        : {
            type: "line",
            label: String(state.year),
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
            pointStyle: statuses.map((s) => statusDef(s).point),
            pointBackgroundColor: statuses.map((s) => statusDef(s).color),
          };
    const datasets = [main];
    if (hasPrev) {
      datasets.push({
        type: "line",
        label: String(state.year - 1),
        data: prevValues,
        borderColor: "#94A3B8",
        backgroundColor: "#94A3B8",
        borderWidth: 1.5,
        tension: 0.25,
        spanGaps: false,
        pointRadius: 2,
        pointHoverRadius: 4,
      });
    }
    if (target !== null) {
      datasets.push({
        type: "line",
        label: "Batas Tercapai",
        data: labels.map(() => target),
        borderColor: "#64748B",
        backgroundColor: "#64748B",
        borderDash: [6, 6],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
      });
    }

    modal.chart = new Chart(canvas, {
      type: type,
      data: { labels, datasets },
      options: {
        ...base,
        interaction: { mode: "index", intersect: false },
        plugins: {
          // Legenda batang sengaja dimatikan (warna batang = status, dijelaskan di catatan).
          legend:
            type === "bar"
              ? { display: false }
              : {
                  position: "bottom",
                  labels: {
                    usePointStyle: true,
                    pointStyle: "line",
                    boxWidth: 28,
                  },
                },
          tooltip: {
            filter: (item) => item.raw !== null,
            callbacks: {
              title: (items) => cfg.monthsLong[items[0].dataIndex],
              label: (item) => {
                if (item.dataset.label === "Batas Tercapai")
                  return `Batas Tercapai: skor ${formatNumber(item.raw)}%`;
                if (item.datasetIndex !== 0)
                  return `${item.dataset.label}: skor ${formatNumber(item.raw)}%`;
                const m = ind.monthly[item.dataIndex];
                return `Skor: ${formatNumber(item.raw)}% · Realisasi ${Scoring.actualText(def, m)} (${statusDef(m.status).label})`;
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
            ticks: { callback: (v) => `${v}%`, maxTicksLimit: 6 },
          },
        },
      },
    });
  }

  function openKpiModal(id) {
    const def = defOf(id);
    const ind = getIndicator(id);
    if (!def || !ind) return;
    const current = selectedEntry(ind);
    modal.id = id;
    $("kpiDetailTitle").textContent = def.name;
    $("kpiModalSub").textContent =
      (def.fullName && def.fullName !== def.name ? def.fullName + " · " : "") +
      (current
        ? `Data: ${cfg.monthsLong[current.month - 1]} ${state.year}`
        : `Bulan ${cfg.monthsLong[state.month - 1]} ${state.year}`);
    $("kpiModalBody").innerHTML = modalBodyHtml(def, ind);
    ohsUtils.icons();
    bootstrap.Modal.getOrCreateInstance($("kpiModal")).show();
  }

  /* Dipasang sekali: klik kartu (tombol "Lihat detail" membentang di seluruh kartu),
     gambar chart setelah tampil, bersihkan + kembalikan fokus saat ditutup. */
  function bindKpiModal() {
    const el = $("kpiModal");
    if (!el) return;
    $("kpiGrid").addEventListener("click", (e) => {
      const btn = e.target.closest(".kpi-more");
      if (btn) openKpiModal(btn.dataset.indicatorId);
    });
    el.addEventListener("shown.bs.modal", drawModalChart);
    el.addEventListener("hidden.bs.modal", () => {
      destroyModalChart();
      $("kpiModalBody").innerHTML = "";
      const back = document.querySelector(
        `.kpi-more[data-indicator-id="${modal.id}"]`,
      );
      if (back) back.focus();
    });
  }

  /* ---------- Render semua ---------- */
  function renderAll() {
    renderTotal();
    renderKpis();
    renderSummary();
    renderChart();
    renderTotalChart();
    ohsUtils.icons();
  }

  /* Dipanggil setiap kali data (re)load. */
  function render(model) {
    state.model = model;
    renderMeta();
    renderControls();
    renderAll();
  }

  /* Dipasang sekali saat start. */
  function bindControls() {
    bindKpiModal();
    $("indicatorSelect").addEventListener("change", (e) => {
      state.indicatorId = e.target.value;
      renderChart();
    });
    $("monthSelect").addEventListener("change", (e) => {
      state.month = Number(e.target.value);
      renderAll();
    });
    const onYear = (e) => {
      state.year = Number(e.target.value);
      $("yearSelect").value = $("yearSelectChart").value = String(state.year);
      renderControls();
      renderAll();
    };
    $("yearSelect").addEventListener("change", onYear);
    $("yearSelectChart").addEventListener("change", onYear);
  }

  return { render, bindControls };
})();
