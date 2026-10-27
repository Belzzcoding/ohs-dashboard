/* ==========================================================
    scoring.js
    Menghitung SKOR dan STATUS tiap indikator dari angka realisasi,
    serta SKOR TOTAL, sesuai "Katalog KPI Generic 2026 - Safety
    Performance". Semua aturan dibaca dari ohsConfig (config.js);
    file ini hanya berisi cara menghitungnya.

    Tiga jenis aturan (rule.type):
    - "zero"     : realisasi = jumlah kejadian. 0 kejadian -> skor 100, selain itu 0. (Fatality, NoFA)
    - "rate"     : makin kecil makin baik. skor = 2 - (realisasi / target). Tercapai bila realisasi <= target. (LTIFR, LTISR)
    - "progress" : makin besar makin baik. skor = realisasi / fullAt. Tercapai bila realisasi >= passAt. (SOT, MCU, CAM, SSD)
   ========================================================== */

const Scoring = (() => {
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const round1 = (n) => Math.round(n * 10) / 10;
    
    /* 0.1 -> "0,1"; 4.75 -> "4,75"; 12 -> "12" (maksimal 2 desimal) */
    const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
    
    const unitText = (rule) =>
        rule.unit ? (rule.unit === "%" ? "%" : ` ${rule.unit}`) : "";
    const withUnit = (rule, n) => `${fmt(n)}${unitText(rule)}`;
    
    /* Hitung hasil satu indikator. value = realisasi (angka >= 0) atau null.
    Hasil: { score, passed, passScore } atau null bila belum ada data. */
    function evaluate(def, value) {
        if (!def || !def.rule || value === null || value === undefined || !(value >= 0))
            return null;
        
        const rule = def.rule;
        const cap = ohsConfig.scoring.capScore;
        
        if (rule.type === "zero") {
            const passed = value === 0;
            return { score: passed ? 100 : 0, passed, passScore: 100 };
        }
        if (rule.type === "rate") {
            const raw = (2 - value / rule.target) * 100;
            return {
                score: round1(cap ? clamp(raw, 0, 100) : raw),
                passed: value <= rule.target,
                passScore: 100,
            };
        }
        if (rule.type === "progress") {
            return {
                score: round1(clamp((value / rule.fullAt) * 100, 0, 100)),
                passed: value >= rule.passAt,
                passScore: round1((rule.passAt / rule.fullAt) * 100),
            };
        }
        return null;
    }

    /* Skor (pada skala 0-100) yang menjadi batas "Tercapai"; dipakai sebagai garis target di grafik. */
    function passScore(def) {
        const r = def && def.rule;
        if (!r) return null;
        return r.type === "progress" ? round1((r.passAt / r.fullAt) * 100) : 100;
    }
    
    /* Angka + satuan, mis. "0,12", "1,4 ×/bulan", "92 %". */
    const valueText = (def, n) => withUnit(def.rule, n);
    
    /* Teks batas "Tercapai", mis. "≤ 0,25" atau "≥ 1 ×/bulan (nilai penuh di 2 ×/bulan)". short = true -> tanpa keterangan nilai penuh (untuk kartu yang sempit). */
    function targetText(def, short) {
        const r = def.rule;
        if (r.type === "zero") return `0 ${r.unit}`;
        if (r.type === "rate") return `≤ ${withUnit(r, r.target)}`;
        if (short || r.fullAt === r.passAt) return `≥ ${withUnit(r, r.passAt)}`;
        return `≥ ${withUnit(r, r.passAt)} (nilai penuh di ${withUnit(r, r.fullAt)})`;
    }
    
    /* Kalimat penjelas "Mengapa nilainya demikian?" (teks biasa, belum di-escape). */
    function explain(def, value) {
        const r = def.rule;
        const res = evaluate(def, value);
        
        if (!res)
            return "Belum ada data untuk periode ini sehingga skor belum dapat dihitung.";
    
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
            const capped = ohsConfig.scoring.capScore && (cut > 100 || cut < 0);
            const calc = capped
        ? `${fmt(cut)}%, dibatasi 0–100% menjadi ${skor}`
        : skor;
        return `Realisasi ${real} ${rel} batas ${withUnit(r, r.target)}. Skor = 2 − (${fmt(value)} ÷ ${fmt(r.target)}) = ${calc}; status ${verdict}.`;
    }
    
    const rel = value >= r.passAt ? "mencapai" : "belum mencapai";
    const full = value >= r.fullAt ? "Nilai penuh tercapai" : `Skor = ${fmt(value)} ÷ ${fmt(r.fullAt)} = ${skor}`;
    return `Realisasi ${real} ${rel} batas ${withUnit(r, r.passAt)}. ${full}, status ${verdict}.`;
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
        explain,
        totalByMonth,
        fmt,
    };
})();
