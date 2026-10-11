/* ==========================================================
   app.js
   Titik awal: menyambungkan sidebar, link, loading / error,
   dan memuat data. Tidak berisi logika bisnis.
   ========================================================== */

(function () {
  const $ = (id) => document.getElementById(id);
  const { esc, isSafeUrl } = ohsUtils;

  /* ---------- Sidebar (menu dari ohsConfig.nav) ---------- */
  function renderNav() {
    const current = document.body.dataset.page; // "dashboard" atau "documents"
    $("navList").innerHTML = ohsConfig.nav
      .map((item) => {
        const active = item.id === current;
        return `<li><a class="nav-item-link${active ? " active" : ""}" href="${esc(item.href)}"${active ? ' aria-current="page"' : ""}>
        <i data-lucide="${item.icon}" aria-hidden="true"></i><span class="nav-label">${esc(item.label)}</span></a></li>`;
      })
      .join("");

    // Tutup drawer setelah memilih menu (di layar kecil).
    $("navList").addEventListener("click", (e) => {
      const sidebar = $("sidebar");
      if (e.target.closest("a") && sidebar.classList.contains("show")) {
        const inst = bootstrap.Offcanvas.getInstance(sidebar);
        if (inst) inst.hide();
      }
    });
  }

  /* ---------- Quick Access ---------- */
  function linkCardsHtml(items) {
    return items
      .map((q) => {
        // Dukung dua bentuk:
        //  - q.url      : URL langsung (khusus halaman Dokumen)
        //  - q.linkKey  : key di ohsLinks (dipakai Quick Access)
        const raw = q.url ? q.url : q.linkKey ? ohsLinks[q.linkKey] : "";
        const ok = isSafeUrl(raw);

        const inner = `
        <span class="quick-icon"><i data-lucide="${q.icon}" aria-hidden="true"></i></span>
        <span class="quick-text">
          <span class="quick-title d-block">${esc(q.title)}${ok ? '<span class="visually-hidden"> (buka di tab baru)</span>' : ""}</span>
          <span class="quick-desc d-block">${esc(q.desc)}${ok ? "" : " · Link belum diatur"}</span>
        </span>
        ${ok ? '<i data-lucide="external-link" class="quick-ext" aria-hidden="true"></i>' : ""}`;

        const card = ok
          ? `<a class="quick-card" href="${esc(raw.trim())}" target="_blank" rel="noopener noreferrer">${inner}</a>`
          : `<div class="quick-card" role="link" aria-disabled="true">${inner}</div>`;
        return `<div class="col-12 col-sm-6 col-xl-3">${card}</div>`;
      })
      .join("");
  }

  function renderLinkCards(containerId, items) {
    $(containerId).innerHTML = linkCardsHtml(items);
  }

  function renderDocGroups(containerId, groups) {
    $(containerId).innerHTML = groups
      .map(
        (g, i) => `
      <section class="doc-group" aria-labelledby="docGroup${i}">
        <h3 class="doc-group-title" id="docGroup${i}">${esc(g.group)}</h3>
        <div class="row g-3">${linkCardsHtml(g.items || [])}</div>
      </section>`,
      )
      .join("");
  }

  /* ---------- Status: loading / error / dashboard ---------- */
  function setView(view) {
    $("stateLoading").hidden = view !== "loading";
    $("stateError").hidden = view !== "error";
    $("dashboard").hidden = view !== "dashboard";
  }

  async function loadData() {
    const btn = $("refreshBtn");
    btn.classList.add("is-spinning");
    btn.disabled = true;
    // Saat pertama kali tampil loading penuh; saat refresh, dashboard lama tetap terlihat.
    if ($("dashboard").hidden) setView("loading");

    try {
      const model = await DataService.load();
      Dashboard.render(model);
      setView("dashboard");
    } catch (err) {
      console.error("[OHS Dashboard]", err);
      if (location.protocol === "file:") {
        document.querySelector("#stateError .state-sub").textContent =
          "Halaman dibuka lewat file://. Jalankan lewat server lokal, misalnya: python -m http.server";
      }
      setView("error");
    } finally {
      btn.classList.remove("is-spinning");
      btn.disabled = false;
      ohsUtils.icons();
    }
  }

  /* ---------- Tombol menu (hamburger) ----------
    Di bawah 1200px  : membuka / menutup drawer Bootstrap.
    Di 1200px ke atas: menyembunyikan / menampilkan sidebar lewat kelas body.sidebar-collapsed. */
  function initSidebarToggle() {
    const btn = $("menuToggle");
    const sidebar = $("sidebar");
    const desktop = window.matchMedia("(min-width: 1200px)");

    const isOpen = () =>
      desktop.matches
        ? !document.body.classList.contains("sidebar-collapsed")
        : sidebar.classList.contains("show");
    const sync = () => btn.setAttribute("aria-expanded", String(isOpen()));

    btn.addEventListener("click", () => {
      if (desktop.matches) {
        document.body.classList.toggle("sidebar-collapsed");
        sync();
      } else {
        bootstrap.Offcanvas.getOrCreateInstance(sidebar).toggle();
      }
    });

    sidebar.addEventListener("shown.bs.offcanvas", sync);
    sidebar.addEventListener("hidden.bs.offcanvas", () => {
      sync();
      if (!desktop.matches) btn.focus();
    });

    // Layar melebar ke desktop saat drawer terbuka: tutup drawer agar tidak tertinggal.
    desktop.addEventListener("change", () => {
      const drawer = bootstrap.Offcanvas.getInstance(sidebar);
      if (desktop.matches && drawer) drawer.hide();
      sync();
    });
    sync();
  }

  /* ---------- Pencarian & filter (halaman Dokumen) ----------
    Pencarian: cocok dengan judul ATAU deskripsi kartu (tidak peka huruf besar/kecil).
    Filter   : dropdown nama grup. Keduanya digabung (harus sama-sama cocok). */

  function initDocFilters() {
    const input = $("docSearch");
    const select = $("docGroupFilter");
    const groups = ohsConfig.documents;
    const total = groups.reduce((n, g) => n + (g.items || []).length, 0);
    const norm = (s) => String(s || "").toLowerCase().trim();

    // Dropdown
    select.innerHTML = '<option value="all">Semua grup</option>' + groups.map((g, i) => `<option value="${i}">${esc(g.group)}</option>`).join("");

    function apply() {
      const q = norm(input.value);
      const only = select.value;            // "all" atau nomor grup

      const visible = groups.map((g, i) => ({
        group: g.group,
        items: (g.items || []).filter((item) =>
        (only === "all" || String(i) === only) &&
        (q === "" || norm(item.title).includes(q) || norm(item.desc).includes(q)))
      }))
      .filter((g) => g.items.length > 0);   // jika tanpa hasil = disembunyikan

      const count = visible.reduce((n, g) => n + g.items.length, 0);
      renderDocGroups("docsGrid", visible);
      ohsUtils.icons();
      $("docsEmpty").hidden = count !== 0;
      $("docStatus").textContent = `Menampilkan ${count} dari ${total} dokumen`;
    }

    input.addEventListener("input", apply);
    select.addEventListener("change", apply);
    $("docsReset").addEventListener("click", () => {
      input.value = "";
      select.value = "all";
      apply();
      input.focus();
    });
    apply();
  }

  /* ---------- Start ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderNav();
    initSidebarToggle();
    if ($("quickGrid")) renderLinkCards("quickGrid", ohsConfig.quickAccess);
    if ($("docsGrid")) initDocFilters();

    // Bagian khusus halaman Dashboard
    if ($("dashboard")) {
      Dashboard.bindControls();
      $("refreshBtn").addEventListener("click", () => { loadData(); Info.load(); });
      $("retryBtn").addEventListener("click", loadData);
      loadData();
      Info.start();
    }
    ohsUtils.icons();
  });
})();
