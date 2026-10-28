/* ==========================================================
    scoring.js
    Menghitung SKOR dan STATUS tiap indikator dari angka realisasi,
    serta SKOR TOTAL. Semua aturan dibaca dari ohsConfig (config.js);
    file ini hanya berisi cara menghitungnya.
   ========================================================== */

const Scoring = (() => {
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const round1 = (n) => Math.round(n * 10) / 10;
    
    /* 0.1 -> "0,1"; 4.75 -> "4,75"; 12 -> "12" (maksimal 2 desimal) */
    const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
    const withUnit = (rule, n) => `${fmt(n)}${rule.unit ? " " + rule.unit : ""}`;
    const validTarget = (t) => typeof t === "number" && Number.isFinite(t) && t > 0;
    const passRatioOf = (rule) => rule.passRatio === undefined ? 1 : rule.passRatio;
    
    /* Hitung hasil satu indikator. value = realisasi (angka >= 0) atau null.
    Hasil: { score, passed, passScore } atau null bila belum ada data. */
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
            const ratio = value / target;
            const raw = ratio * 100;
            return {
                score: round1(cfg.capProgressScore ? clamp(raw, 0, 100) : raw),
                passed: ratio >= passRatioOf(rule),
            };
        }
        return null;
    }

    /* Skor (pada skala 0-100) yang menjadi batas "Tercapai"; dipakai sebagai garis target di grafik. */
    function passScore(def) {
        const r = def && def.rule;
        if (!r) return null;
        return r.type === "progress" ? round1(passRatioOf(r) * 100) : 100;
    }
    
    /* Angka + satuan, mis. "0,12", "58 orang", "0 kejadian". */
    const valueText = (def, n) => withUnit(def.rule, n);
    
    /* Teks batas "Tercapai". target = target bulan itu (untuk jenis "progress"). short = true -> tanpa keterangan tambahan (untuk kartu yang sempit). */
    function targetText(def, target, short) {
        const r = def.rule;
        if (r.type === "zero") return `0 ${r.unit}`;
        if (r.type === "rate") return `≤ ${withUnit(r, r.target)}`;
        if (!validTarget(target)) return "belum diisi di sheet";
        
        const base = withUnit(r, target);
        const ratio = passRatioOf(r);
        
        return short || ratio >= 1 ? base : `${base} (Tercapai mulai ${fmt(ratio * 100)}% dari target)`;
    }

    /* Realisasi dalam satu teks. entry = { realisasi, target }.
     zero/rate : "0,11"            progress : "58 dari 60 orang" */
    function actualText(def, entry) {
        const r = def.rule;
        if (r.type !== "progress" || !validTarget(entry.target)) return valueText(def, entry.realisasi);
        return `${fmt(entry.realisasi)} dari ${withUnit(r, entry.target)}`;
    }

    /* Satu baris ringkas untuk kartu dan popup: realisasi + target. */
    function summaryText(def, entry) {
        const r = def.rule;
        if (r.type === "progress") {
            return validTarget(entry.target)
            ? `Realisasi ${actualText(def, entry)}`
            : `Realisasi ${valueText(def, entry.realisasi)} · target belum diisi`;
        }
        return `Realisasi ${valueText(def, entry.realisasi)} · Target ${targetText(def)}`;
    }
    
    /* Kalimat penjelas "Mengapa nilainya demikian?" (teks biasa, belum di-escape). */
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
        
        const ratio = value / target;
        const capped = cfg.capProgressScore && ratio > 1;
        const calc = capped ? `${fmt(ratio * 100)}%, dibatasi 100% menjadi ${skor}` : skor;
        const need = passRatioOf(r) < 1 ? ` Tercapai mulai ${fmt(passRatioOf(r) * 100)}% dari target.` : "";
        return `Realisasi ${real} dari target ${withUnit(r, target)}. Skor = ${fmt(value)} ÷ ${fmt(target)} = ${calc}; status ${verdict}.${need}`;
    }

    /* Skor total per bulan (12 elemen). Hanya dihitung bila SEMUA indikator punya skor pada bulan itu; kalau tidak -> null (tidak ada skor sebagian). */
    function totalByMonth(indicators) {
        const defs = ohsConfig.indicators;
        return Array.from({ length: 12 }, (_, i) => {
            let sum = 0;
            for (const def of defs) {
                const ind = indicators.find((x) => x.id === def.id);
                const entry = ind && ind.monthly[i];
                if (!entry || entry.performance === null)
                    return { month: i + 1, total: null, passed: null };
                sum += (def.weight / 100) * entry.performance;
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
        passScore,
        targetText,
        valueText,
        actualText,
        summaryText,
        explain,
        totalByMonth,
        fmt,
    };
})();
