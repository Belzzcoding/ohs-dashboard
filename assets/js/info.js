/* ==========================================================
    info.js
    "Informasi Terkini": Safety Alert + Jadwal Kegiatan OHS, dan jam hari ini (WITA) di header.
    Sumber data dipilih di config.js (infoSource): "local" (JSON) atau "sheets" (tab Google Sheets, CSV "Publish to web").
    Bentuk data setelah dinormalisasi:
    {
        isMock: boolean,
        alert: { message, updated: "YYYY-MM-DD"|null, expires: "YYYY-MM-DD"|null } | null,
        schedule: [ { date: "YYYY-MM-DD", title, detail } ]
    }
    Kegagalan memuat info TIDAK boleh merusak dashboard utama.
   ========================================================== */

const Info = (() => {
    const $ = (id) => document.getElementById(id);
    const { esc } = ohsUtils;
    const cfg = ohsConfig;

    const TZ = "Asia/Makassar"; // WITA (UTC+8), tidak bergantung zona waktu perangkat
    const DAY_SHORT = {
        Sunday: "Min",
        Monday: "Sen",
        Tuesday: "Sel",
        Wednesday: "Rab",
        Thursday: "Kam",
        Friday: "Jum",
        Saturday: "Sab",
    };
    const MAX_SCHEDULE = 5;

    const state = { info: null, failed: false, renderedDay: null, timer: null };

    /* ---------- Waktu WITA ---------- */
    function witaParts(date) {
        const parts = {};
        new Intl.DateTimeFormat("en-US", {
            timeZone: TZ,
            hourCycle: "h23",
            weekday: "long",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        .formatToParts(date)
        .forEach((p) => {
            parts[p.type] = p.value;
        });
        return parts;
    }
    const todayIso = () => {
        const p = witaParts(new Date());
        return `${p.year}-${p.month}-${p.day}`;
    };
    /* "2026-10-12" -> { day: 12, mon: "Okt", year: 2026 } */
    const dateBits = (iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        return {
            day: d,
            mon: cfg.monthsShort[m - 1],
            year: y,
            long: `${d} ${cfg.monthsLong[m - 1]} ${y}`,
        };
    };

    /* ---------- Jam (header) ---------- */
    function tickClock() {
        const el = $("clockValue");
        if (el) {
            const p = witaParts(new Date());
            el.textContent = `${DAY_SHORT[p.weekday]}, ${Number(p.day)} ${cfg.monthsShort[Number(p.month) - 1]} ${p.year} · ${p.hour}.${p.minute} WITA`;
            el.setAttribute("datetime", `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}+08:00`,);
        }
        // Ganti hari (lewat tengah malam WITA): jadwal & alert dihitung ulang.
        if (state.info && state.renderedDay !== todayIso()) render();
    }
    function startClock() {
        tickClock();
        if (state.timer) return;
        state.timer = setInterval(tickClock, 15000);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) tickClock();
        });
    }

    /* ---------- Normalisasi data ---------- */
    const text = (v) => (v === null || v === undefined ? "" : String(v).trim());
    const isoOrNull = (v) =>
        /^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : null;

    function normalize(raw) {
        if (!raw || typeof raw !== "object")
            throw new Error("Format info tidak dikenali.");
        const a = raw.alert && typeof raw.alert === "object" ? raw.alert : null;
        return {
            isMock: Boolean(raw.meta && raw.meta.isMockData),
            alert: a
            ? {
                message: text(a.message),
                updated: isoOrNull(a.updated),
                expires: isoOrNull(a.expires),
            }
            : null,
            schedule: (Array.isArray(raw.schedule) ? raw.schedule : [])
            .map((s) => ({
                date: isoOrNull(s && s.date),
                title: text(s && s.title),
                detail: text(s && s.detail),
            }))
            .filter((s) => s.date && s.title),
        };
    }

    /* Baris CSV (header: type, date, title, detail, expires) -> bentuk mentah.
        type = "alert"    : date = tanggal diperbarui, detail (atau title) = isi, expires = batas tampil (boleh kosong)
        type = "schedule" : date = tanggal kegiatan, title = nama kegiatan, detail = jam / tempat (boleh kosong) */
    function fromRows(rows) {
        if (!rows.length) throw new Error("Sheet info kosong.");
        const header = rows[0].map((h) => text(h).toLowerCase());
        const col = (n) => header.indexOf(n);
        ["type", "date"].forEach((n) => {
            if (col(n) === -1)
                throw new Error(`Kolom '${n}' tidak ada di sheet info.`);
            });
            const get = (r, n) => (col(n) === -1 ? "" : text(r[col(n)]));

            const out = { meta: { isMockData: false }, alert: null, schedule: [] };
            rows.slice(1).forEach((r) => {
                const type = get(r, "type").toLowerCase();
                const date = get(r, "date");
                if (type === "alert") {
                    // Bila ada beberapa baris alert, pakai yang tanggalnya paling baru.
                    if (!out.alert || date >= (out.alert.updated || "")) {
                        out.alert = {
                            message: get(r, "detail") || get(r, "title"),
                            updated: date,
                            expires: get(r, "expires"),
                        };
                    }
                } else if (type === "schedule") {
                    out.schedule.push({
                        date,
                        title: get(r, "title"),
                        detail: get(r, "detail"),
                    });
                }
            });
            return out;
        }

    /* ---------- Muat data ---------- */
    async function fetchInfo() {
        if (typeof infoSource === "undefined")
            throw new Error("infoSource belum ada di config.js");
        if (infoSource.type === "sheets") {
            if (!ohsUtils.isSafeUrl(infoSource.sheetsCsvUrl))
                throw new Error("infoSource.sheetsCsvUrl belum diisi URL https:// yang valid.",);
            
            const res = await fetch(infoSource.sheetsCsvUrl, { cache: "no-cache" });
            if (!res.ok)
                throw new Error(`Gagal memuat sheet info (HTTP ${res.status})`);
            return normalize(fromRows(DataService.parseCsv(await res.text())));
        }
        const res = await fetch(infoSource.localUrl, { cache: "no-cache" });
        if (!res.ok)
            throw new Error(`Gagal memuat ${infoSource.localUrl} (HTTP ${res.status})`,);
        return normalize(await res.json());
    }

    async function load() {
        try {
            state.info = await fetchInfo();
            state.failed = false;
        } catch (err) {
            console.warn("[OHS Info]", err);
            state.info = null;
            state.failed = true;
        }
        render();
    }

    /* ---------- Tampilan ---------- */
    function render() {
        const alertCard = $("alertCard");
        const list = $("scheduleList");
        if (!alertCard || !list) return;
        const today = todayIso();
        state.renderedDay = today;
        
        if (state.failed || !state.info) {
            alertCard.hidden = true;
            list.innerHTML =
            '<li class="info-empty">Informasi belum dapat dimuat.</li>';
            $("infoMock").hidden = true;
            return;
        }
        const info = state.info;
        
        // Safety Alert: tampil hanya bila ada isi dan belum lewat tanggal berlaku.
        const a = info.alert;
        const alive = Boolean(
            a &&
            a.message &&
            (!a.expires || !isoOrNull(a.expires) || a.expires >= today),
        );
        alertCard.hidden = !alive;
        if (alive) {
            $("alertText").textContent = a.message;
            const bits = [];
            if (a.updated && isoOrNull(a.updated))
                bits.push(`Diperbarui ${dateBits(a.updated).long}`);
            if (a.expires && isoOrNull(a.expires))
                bits.push(`berlaku sampai ${dateBits(a.expires).long}`);
            $("alertMeta").textContent = bits.join(" · ");
        }
        
        // Jadwal: hanya yang hari ini atau mendatang, urut tanggal, maksimal MAX_SCHEDULE.
        const upcoming = info.schedule
        .filter((s) => s.date >= today)
        .sort((x, y) => x.date.localeCompare(y.date))
        .slice(0, MAX_SCHEDULE);
        list.innerHTML = upcoming.length ? upcoming
        .map((s) => {
            const b = dateBits(s.date);
            const isToday = s.date === today;
            return `
            <li class="sch-item">
            <div class="sch-date" aria-hidden="true"><span class="sch-day">${b.day}</span><span class="sch-mon">${esc(b.mon)}</span></div>
            <div class="sch-body">
            <div class="sch-title"><span class="visually-hidden">${esc(b.long)}. </span>${esc(s.title)}</div>
            ${s.detail ? `<div class="sch-detail">${esc(s.detail)}</div>` : ""}
            </div>
            ${isToday ? '<span class="sch-today">Hari ini</span>' : ""}
            </li>`;
        }).join("") : '<li class="info-empty">Belum ada jadwal mendatang.</li>';
        $("infoMock").hidden = !info.isMock;
    }
    
    function start() {
        startClock();
        return load();
    }
    
    return { start, load, normalize, fromRows };
})();