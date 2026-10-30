/* ==========================================================
    scoring.js
    Menghitung SKOR dan STATUS tiap indikator dari angka realisasi,
    serta SKOR TOTAL. Semua aturan dibaca dari ohsConfig (config.js);
    file ini hanya berisi cara menghitungnya.

    - MTD (Month To Date) : nilai bulan itu saja. INI angka utama.
    - YTD (Year To Date)  : dari Januari sampai bulan itu.
   ========================================================== */

const Scoring = (() => {
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const round1 = (n) => Math.round(n * 10) / 10;

    /* 0.1 -> "0,1"; 4.75 -> "4,75"; 1200 -> "1200" (maksimal 2 desimal) */
    const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

    const withUnit = (rule, n) => `${fmt(n)}${rule.unit ? " " + rule.unit : ""}`;
    const validTarget = (t) => typeof t === "number" && Number.isFinite(t) && t >= 0; // 0 sah (target 0 orang)
    const passRatioOf = (rule) => rule.passRatio === undefined ? 1 : rule.passRatio;

    /* Skor + status satu indikator untuk SATU periode (satu bulan, atau total YTD).
    value  = realisasi (angka >= 0) atau null
    target = target periode itu (jenis "progress"); jenis lain mengabaikannya
    Hasil: { score, passed } atau null bila belum bisa dihitung. */
    function evaluate(def, value, target) {
        if (!def || !def.rule || value === null || value === undefined || !(value >= 0))
            return null;
        
        const rule = def.rule;
        const cfg = ohsConfig.scoring;
        
        if (rule.type === "zero") {
            const passed = value === 0;
            return { score: passed ? 100 : 0, passed };
        }
        if (rule.type === "rate") {
            const raw = (2 - value / rule.target) * 100;
            return {
                score: round1(cfg.capRateScore ? clamp(raw, 0, 100) : raw),
                passed: value <= rule.target,
            };
        }
        if (rule.type === "progress") {
            if (!validTarget(target)) return null;
            if (target === 0) return { score: 100, passed: true }; // "Target & Realisasi 0" di laporan OHS

            const ratio = value / target;
            const raw = ratio * 100;
            return {
                score: round1(cfg.capProgressScore ? clamp(raw, 0, 100) : raw),
                passed: ratio >= passRatioOf(rule),
            };
        }
    return null;
}

    /* YTD sampai bulan index i (0 = Januari) dari daftar bulan `monthly`.
     Hanya dihitung bila semua bulan Januari..i terisi. Hasil: { realisasi, target, score, passed } | null */
    function evaluateYtd(def, monthly, i) {
        if (!def || !def.rule) return null;
        const upto = monthly.slice(0, i + 1);
        let realisasi = null;
        let target = null;

        if (def.rule.type === "rate") {
            realisasi = monthly[i].realisasiYtd;
        } else if (upto.every((m) => m.realisasi !== null)) {
            realisasi = upto.reduce((sum, m) => sum + m.realisasi, 0);
            if (def.rule.type === "progress") {
                if (!upto.every((m) => validTarget(m.target))) return null;
                target = upto.reduce((sum, m) => sum + m.target, 0);
            }
        }
        const res = evaluate(def, realisasi, target);
        return res ? { realisasi, target, score: res.score, passed: res.passed } : null;
    }

    /* Skor (skala 0-100) yang menjadi batas "Tercapai"; dipakai sebagai garis target di grafik. */
    function passScore(def) {
        const r = def && def.rule;
        if (!r) return null;
        return r.type === "progress" ? round1(passRatioOf(r) * 100) : 100;
    }

    /* Angka + satuan, mis. "0,12", "58 orang", "0 kejadian". */
    const valueText = (def, n) => withUnit(def.rule, n);

    /* Teks batas "Tercapai" untuk SATU bulan. target = target bulan itu (jenis "progress"). */
    function targetText(def, target) {
        const r = def.rule;
        if (r.type === "zero") return `0 ${r.unit}`;
        if (r.type === "rate") return `≤ ${withUnit(r, r.target)}`;
        return validTarget(target) ? withUnit(r, target) : "belum diisi di sheet";
    }

    /* Realisasi dalam satu teks. entry = { realisasi, target }.
     zero/rate : "0,11"            progress : "58 dari 60 orang" */
    function actualText(def, entry) {
        const r = def.rule;
        if (r.type !== "progress" || !validTarget(entry.target))
            return valueText(def, entry.realisasi);
        return `${fmt(entry.realisasi)} dari ${withUnit(r, entry.target)}`;
    }

    /* Satu baris ringkas MTD untuk kartu dan popup: realisasi + target. */
    function summaryText(def, entry) {
        const r = def.rule;
        if (r.type === "progress") {
            return validTarget(entry.target)
            ? `Realisasi ${actualText(def, entry)}`
            : `Realisasi ${valueText(def, entry.realisasi)} · target belum diisi`;
        }
    return `Realisasi ${valueText(def, entry.realisasi)} · Target ${targetText(def)}`;
    }

    /* Satu baris YTD untuk kartu dan popup, mis. "YTD: 1038 dari 1036 orang · 100,2%". */
    function ytdText(def, ytd) {
        const r = def.rule;
        const body = r.type === "progress" ? actualText(def, ytd) : valueText(def, ytd.realisasi);
        return `YTD: ${body} · ${fmt(ytd.performance)}%`;
    }

    /* Kalimat penjelas "Mengapa nilainya demikian?" untuk SATU bulan (teks biasa, belum di-escape). */
    function explain(def, value, target) {
        const r = def.rule;
        const cfg = ohsConfig.scoring;
        if (value === null || value === undefined)
            return "Belum ada data untuk periode ini sehingga skor belum dapat dihitung.";
        
        const res = evaluate(def, value, target);
        if (!res) {
            return `Realisasi ${valueText(def, value)}, tetapi target bulan ini belum diisi di sheet sehingga skor belum dapat dihitung.`;
        }
    
        const real = withUnit(r, value);
        const skor = `${fmt(res.score)}%`;
        const verdict = res.passed ? "Tercapai" : "Belum tercapai";
        
        if (r.type === "zero") {
            return value === 0
            ? `Tidak ada ${r.unit} (realisasi 0), sehingga skor 100% dan status ${verdict}.`
            : `Terjadi ${real} (target 0), sehingga skor 0% dan status ${verdict}.`;
        }
    
        if (r.type === "rate") {
            const rel = value <= r.target ? "tidak melebihi" : "melebihi";
            const cut = (2 - value / r.target) * 100;
            let calc = skor;
            if (cfg.capRateScore && (cut > 100 || cut < 0))
                calc = `${fmt(cut)}%, dibatasi 0–100% menjadi ${skor}`;
            else if (res.score > 100)
                calc = `${skor} (di atas 100% berarti lebih baik dari target)`;
            else if (res.score < 0)
                calc = `${skor} (negatif karena realisasi lebih dari 2× target)`;
            return `Realisasi ${real} ${rel} batas ${withUnit(r, r.target)}. Skor = 2 − (${fmt(value)} ÷ ${fmt(r.target)}) = ${calc}; status ${verdict}.`;
        }
        if (target === 0) {
            return value === 0
            ? `Target bulan ini ${withUnit(r, 0)} dan realisasi 0, sehingga skor 100% dan status ${verdict}.`
            : `Target bulan ini ${withUnit(r, 0)} sedangkan realisasi ${real}, sehingga skor 100% dan status ${verdict}.`;
        }

        const ratio = value / target;
        let calc = skor;
        if (cfg.capProgressScore && ratio > 1)
            calc = `${fmt(ratio * 100)}%, dibatasi 100% menjadi ${skor}`;
        else if (ratio > 1)
            calc = `${skor} (di atas 100% berarti melampaui target)`;
        return `Realisasi ${real} dari target ${withUnit(r, target)}. Skor = ${fmt(value)} ÷ ${fmt(target)} = ${calc}; status ${verdict}.`;
    }

    /* Skor total per bulan (12 elemen). kind = "mtd" (default) atau "ytd".
        Hanya dihitung bila SEMUA indikator punya skor pada bulan itu; kalau tidak -> null (tidak ada skor sebagian). */
    function totalByMonth(indicators, kind) {
        const defs = ohsConfig.indicators;
        return Array.from({ length: 12 }, (_, i) => {
            let sum = 0;
            for (const def of defs) {
                const ind = indicators.find((x) => x.id === def.id);
                const entry = ind && ind.monthly[i];
                const score = !entry ? null : kind === "ytd" ? entry.ytd ? entry.ytd.performance : null : entry.performance;
                
                if (score === null) return { month: i + 1, total: null, passed: null };
                sum += (def.weight / 100) * score;
            }
            
            const total = round1(sum);
            return {
                month: i + 1,
                total,
                passed: total >= ohsConfig.scoring.totalTarget,
            };
        });
    }
    
    return {
        evaluate,
        evaluateYtd,
        passScore,
        targetText,
        valueText,
        actualText,
        summaryText,
        ytdText,
        explain,
        totalByMonth,
        fmt,
    };
})();
