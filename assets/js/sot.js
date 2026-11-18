const Sot = (function () {
  const $ = (id) => document.getElementById(id);
  const cfg = ohsConfig;
  const sotCfg = cfg.sot || {};
  const { esc, formatDate } = ohsUtils;

  const MIN = Number.isFinite(Number(sotCfg.minObserverPercent))
    ? Number(sotCfg.minObserverPercent)
    : 85;
  const LIMIT = Number.isFinite(Number(sotCfg.departmentLimit))
    ? Number(sotCfg.departmentLimit)
    : 5;

  const state = {
    rows: [],
    employeeRows: [],
    meta: { isMockData: false, lastUpdated: null },
    latestPeriod: null,
    filters: {
      period: null,
      department: "all",
      biro: "all",
      seksi: "all",
    },
    showAll: false,
    charts: { observer: null, ratio: null, trend: null },
  };

  const fmt = (n) => Number(n).toLocaleString("id-ID");
  const pct = (n) => (Number.isFinite(n) ? `${ohsUtils.formatNumber(n)}%` : "–");
  const periodKey = (year, month) => year * 12 + month;
  const periodText = (p) =>
    p ? `${cfg.monthsLong[p.month - 1]} ${p.year}` : "-";
  const toPeriod = (key) => ({
    year: Math.floor((key - 1) / 12),
    month: ((key - 1) % 12) + 1,
  });
  const toNumber = (v) => DataService.toNumber(v);
  const nonNegative = (v) => {
    const n = toNumber(v);
    return n !== null && n >= 0 ? n : null;
  };
  const complianceOf = (actual, target) =>
    target > 0 ? (actual / target) * 100 : 100;
  const ratioOf = (part, total) => (total > 0 ? (part / total) * 100 : 0);
  const shortName = (name) =>
    String(name || "")
      .replace(/^Dept\. of /, "")
      .replace(/^Unit of /, "");
  const chartLabel = (name) => {
    const short = shortName(name);
    return short.length > 19 ? `${short.slice(0, 18)}…` : short;
  };

  const currentPeriod = () => {
    const [year, month] = String($("sotPeriod").value || "")
      .split("-")
      .map(Number);
    if (year > 0 && month >= 1 && month <= 12) return { year, month };
    return state.latestPeriod;
  };

  const periodOptionValue = (p) => `${p.year}-${p.month}`;
  const periodRows = (p) =>
    p
      ? state.rows.filter((r) => r.year === p.year && r.month === p.month)
      : [];
  const matchesActiveFilters = (r) =>
    (state.filters.department === "all" ||
      r.department === state.filters.department) &&
    (state.filters.biro === "all" || r.biro === state.filters.biro) &&
    (state.filters.seksi === "all" || r.seksi === state.filters.seksi);
  const filteredRows = () =>
    periodRows(state.filters.period).filter(matchesActiveFilters);

  function aggregate(rows) {
    const target = rows.reduce((n, r) => n + r.targetObserver, 0);
    const actual = rows.reduce((n, r) => n + r.aktualObserver, 0);
    const safe = rows.reduce((n, r) => n + r.aman, 0);
    const unsafe = rows.reduce((n, r) => n + r.tidakAman, 0);
    const done = rows.reduce((n, r) => n + r.selesai, 0);
    const process = rows.reduce((n, r) => n + r.proses, 0);
    const totalObs = safe + unsafe;
    const compliance = complianceOf(actual, target);
    return {
      target,
      actual,
      safe,
      unsafe,
      done,
      process,
      totalObs,
      compliance,
      safePct: ratioOf(safe, totalObs),
      donePct: ratioOf(done, unsafe),
      processPct: ratioOf(process, unsafe),
      below: compliance < MIN,
    };
  }

  function groupByDepartment(rows) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.department)) map.set(r.department, []);
      map.get(r.department).push(r);
    });
    return [...map.entries()]
      .map(([department, list]) => ({
        department,
        ...aggregate(list),
      }))
      .sort(
        (a, b) =>
          b.actual - a.actual ||
          a.department.localeCompare(b.department, "id"),
      );
  }

  function cleanRows(list) {
    return (Array.isArray(list) ? list : [])
      .map((r) => ({
        year: toNumber(r.year),
        month: toNumber(r.month),
        department: String(r.department || "").trim(),
        biro: String(r.biro || "").trim(),
        seksi: String(r.seksi || "").trim(),
        targetObserver: nonNegative(r.target_observer),
        aktualObserver: nonNegative(r.aktual_observer),
        aman: nonNegative(r.observasi_aman),
        tidakAman: nonNegative(r.observasi_tidak_aman),
        selesai: nonNegative(r.tindak_lanjut_selesai),
        proses: nonNegative(r.tindak_lanjut_proses),
        lastUpdated: String(r.last_updated || "").trim(),
      }))
      .filter((r) => {
        const valid =
          Number.isInteger(r.year) &&
          r.year > 0 &&
          Number.isInteger(r.month) &&
          r.month >= 1 &&
          r.month <= 12 &&
          r.department !== "" &&
          Number.isFinite(r.targetObserver) &&
          Number.isFinite(r.aktualObserver) &&
          Number.isFinite(r.aman) &&
          Number.isFinite(r.tidakAman);
        if (!valid) return false;
        const done = Number.isFinite(r.selesai) ? r.selesai : 0;
        const process = Number.isFinite(r.proses) ? r.proses : 0;
        if (done + process > r.tidakAman) {
          console.warn(
            "[Laporan SOT] Baris dilewati: tindak lanjut melebihi observasi tidak aman.",
            r,
          );
          return false;
        }
        r.selesai = done;
        r.proses = process;
        return true;
      });
  }

  function rowsFromCsv(csvRows) {
    if (!csvRows.length) throw new Error("Sheet SOT kosong.");
    const header = csvRows[0].map((h) => String(h).trim().toLowerCase());
    const required = [
      "year",
      "month",
      "department",
      "target_observer",
      "aktual_observer",
      "observasi_aman",
      "observasi_tidak_aman",
    ];
    required.forEach((name) => {
      if (header.indexOf(name) === -1)
        throw new Error(`Kolom '${name}' tidak ada di sheet SOT.`);
    });
    const names = [
      "year",
      "month",
      "department",
      "biro",
      "seksi",
      "target_observer",
      "aktual_observer",
      "observasi_aman",
      "observasi_tidak_aman",
      "tindak_lanjut_selesai",
      "tindak_lanjut_proses",
      "last_updated",
    ];
    return csvRows.slice(1).map((cells) => {
      const row = {};
      names.forEach((name) => {
        const index = header.indexOf(name);
        row[name] = index === -1 ? "" : cells[index];
      });
      return row;
    });
  }

  function deriveLastUpdated(rows) {
    let latest = "";
    rows.forEach((r) => {
      const match = /^(\d{4}-\d{2}-\d{2})/.exec(r.lastUpdated || "");
      if (match && match[1] > latest) latest = match[1];
    });
    return latest || null;
  }

  async function fetchSotData() {
    if (sotSource.type === "sheets") {
      if (!ohsUtils.isSafeUrl(sotSource.sheetsCsvUrl)) {
        throw new Error(
          "sotSource.sheetsCsvUrl belum diisi dengan URL https:// yang valid.",
        );
      }
      const res = await fetch(sotSource.sheetsCsvUrl, { cache: "no-cache" });
      if (!res.ok)
        throw new Error(`Gagal memuat Google Sheets (HTTP ${res.status})`);
      const csv = DataService.parseCsv(await res.text());
      const rows = cleanRows(rowsFromCsv(csv));
      return {
        isMock: false,
        meta: { lastUpdated: deriveLastUpdated(rows) },
        rows,
      };
    }

    const res = await fetch(sotSource.localUrl, { cache: "no-cache" });
    if (!res.ok)
      throw new Error(
        `Gagal memuat ${sotSource.localUrl} (HTTP ${res.status})`,
      );
    const json = await res.json();
    const rows = cleanRows(json.rows);
    const meta = json.meta || {};
    return {
      isMock: Boolean(meta.isMockData),
      meta: { lastUpdated: meta.lastUpdated || deriveLastUpdated(rows) },
      rows,
    };
  }

  async function fetchEmployeeRows() {
    if (typeof employeeSource === "undefined") return [];
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
      if (!csv.length) throw new Error("Sheet karyawan kosong.");
      const header = csv[0].map((h) => String(h).trim().toLowerCase());
      const names = ["year", "month", "unit", "tetap", "kontrak"];
      names.forEach((name) => {
        if (header.indexOf(name) === -1)
          throw new Error(`Kolom '${name}' tidak ada di sheet karyawan.`);
      });
      return cleanEmployeeRows(
        csv.slice(1).map((cells) => {
          const row = {};
          names.forEach((name) => {
            row[name] = cells[header.indexOf(name)];
          });
          return row;
        }),
      );
    }

    const res = await fetch(employeeSource.localUrl, { cache: "no-cache" });
    if (!res.ok)
      throw new Error(
        `Gagal memuat ${employeeSource.localUrl} (HTTP ${res.status})`,
      );
    const json = await res.json();
    return cleanEmployeeRows(json.rows);
  }

  function cleanEmployeeRows(list) {
    return (Array.isArray(list) ? list : [])
      .map((r) => ({
        year: toNumber(r.year),
        month: toNumber(r.month),
        tetap: toNumber(r.tetap),
        kontrak: toNumber(r.kontrak),
      }))
      .filter(
        (r) =>
          Number.isInteger(r.year) &&
          r.year > 0 &&
          Number.isInteger(r.month) &&
          r.month >= 1 &&
          r.month <= 12 &&
          Number.isFinite(r.tetap) &&
          r.tetap >= 0 &&
          Number.isFinite(r.kontrak) &&
          r.kontrak >= 0,
      );
  }

  function employeeTotalFor(year, month) {
    if (!state.employeeRows.length) return null;
    const selectedKey = periodKey(year, month);
    const exact = state.employeeRows.filter(
      (r) => r.year === year && r.month === month,
    );
    if (exact.length) {
      return {
        total: exact.reduce((n, r) => n + r.tetap + r.kontrak, 0),
        year,
        month,
        fallback: false,
      };
    }
    const keys = [
      ...new Set(
        state.employeeRows.map((r) => periodKey(r.year, r.month)),
      ),
    ].sort((a, b) => a - b);
    if (!keys.length) return null;
    const before = keys.filter((k) => k <= selectedKey).pop();
    const chosenKey = before === undefined ? keys[0] : before;
    const chosen = toPeriod(chosenKey);
    const rows = state.employeeRows.filter(
      (r) => r.year === chosen.year && r.month === chosen.month,
    );
    if (!rows.length) return null;
    return {
      total: rows.reduce((n, r) => n + r.tetap + r.kontrak, 0),
      year: chosen.year,
      month: chosen.month,
      fallback: true,
    };
  }

  function statusBadge(ok) {
    return `<span class="badge-status ${ok ? "status-good" : "status-critical"}">${ok ? "Tercapai" : "Belum tercapai"}</span>`;
  }

  function kpiCard({ name, desc, icon, value, unit, foot, badge, valueClass }) {
    return `
      <div class="col-12 col-sm-6 col-xl">
        <article class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-icon"><i data-lucide="${icon}" aria-hidden="true"></i></span>
            <div class="kpi-names">
              <h3 class="kpi-name">${esc(name)}</h3>
              <div class="kpi-full">${esc(desc)}</div>
            </div>
          </div>
          <div class="kpi-value ${valueClass || ""}">${value}${unit ? `<span class="unit">${esc(unit)}</span>` : ""}</div>
          <div class="kpi-bottom">
            <div class="kpi-foot">${foot}</div>
            ${badge ? `<div class="kpi-foot">${badge}</div>` : ""}
          </div>
        </article>
      </div>`;
  }

  function renderKpis(agg, period) {
    const employee = employeeTotalFor(period.year, period.month);
    const employeeFoot = employee
      ? `Data karyawan ${periodText({ year: employee.year, month: employee.month })}${employee.fallback ? " (periode terdekat)" : ""}`
      : "Data karyawan belum tersedia";
    const cards = [
      kpiCard({
        name: "Total Karyawan",
        desc: "Seluruh unit kerja",
        icon: "users",
        value: employee ? fmt(employee.total) : "–",
        unit: employee ? "orang" : "",
        foot: employeeFoot,
      }),
      kpiCard({
        name: "Total Observasi",
        desc: "Aman + tidak aman",
        icon: "clipboard-list",
        value: fmt(agg.totalObs),
        unit: "temuan",
        foot:
          agg.totalObs > 0
            ? `Aman ${pct(agg.safePct)} · Tidak aman ${pct(100 - agg.safePct)}`
            : "Belum ada observasi",
      }),
      kpiCard({
        name: "Observasi Aman",
        desc: "Perilaku dan kondisi aman",
        icon: "shield-check",
        value: fmt(agg.safe),
        unit: "temuan",
        foot:
          agg.totalObs > 0
            ? `${pct(agg.safePct)} dari total observasi`
            : "Belum ada observasi",
      }),
      kpiCard({
        name: "Observasi Tidak Aman",
        desc: "Perlu tindak lanjut",
        icon: "triangle-alert",
        value: fmt(agg.unsafe),
        unit: "temuan",
        foot: `Selesai ${fmt(agg.done)} · Proses ${fmt(agg.process)}`,
        valueClass: "sot-value-danger",
      }),
      kpiCard({
        name: "Kepatuhan Observer",
        desc: "Aktual terhadap target",
        icon: "target",
        value: pct(agg.compliance),
        foot: `${fmt(agg.actual)} / ${fmt(agg.target)} orang · target min. ${fmt(MIN)}%`,
        badge: statusBadge(agg.compliance >= MIN),
      }),
    ];
    $("kpiGrid").innerHTML = cards.join("");
  }

  function renderObserverChart(deptList, period) {
    const canvas = $("observerChart");
    const empty = $("observerChartEmpty");
    const hasData = deptList.length > 0;
    empty.hidden = hasData;
    canvas.hidden = !hasData;
    $("observerSub").textContent = hasData
      ? `${periodText(period)} · ${deptList.length} departemen · target min. ${fmt(MIN)}%`
      : "";

    $("observerTable").querySelector("tbody").innerHTML = deptList
      .map(
        (d) => `
          <tr>
            <th scope="row">${esc(d.department)}</th>
            <td>${fmt(d.target)}</td>
            <td>${fmt(d.actual)}</td>
            <td>${pct(d.compliance)}</td>
          </tr>`,
      )
      .join("");

    if (state.charts.observer) {
      state.charts.observer.destroy();
      state.charts.observer = null;
    }
    if (!hasData) {
      $("observerNote").textContent = "";
      return;
    }
    if (typeof Chart === "undefined") {
      $("observerNote").textContent =
        "Grafik tidak dapat dimuat. Data tersedia pada tabel ringkas di bawah.";
      return;
    }

    const mobile = window.matchMedia("(max-width: 767.98px)").matches;
    const labels = deptList.map((d) => chartLabel(d.department));
    const targetData = deptList.map((d) => d.target);
    const actualData = deptList.map((d) => d.actual);
    const pctData = deptList.map((d) => d.compliance);
    const maxPct = Math.max(
      110,
      Math.ceil(Math.max(...pctData) / 10) * 10 + 10,
    );

    const datasets = mobile
      ? [
          {
            type: "bar",
            label: "Aktual pengamat",
            data: actualData,
            backgroundColor: "#2563EB",
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.72,
            order: 1,
          },
          {
            type: "bar",
            label: "Target pengamat",
            data: targetData,
            backgroundColor: "#E2E8F0",
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.72,
            order: 2,
          },
        ]
      : [
          {
            type: "line",
            label: "Kepatuhan",
            data: pctData,
            borderColor: "#D97706",
            backgroundColor: "#D97706",
            borderWidth: 2,
            pointBackgroundColor: "#FFFFFF",
            pointBorderColor: "#D97706",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.25,
            yAxisID: "yPct",
            order: 1,
          },
          {
            type: "line",
            label: `Target min. ${MIN}%`,
            data: labels.map(() => MIN),
            borderColor: "#DC2626",
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            yAxisID: "yPct",
            order: 2,
          },
          {
            type: "bar",
            label: "Aktual pengamat",
            data: actualData,
            backgroundColor: "#2563EB",
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.72,
            yAxisID: "yCount",
            order: 3,
          },
          {
            type: "bar",
            label: "Target pengamat",
            data: targetData,
            backgroundColor: "#E2E8F0",
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.72,
            yAxisID: "yCount",
            order: 4,
          },
        ];

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: mobile ? "y" : undefined,
      animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0F172A",
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: "Inter", size: 13, weight: "bold" },
          bodyFont: { family: "Inter", size: 12 },
          callbacks: {
            title: (items) => deptList[items[0].dataIndex].department,
            label: (ctx) =>
              ctx.dataset.yAxisID === "yPct"
                ? `${ctx.dataset.label}: ${pct(ctx.raw)}`
                : `${ctx.dataset.label}: ${fmt(ctx.raw)} orang`,
            afterBody: (items) =>
              `Kepatuhan: ${pct(deptList[items[0].dataIndex].compliance)}`,
          },
        },
      },
      scales: mobile
        ? {
            x: {
              beginAtZero: true,
              grid: { color: "#F1F5F9" },
              ticks: {
                font: { family: "Inter", size: 10 },
                color: "#64748B",
              },
            },
            y: {
              grid: { display: false },
              ticks: {
                autoSkip: false,
                font: { family: "Inter", size: 10 },
                color: "#475569",
              },
            },
          }
        : {
            x: {
              grid: { display: false },
              ticks: {
                autoSkip: false,
                maxRotation: 35,
                minRotation: 0,
                font: { family: "Inter", size: 10 },
                color: "#475569",
              },
            },
            yCount: {
              beginAtZero: true,
              position: "left",
              title: {
                display: true,
                text: "Jumlah pengamat (orang)",
                font: { family: "Inter", size: 10 },
                color: "#64748B",
              },
              grid: { color: "#F1F5F9" },
              ticks: {
                font: { family: "Inter", size: 10 },
                color: "#64748B",
              },
            },
            yPct: {
              beginAtZero: true,
              suggestedMax: maxPct,
              position: "right",
              title: {
                display: true,
                text: "Kepatuhan (%)",
                font: { family: "Inter", size: 10 },
                color: "#64748B",
              },
              grid: { display: false },
              ticks: {
                callback: (v) => `${v}%`,
                font: { family: "Inter", size: 10 },
                color: "#64748B",
              },
            },
          },
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const dept = deptList[elements[0].index];
        if (dept) openDeptModal(dept.department, findDeptButton(dept.department));
      },
    };

    state.charts.observer = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options,
    });

    $("observerNote").textContent = mobile
      ? "Tampilan horizontal agar nama departemen terbaca. Angka kepatuhan tersedia pada ringkasan di bawah grafik."
      : "Batang abu-abu = target pengamat; batang biru = aktual; garis kuning = kepatuhan; garis merah putus-putus = target minimum.";
  }

  function renderDeptSummary(deptList) {
    $("deptSummary").innerHTML = deptList
      .map((d) => {
        const below = d.compliance < MIN;
        return `
          <button type="button" class="sot-dept-btn${below ? " is-below" : ""}" data-dept="${esc(d.department)}" aria-haspopup="dialog" aria-label="Lihat rincian ${esc(d.department)}, kepatuhan ${pct(d.compliance)}">
            <span class="sot-dept-name" title="${esc(d.department)}">${esc(shortName(d.department))}</span>
            <span class="sot-dept-pct">${pct(d.compliance)}</span>
            <span class="sot-dept-count">${fmt(d.actual)} / ${fmt(d.target)} orang</span>
            ${below ? '<span class="sot-dept-flag"><i data-lucide="triangle-alert" aria-hidden="true"></i>Di bawah target</span>' : ""}
          </button>`;
      })
      .join("");
  }

  function distributionRow(dept) {
    const safePct = ratioOf(dept.safe, dept.totalObs);
    const unsafePct = dept.totalObs > 0 ? 100 - safePct : 0;
    const below = dept.compliance < MIN;
    return `
      <button type="button" class="sot-dist-row" data-dept="${esc(dept.department)}" aria-haspopup="dialog" aria-label="Lihat rincian ${esc(dept.department)}">
        <span class="sot-dist-top">
          <span class="sot-dist-name">${esc(dept.department)}</span>
          <span class="sot-dist-total">${fmt(dept.totalObs)} observasi</span>
          <span class="sot-dist-detail">Detail</span>
          <i data-lucide="chevron-right" aria-hidden="true"></i>
        </span>
        <span class="sot-stack" aria-hidden="true">
          <span class="sot-stack-safe" style="width:${safePct}%"></span>
          <span class="sot-stack-unsafe" style="width:${unsafePct}%"></span>
        </span>
        <span class="sot-dist-meta">
          <span><span class="sot-dot sot-dot-safe"></span>Aman: ${fmt(dept.safe)} (${pct(safePct)})</span>
          <span><span class="sot-dot sot-dot-unsafe"></span>Tidak aman: ${fmt(dept.unsafe)} (${pct(unsafePct)})</span>
          <span class="sot-dist-status${below ? " is-below" : ""}">
            <i data-lucide="${below ? "triangle-alert" : "check"}" aria-hidden="true"></i>
            ${below ? "Di bawah target" : "Di atas target"}
          </span>
        </span>
      </button>`;
  }

  function renderDistribution(deptList, period) {
    const shown = state.showAll ? deptList : deptList.slice(0, LIMIT);
    const button = $("showAllDepts");
    button.hidden = deptList.length <= LIMIT;
    button.textContent = state.showAll
      ? "Tampilkan lebih sedikit"
      : `Tampilkan semua departemen (${deptList.length})`;
    $("distributionSub").textContent = `${periodText(period)} · ${deptList.length} departemen`;
    $("distributionList").innerHTML = shown.map(distributionRow).join("");

    $("distributionTable").querySelector("tbody").innerHTML = deptList
      .map(
        (d) => `
          <tr>
            <th scope="row">${esc(d.department)}</th>
            <td>${fmt(d.safe)}</td>
            <td>${fmt(d.unsafe)}</td>
            <td>${fmt(d.totalObs)}</td>
            <td>${fmt(d.done)}</td>
            <td>${fmt(d.process)}</td>
          </tr>`,
      )
      .join("");
  }

  function renderRatio(agg) {
    const canvas = $("ratioChart");
    const total = agg.totalObs;
    const safePct = ratioOf(agg.safe, total);
    const unsafePct = total > 0 ? 100 - safePct : 0;

    $("ratioValue").textContent = total > 0 ? pct(safePct) : "–";
    $("ratioLegend").innerHTML =
      total > 0
        ? `<span><span class="sot-dot sot-dot-safe"></span>Aman: ${fmt(agg.safe)} (${pct(safePct)})</span>
           <span><span class="sot-dot sot-dot-unsafe"></span>Tidak aman: ${fmt(agg.unsafe)} (${pct(unsafePct)})</span>`
        : "Belum ada observasi pada periode ini.";

    $("ratioTable").querySelector("tbody").innerHTML =
      total > 0
        ? `<tr><th scope="row">Aman</th><td>${fmt(agg.safe)}</td><td>${pct(safePct)}</td></tr>
           <tr><th scope="row">Tidak aman</th><td>${fmt(agg.unsafe)}</td><td>${pct(unsafePct)}</td></tr>`
        : "";

    if (state.charts.ratio) {
      state.charts.ratio.destroy();
      state.charts.ratio = null;
    }
    canvas.hidden = total === 0;
    if (total === 0 || typeof Chart === "undefined") return;

    state.charts.ratio = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Aman", "Tidak aman"],
        datasets: [
          {
            data: [agg.safe, agg.unsafe],
            backgroundColor: ["#2563EB", "#DC2626"],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0F172A",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) =>
                `${ctx.label}: ${fmt(ctx.raw)} (${pct(ratioOf(ctx.raw, total))})`,
            },
          },
        },
      },
    });
  }

  function renderFollowup(agg) {
    $("followupTotal").textContent = `${fmt(agg.unsafe)} temuan tidak aman`;
    if (agg.unsafe === 0) {
      $("followupBody").innerHTML =
        '<p class="sot-followup-note">Tidak ada temuan tidak aman pada periode ini.</p>';
      return;
    }
    const pending = Math.max(
      0,
      agg.unsafe - agg.done - agg.process,
    );
    $("followupBody").innerHTML = `
      <div class="sot-followup-head">
        <span>Total temuan tidak aman</span>
        <strong>${fmt(agg.unsafe)}</strong>
      </div>
      <div class="sot-stack" aria-hidden="true">
        <span class="sot-stack-done" style="width:${agg.donePct}%"></span>
        <span class="sot-stack-process" style="width:${agg.processPct}%"></span>
      </div>
      <div class="sot-followup-grid">
        <div><span class="sot-dot sot-dot-done"></span>Selesai <strong>${fmt(agg.done)}</strong> (${pct(agg.donePct)})</div>
        <div><span class="sot-dot sot-dot-process"></span>Proses <strong>${fmt(agg.process)}</strong> (${pct(agg.processPct)})</div>
      </div>
      <p class="sot-followup-note">${pending > 0 ? `${fmt(pending)} temuan belum ditindaklanjuti.` : "Seluruh temuan tidak aman sudah tercatat dalam tindak lanjut."}</p>`;
  }

  function trendFilterLabel() {
    const parts = [];
    if (state.filters.department !== "all")
      parts.push(state.filters.department);
    if (state.filters.biro !== "all") parts.push(state.filters.biro);
    if (state.filters.seksi !== "all") parts.push(state.filters.seksi);
    return parts.length ? parts.join(" · ") : "Semua departemen";
  }

  function renderTrend(period) {
    const year = period.year;
    const months = cfg.monthsShort;
    const points = months.map((_label, index) => {
      const month = index + 1;
      const rows = state.rows.filter(
        (r) => r.year === year && r.month === month && matchesActiveFilters(r),
      );
      return rows.length ? aggregate(rows) : null;
    });
    const hasData = points.some(Boolean);
    const latestIndex = points.reduce(
      (last, point, index) => (point ? index : last),
      -1,
    );

    $("trendEmpty").hidden = hasData;
    $("trendChart").hidden = !hasData;
    $("trendSub").textContent = `${trendFilterLabel()} · Januari sampai Desember ${year} · target min. ${fmt(MIN)}%`;

    if (latestIndex >= 0) {
      const latest = points[latestIndex];
      $("trendBadge").hidden = false;
      $("trendBadge").className = `badge-status ${latest.compliance >= MIN ? "status-good" : "status-critical"}`;
      $("trendBadge").textContent = `Bulan ${cfg.monthsLong[latestIndex]}: ${pct(latest.compliance)}`;
    } else {
      $("trendBadge").hidden = true;
    }

    $("trendTable").querySelector("tbody").innerHTML = points
      .map(
        (point, index) => `
          <tr>
            <th scope="row">${cfg.monthsLong[index]}</th>
            <td>${point ? pct(point.compliance) : "Belum ada data"}</td>
            <td>${pct(MIN)}</td>
          </tr>`,
      )
      .join("");

    if (state.charts.trend) {
      state.charts.trend.destroy();
      state.charts.trend = null;
    }
    if (!hasData) {
      $("trendNote").textContent = "";
      return;
    }
    if (typeof Chart === "undefined") {
      $("trendNote").textContent =
        "Grafik tidak dapat dimuat. Data tersedia pada tabel alternatif di bawah grafik.";
      return;
    }

    const values = points.map((point) =>
      point ? point.compliance : null,
    );
    const dataCount = values.filter((v) => Number.isFinite(v)).length;
    const maxValue = Math.max(
      110,
      ...values.filter((v) => Number.isFinite(v)),
    );
    $("trendNote").textContent =
      `Garis biru = kepatuhan bulanan; garis merah putus-putus = target minimum.` +
      (dataCount === 1 ? " Hanya satu bulan berisi data." : "");

    state.charts.trend = new Chart($("trendChart"), {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Kepatuhan",
            data: values,
            borderColor: "#2563EB",
            backgroundColor: "#2563EB",
            borderWidth: 2,
            pointBackgroundColor: "#FFFFFF",
            pointBorderColor: "#2563EB",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.25,
            spanGaps: false,
          },
          {
            label: `Target min. ${MIN}%`,
            data: months.map(() => MIN),
            borderColor: "#DC2626",
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
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
            backgroundColor: "#0F172A",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => cfg.monthsLong[items[0].dataIndex],
              label: (ctx) =>
                ctx.raw === null
                  ? `${ctx.dataset.label}: belum ada data`
                  : `${ctx.dataset.label}: ${pct(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: true,
            suggestedMax: Math.ceil(maxValue / 10) * 10,
            grid: { color: "#E2E8F0" },
            ticks: {
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    });
  }

  function renderDocs() {
    const docs = (Array.isArray(sotCfg.documents) ? sotCfg.documents : [])
      .map((doc) => ({
        title: String(doc.title || "").trim(),
        desc: String(doc.desc || "").trim(),
        icon: String(doc.icon || "file-text"),
        url: doc.url || (doc.linkKey ? ohsLinks[doc.linkKey] : ""),
      }))
      .filter((doc) => doc.title !== "" && ohsUtils.isSafeUrl(doc.url));

    $("sotDocsCard").hidden = docs.length === 0;
    $("sotDocsList").innerHTML = docs
      .map(
        (doc) => `
          <a class="sot-doc-item" href="${esc(doc.url)}" target="_blank" rel="noopener noreferrer">
            <span class="sot-doc-icon"><i data-lucide="${esc(doc.icon)}" aria-hidden="true"></i></span>
            <span class="sot-doc-text">
              <span class="sot-doc-title">${esc(doc.title)}<span class="visually-hidden"> (buka di tab baru)</span></span>
              ${doc.desc ? `<span class="sot-doc-desc">${esc(doc.desc)}</span>` : ""}
            </span>
            <i data-lucide="external-link" class="sot-doc-ext" aria-hidden="true"></i>
          </a>`,
      )
      .join("");
  }

 

  function renderLastUpdated() {
    $("lastUpdatedValue").textContent = state.meta.lastUpdated
      ? formatDate(state.meta.lastUpdated)
      : "-";
  }

  function filterSummary(rows, period) {
    if (!state.rows.length) return "Belum ada data SOT.";
    const active = [
      periodText(period),
      state.filters.department === "all"
        ? "Semua departemen"
        : state.filters.department,
    ];
    if (state.filters.biro !== "all") active.push(state.filters.biro);
    if (state.filters.seksi !== "all") active.push(state.filters.seksi);
    if (!rows.length) return `Tidak ada data untuk ${active.join(" · ")}.`;
    const departmentCount = new Set(rows.map((r) => r.department)).size;
    return `Menampilkan ${fmt(departmentCount)} departemen · ${active.join(" · ")}`;
  }

  function renderAll() {
    const period = state.filters.period;
    if (!period) {
      $("sotData").hidden = true;
      $("sotFilterEmpty").hidden = true;
      $("sotEmpty").hidden = false;
      $("periodLabel").textContent = "-";
      $("sotFilterStatus").textContent = "Belum ada data SOT.";
      return;
    }

    const rows = filteredRows();
    $("sotFilterStatus").textContent = filterSummary(rows, period);

    if (!state.rows.length || !periodRows(period).length) {
      $("sotData").hidden = true;
      $("sotFilterEmpty").hidden = true;
      $("sotEmpty").hidden = false;
      $("periodLabel").textContent = periodText(period);
      return;
    }

    if (!rows.length) {
      $("sotData").hidden = true;
      $("sotEmpty").hidden = true;
      $("sotFilterEmpty").hidden = false;
      $("periodLabel").textContent = periodText(period);
      return;
    }

    $("sotEmpty").hidden = true;
    $("sotFilterEmpty").hidden = true;
    $("sotData").hidden = false;
    $("periodLabel").textContent = periodText(period);

    const agg = aggregate(rows);
    const deptList = groupByDepartment(rows);
    renderKpis(agg, period);
    renderObserverChart(deptList, period);
    renderDeptSummary(deptList);
    renderDistribution(deptList, period);
    renderRatio(agg);
    renderFollowup(agg);
    renderTrend(period);
    ohsUtils.icons();
  }

  function fillPeriods() {
    const keys = [
      ...new Set(state.rows.map((r) => periodKey(r.year, r.month))),
    ].sort((a, b) => b - a);
    if (!keys.length) {
      state.latestPeriod = null;
      $("sotPeriod").innerHTML = '<option value="">-</option>';
      $("sotPeriod").disabled = true;
      return;
    }
    $("sotPeriod").disabled = false;
    const periods = keys.map(toPeriod);
    state.latestPeriod = periods[0];
    $("sotPeriod").innerHTML = periods
      .map((p) => `<option value="${periodOptionValue(p)}">${periodText(p)}</option>`)
      .join("");
    $("sotPeriod").value = periodOptionValue(state.latestPeriod);
  }

  function fillDepartments() {
    const period = currentPeriod();
    const values = [
      ...new Set(periodRows(period).map((r) => r.department)),
    ].sort((a, b) => a.localeCompare(b, "id"));
    const previous = $("sotDepartment").value;
    $("sotDepartment").innerHTML =
      '<option value="all">Semua departemen</option>' +
      values
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
        .join("");
    $("sotDepartment").value =
      values.includes(previous) ? previous : "all";
    $("sotDepartment").closest(".sot-filter-field").hidden =
      values.length === 0;
  }

  function fillBiro() {
    const period = currentPeriod();
    const department = $("sotDepartment").value;
    const values = [
      ...new Set(
        periodRows(period)
          .filter(
            (r) => department === "all" || r.department === department,
          )
          .map((r) => r.biro)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "id"));
    const previous = $("sotBiro").value;
    $("sotBiro").innerHTML =
      '<option value="all">Semua biro</option>' +
      values
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
        .join("");
    $("sotBiro").value = values.includes(previous) ? previous : "all";
    $("sotBiro").closest(".sot-filter-field").hidden =
      values.length === 0;
  }

  function fillSeksi() {
    const period = currentPeriod();
    const department = $("sotDepartment").value;
    const biro = $("sotBiro").value;
    const values = [
      ...new Set(
        periodRows(period)
          .filter(
            (r) =>
              (department === "all" || r.department === department) &&
              (biro === "all" || r.biro === biro),
          )
          .map((r) => r.seksi)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "id"));
    const previous = $("sotSeksi").value;
    $("sotSeksi").innerHTML =
      '<option value="all">Semua seksi</option>' +
      values
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
        .join("");
    $("sotSeksi").value = values.includes(previous) ? previous : "all";
    $("sotSeksi").closest(".sot-filter-field").hidden =
      values.length === 0;
  }

  function syncFilters() {
    fillDepartments();
    fillBiro();
    fillSeksi();
  }

  function resetFilters(render = true) {
    if (!state.latestPeriod) return;
    $("sotPeriod").value = periodOptionValue(state.latestPeriod);
    fillDepartments();
    $("sotDepartment").value = "all";
    fillBiro();
    $("sotBiro").value = "all";
    fillSeksi();
    $("sotSeksi").value = "all";
    state.showAll = false;
    if (render) applyFilters();
  }

  function applyFilters() {
    const period = currentPeriod();
    state.filters = {
      period,
      department: $("sotDepartment").value || "all",
      biro: $("sotBiro").value || "all",
      seksi: $("sotSeksi").value || "all",
    };
    state.showAll = false;
    renderAll();
  }

  function findDeptButton(name) {
    return [...document.querySelectorAll(".sot-dept-btn")].find(
      (button) => button.dataset.dept === name,
    );
  }

  function subdivisionGroups(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const key = `${r.biro}\u0000${r.seksi}`;
      if (!map.has(key)) {
        map.set(key, { biro: r.biro, seksi: r.seksi, rows: [] });
      }
      map.get(key).rows.push(r);
    });
    return [...map.values()]
      .map((group) => ({ ...group, ...aggregate(group.rows) }))
      .sort(
        (a, b) =>
          b.actual - a.actual ||
          a.biro.localeCompare(b.biro, "id") ||
          a.seksi.localeCompare(b.seksi, "id"),
      );
  }

  function openDeptModal(department, trigger) {
    const period = state.filters.period;
    if (!period) return;
    const rows = state.rows.filter(
      (r) =>
        r.year === period.year &&
        r.month === period.month &&
        r.department === department,
    );
    if (!rows.length) return;

    const agg = aggregate(rows);
    const groups = subdivisionGroups(rows);
    const tableRows = groups
      .map(
        (group) => `
          <tr>
            <th scope="row">${esc(group.biro || "–")}</th>
            <td>${esc(group.seksi || "–")}</td>
            <td>${fmt(group.target)}</td>
            <td>${fmt(group.actual)}</td>
            <td>
              <span class="${group.compliance < MIN ? "sot-status-below" : "sot-status-ok"}">
                <i data-lucide="${group.compliance < MIN ? "triangle-alert" : "check"}" aria-hidden="true"></i>
                ${pct(group.compliance)}
                <span class="visually-hidden">${group.compliance < MIN ? "di bawah target" : "mencapai target"}</span>
              </span>
            </td>
            <td>${fmt(group.safe)}</td>
            <td>${fmt(group.unsafe)}</td>
            <td>${fmt(group.done)}</td>
            <td>${fmt(group.process)}</td>
          </tr>`,
      )
      .join("");

    $("deptModalTitle").textContent = department;
    $("deptModalSub").textContent = `Rincian agregat ${periodText(period)} · ${fmt(rows.length)} baris biro/seksi`;
    $("deptModalBody").innerHTML = `
      <div class="sot-modal-kpis">
        <div class="sot-modal-kpi"><span>Target pengamat</span><strong>${fmt(agg.target)}</strong></div>
        <div class="sot-modal-kpi"><span>Aktual pengamat</span><strong>${fmt(agg.actual)}</strong></div>
        <div class="sot-modal-kpi"><span>Kepatuhan</span><strong>${pct(agg.compliance)}</strong></div>
        <div class="sot-modal-kpi"><span>Total observasi</span><strong>${fmt(agg.totalObs)}</strong></div>
        <div class="sot-modal-kpi"><span>Observasi aman</span><strong>${fmt(agg.safe)}</strong></div>
        <div class="sot-modal-kpi"><span>Tidak aman</span><strong class="sot-value-danger">${fmt(agg.unsafe)}</strong></div>
        <div class="sot-modal-kpi"><span>Tindak lanjut selesai</span><strong>${fmt(agg.done)}</strong></div>
        <div class="sot-modal-kpi"><span>Masih proses</span><strong>${fmt(agg.process)}</strong></div>
      </div>
      <div class="sot-modal-section">
        <h3>Rincian per biro dan seksi</h3>
        <div class="table-responsive">
          <table class="sot-table">
            <caption class="visually-hidden">Rincian agregat ${esc(department)}, ${periodText(period)}</caption>
            <thead>
              <tr>
                <th scope="col">Biro</th>
                <th scope="col">Seksi</th>
                <th scope="col">Target</th>
                <th scope="col">Aktual</th>
                <th scope="col">Kepatuhan</th>
                <th scope="col">Aman</th>
                <th scope="col">Tidak aman</th>
                <th scope="col">Selesai</th>
                <th scope="col">Proses</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr>
                <th scope="row" colspan="2">Total departemen</th>
                <td>${fmt(agg.target)}</td>
                <td>${fmt(agg.actual)}</td>
                <td>${pct(agg.compliance)}</td>
                <td>${fmt(agg.safe)}</td>
                <td>${fmt(agg.unsafe)}</td>
                <td>${fmt(agg.done)}</td>
                <td>${fmt(agg.process)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="sot-modal-note">Angka merupakan agregat departemen. Halaman ini tidak menampilkan nama pengamat atau rincian temuan individual.</p>
      </div>`;

    ohsUtils.icons();
    const modalElement = $("deptModal");
    modalElement.addEventListener(
      "hidden.bs.modal",
      () => {
        if (trigger && typeof trigger.focus === "function") trigger.focus();
      },
      { once: true },
    );
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
  }

  function startClock() {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Makassar",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const dayNames = {
      Sun: "Min",
      Mon: "Sen",
      Tue: "Sel",
      Wed: "Rab",
      Thu: "Kam",
      Fri: "Jum",
      Sat: "Sab",
    };
    function tick() {
      const element = $("clockValue");
      if (!element) return;
      const parts = {};
      formatter.formatToParts(new Date()).forEach((part) => {
        parts[part.type] = part.value;
      });
      const day = dayNames[parts.weekday] || parts.weekday;
      const month = cfg.monthsShort[Number(parts.month) - 1] || parts.month;
      element.textContent = `${day}, ${Number(parts.day)} ${month} ${parts.year} · ${parts.hour}.${parts.minute} WITA`;
      element.setAttribute(
        "datetime",
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00+08:00`,
      );
    }
    tick();
    window.setInterval(tick, 15000);
  }

  function bindControls() {
    $("sotFilterForm").addEventListener("submit", (event) => {
      event.preventDefault();
      applyFilters();
    });
    $("sotPeriod").addEventListener("change", () => {
      syncFilters();
    });
    $("sotDepartment").addEventListener("change", () => {
      fillBiro();
      fillSeksi();
    });
    $("sotBiro").addEventListener("change", () => {
      fillSeksi();
    });
    $("sotReset").addEventListener("click", () => resetFilters());
    $("sotEmptyReset").addEventListener("click", () => resetFilters());
    $("refreshBtn").addEventListener("click", load);
    $("retryBtn").addEventListener("click", load);
    $("showAllDepts").addEventListener("click", () => {
      state.showAll = !state.showAll;
      renderDistribution(
        groupByDepartment(filteredRows()),
        state.filters.period,
      );
      ohsUtils.icons();
    });

    ["deptSummary", "distributionList"].forEach((id) => {
      $(id).addEventListener("click", (event) => {
        const button = event.target.closest("[data-dept]");
        if (button) openDeptModal(button.dataset.dept, button);
      });
    });

    $("sotFilterBody").addEventListener("show.bs.collapse", () => {
      $("filterToggle").setAttribute("aria-expanded", "true");
    });
    $("sotFilterBody").addEventListener("hide.bs.collapse", () => {
      $("filterToggle").setAttribute("aria-expanded", "false");
    });

    let mobile = window.matchMedia("(max-width: 767.98px)").matches;
    window.addEventListener("resize", () => {
      const next = window.matchMedia("(max-width: 767.98px)").matches;
      if (next === mobile) return;
      mobile = next;
      if (!state.filters.period || !filteredRows().length) return;
      renderObserverChart(
        groupByDepartment(filteredRows()),
        state.filters.period,
      );
      ohsUtils.icons();
    });
  }

  async function load() {
    const firstLoad = state.rows.length === 0;
    if (firstLoad) $("stateLoading").hidden = false;
    $("stateError").hidden = true;
    $("refreshBtn").disabled = true;
    $("refreshBtn").classList.add("is-spinning");

    try {
      const [sotData, employeeRows] = await Promise.all([
        fetchSotData(),
        fetchEmployeeRows().catch((error) => {
          console.warn("[Laporan SOT] Data karyawan tidak dapat dimuat.", error);
          return [];
        }),
      ]);
      state.rows = sotData.rows;
      state.meta = sotData.meta;
      state.employeeRows = employeeRows;
      $("mockBanner").hidden = !sotData.isMockData;
      $("sot").hidden = false;
      renderLastUpdated();
      fillPeriods();
      if (state.latestPeriod) {
        resetFilters(false);
        applyFilters();
      } else {
        state.filters.period = null;
        syncFilters();
        renderAll();
      }
    } catch (error) {
      console.error("[Laporan SOT]", error);
      $("stateError").hidden = false;
      if (firstLoad) $("sot").hidden = true;
    } finally {
      $("stateLoading").hidden = true;
      $("refreshBtn").disabled = false;
      $("refreshBtn").classList.remove("is-spinning");
      ohsUtils.icons();
    }
  }

  function start() {
    if (typeof Chart !== "undefined") {
      Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
      Chart.defaults.color = "#64748B";
    }
    
    startClock();
    bindControls();
    load();
  }

  return { start, load };
})();
