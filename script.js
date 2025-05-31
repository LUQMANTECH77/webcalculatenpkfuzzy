// Inisialisasi jsPDF
const { jsPDF } = window.jspdf;

// Variabel untuk menyimpan detail perhitungan terakhir
let lastFuzzyDetails = null;
let lastRecommendation = null;
let lastInputs = null;

// Fungsi Fuzzy Sugeno
function trapezoid(x, a, b, c, d) {
    if (x < a) return 0;
    if (x >= a && x < b) return (x - a) / (b - a);
    if (x >= b && x <= c) return 1;
    if (x > c && x <= d) return (d - x) / (d - c);
    return 0;
}

function fuzzySugeno(n, p, k) {
    // 1. Perbaiki rentang keanggotaan Nitrogen untuk interpolasi yang lebih baik
    const nR = trapezoid(n, 0, 0, 4, 5);    // Rendah: [0,0,4,5]
    const nS = trapezoid(n, 4, 5, 6, 7);    // Sedang: [4,5,6,7]
    const nT = trapezoid(n, 6, 7, 10, 10);  // Tinggi: [6,7,10,10]

    // 2. Hitung derajat keanggotaan untuk Phosphate (0-50 mg/kg)
    const pR = trapezoid(p, 0, 0, 19, 20);   // Rendah: [0,0,19,20]
    const pS = trapezoid(p, 19, 20, 40, 41); // Sedang: [19,20,40,41]
    const pT = trapezoid(p, 40, 41, 50, 50); // Tinggi: [40,41,50,50]

    // 3. Hitung derajat keanggotaan untuk Kalium (0-30 mg/kg)
    const kR = trapezoid(k, 0, 0, 9, 10);    // Rendah: [0,0,9,10]
    const kS = trapezoid(k, 9, 10, 20, 21);  // Sedang: [9,10,20,21]
    const kT = trapezoid(k, 20, 21, 30, 30); // Tinggi: [20,21,30,30]

    // 4. Perbaiki nilai urea pada aturan Nitrogen sedang
    const rules = [
        // Rule 1-9: Nitrogen RENDAH
        { w: Math.min(nR, pR, kR), urea: 200, sp36: 100, kcl: 100, condition: "N:Rendah, P:Rendah, K:Rendah" },
        { w: Math.min(nR, pR, kS), urea: 200, sp36: 100, kcl: 50, condition: "N:Rendah, P:Rendah, K:Sedang" },
        { w: Math.min(nR, pR, kT), urea: 200, sp36: 100, kcl: 50, condition: "N:Rendah, P:Rendah, K:Tinggi" },
        { w: Math.min(nR, pS, kR), urea: 200, sp36: 75, kcl: 100, condition: "N:Rendah, P:Sedang, K:Rendah" },
        { w: Math.min(nR, pS, kS), urea: 200, sp36: 75, kcl: 50, condition: "N:Rendah, P:Sedang, K:Sedang" },
        { w: Math.min(nR, pS, kT), urea: 200, sp36: 75, kcl: 50, condition: "N:Rendah, P:Sedang, K:Tinggi" },
        { w: Math.min(nR, pT, kR), urea: 200, sp36: 50, kcl: 100, condition: "N:Rendah, P:Tinggi, K:Rendah" },
        { w: Math.min(nR, pT, kS), urea: 200, sp36: 50, kcl: 50, condition: "N:Rendah, P:Tinggi, K:Sedang" },
        { w: Math.min(nR, pT, kT), urea: 200, sp36: 50, kcl: 50, condition: "N:Rendah, P:Tinggi, K:Tinggi" },
        
        // Rule 10-18: Nitrogen SEDANG (urea dinaikkan menjadi 300)
        { w: Math.min(nS, pR, kR), urea: 300, sp36: 100, kcl: 100, condition: "N:Sedang, P:Rendah, K:Rendah" },
        { w: Math.min(nS, pR, kS), urea: 300, sp36: 100, kcl: 50, condition: "N:Sedang, P:Rendah, K:Sedang" },
        { w: Math.min(nS, pR, kT), urea: 300, sp36: 100, kcl: 50, condition: "N:Sedang, P:Rendah, K:Tinggi" },
        { w: Math.min(nS, pS, kR), urea: 300, sp36: 75, kcl: 100, condition: "N:Sedang, P:Sedang, K:Rendah" },
        { w: Math.min(nS, pS, kS), urea: 300, sp36: 75, kcl: 50, condition: "N:Sedang, P:Sedang, K:Sedang" },
        { w: Math.min(nS, pS, kT), urea: 300, sp36: 75, kcl: 50, condition: "N:Sedang, P:Sedang, K:Tinggi" },
        { w: Math.min(nS, pT, kR), urea: 300, sp36: 50, kcl: 100, condition: "N:Sedang, P:Tinggi, K:Rendah" },
        { w: Math.min(nS, pT, kS), urea: 300, sp36: 50, kcl: 50, condition: "N:Sedang, P:Tinggi, K:Sedang" },
        { w: Math.min(nS, pT, kT), urea: 300, sp36: 50, kcl: 50, condition: "N:Sedang, P:Tinggi, K:Tinggi" },
        
        // Rule 19-27: Nitrogen TINGGI (urea dinaikkan menjadi 400)
        { w: Math.min(nT, pR, kR), urea: 400, sp36: 100, kcl: 100, condition: "N:Tinggi, P:Rendah, K:Rendah" },
        { w: Math.min(nT, pR, kS), urea: 400, sp36: 100, kcl: 50, condition: "N:Tinggi, P:Rendah, K:Sedang" },
        { w: Math.min(nT, pR, kT), urea: 400, sp36: 100, kcl: 50, condition: "N:Tinggi, P:Rendah, K:Tinggi" },
        { w: Math.min(nT, pS, kR), urea: 400, sp36: 75, kcl: 100, condition: "N:Tinggi, P:Sedang, K:Rendah" },
        { w: Math.min(nT, pS, kS), urea: 400, sp36: 75, kcl: 50, condition: "N:Tinggi, P:Sedang, K:Sedang" },
        { w: Math.min(nT, pS, kT), urea: 400, sp36: 75, kcl: 50, condition: "N:Tinggi, P:Sedang, K:Tinggi" },
        { w: Math.min(nT, pT, kR), urea: 400, sp36: 50, kcl: 100, condition: "N:Tinggi, P:Tinggi, K:Rendah" },
        { w: Math.min(nT, pT, kS), urea: 400, sp36: 50, kcl: 50, condition: "N:Tinggi, P:Tinggi, K:Sedang" },
        { w: Math.min(nT, pT, kT), urea: 400, sp36: 50, kcl: 50, condition: "N:Tinggi, P:Tinggi, K:Tinggi" }
    ];

    // 5. Hitung total bobot
    const totalW = rules.reduce((sum, rule) => sum + rule.w, 0);

    // 6. Jika tidak ada rule yang aktif, berikan nilai default
    if (totalW === 0) {
        return {
            urea: 200,
            sp36: 75,
            kcl: 50,
            nR, nS, nT,
            pR, pS, pT,
            kR, kS, kT,
            rules,
            totalW
        };
    }

    // 7. Hitung rata-rata tertimbang (WTAVER)
    const hasil = {
        urea: rules.reduce((sum, rule) => sum + (rule.w * rule.urea), 0) / totalW,
        sp36: rules.reduce((sum, rule) => sum + (rule.w * rule.sp36), 0) / totalW,
        kcl: rules.reduce((sum, rule) => sum + (rule.w * rule.kcl), 0) / totalW,
        nR, nS, nT,
        pR, pS, pT,
        kR, kS, kT,
        rules,
        totalW
    };

    return hasil;
}

function calculateFertilizerRecommendation(avgN, avgP, avgK, area) {
    const fuzzy = fuzzySugeno(avgN, avgP, avgK);
    
    return {
        urea: { 
            rate: fuzzy.urea.toFixed(1), 
            total: (fuzzy.urea * area).toFixed(1) 
        },
        sp36: { 
            rate: fuzzy.sp36.toFixed(1), 
            total: (fuzzy.sp36 * area).toFixed(1) 
        },
        kcl: { 
            rate: fuzzy.kcl.toFixed(1), 
            total: (fuzzy.kcl * area).toFixed(1) 
        },
        details: fuzzy
    };
}

// Fungsi untuk memperbarui visualisasi
function updateVisualization(n, p, k) {
    // Hitung persentase untuk visualisasi
    const nPercent = Math.min(100, (n / 10) * 100);
    const pPercent = Math.min(100, (p / 50) * 100);
    const kPercent = Math.min(100, (k / 30) * 100);
    
    document.getElementById('n-bar').style.height = nPercent + '%';
    document.getElementById('p-bar').style.height = pPercent + '%';
    document.getElementById('k-bar').style.height = kPercent + '%';
    
    document.getElementById('n-value').textContent = n + ' mg/kg';
    document.getElementById('p-value').textContent = p + ' mg/kg';
    document.getElementById('k-value').textContent = k + ' mg/kg';
}

// Fungsi untuk menampilkan hasil
function displayResults(results) {
    const resultsContainer = document.getElementById('recommendation-results');
    resultsContainer.innerHTML = `
        <div class="fertilizer-result">
            <div class="fertilizer-name">Urea</div>
            <div class="fertilizer-rate">${results.urea.rate} kg/ha</div>
            <div class="fertilizer-total">${results.urea.total} kg</div>
        </div>
        <div class="fertilizer-result">
            <div class="fertilizer-name">SP-36</div>
            <div class="fertilizer-rate">${results.sp36.rate} kg/ha</div>
            <div class="fertilizer-total">${results.sp36.total} kg</div>
        </div>
        <div class="fertilizer-result">
            <div class="fertilizer-name">KCl</div>
            <div class="fertilizer-rate">${results.kcl.rate} kg/ha</div>
            <div class="fertilizer-total">${results.kcl.total} kg</div>
        </div>
    `;
}

// Fungsi untuk menampilkan detail fuzzy
function displayFuzzyDetails(details) {
    // Tampilkan derajat keanggotaan
    document.getElementById('nR-value').textContent = details.nR.toFixed(2);
    document.getElementById('nS-value').textContent = details.nS.toFixed(2);
    document.getElementById('nT-value').textContent = details.nT.toFixed(2);
    
    document.getElementById('pR-value').textContent = details.pR.toFixed(2);
    document.getElementById('pS-value').textContent = details.pS.toFixed(2);
    document.getElementById('pT-value').textContent = details.pT.toFixed(2);
    
    document.getElementById('kR-value').textContent = details.kR.toFixed(2);
    document.getElementById('kS-value').textContent = details.kS.toFixed(2);
    document.getElementById('kT-value').textContent = details.kT.toFixed(2);
    
    // Tampilkan aturan yang aktif
    const activeRulesBody = document.querySelector('#active-rules tbody');
    activeRulesBody.innerHTML = '';
    
    details.rules
        .filter(rule => rule.w > 0)
        .forEach(rule => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rule.condition}</td>
                <td>${rule.w.toFixed(2)}</td>
                <td>${rule.urea}</td>
                <td>${rule.sp36}</td>
                <td>${rule.kcl}</td>
            `;
            activeRulesBody.appendChild(row);
        });
    
    // Tampilkan hasil perhitungan
    document.getElementById('totalW-value').textContent = details.totalW.toFixed(2);
    document.getElementById('urea-result').textContent = details.urea.toFixed(1);
    document.getElementById('sp36-result').textContent = details.sp36.toFixed(1);
    document.getElementById('kcl-result').textContent = details.kcl.toFixed(1);
    
    // Tampilkan section detail
    document.getElementById('fuzzy-details').style.display = 'block';
}

// Fungsi untuk membuat PDF
function generatePDF() {
    if (!lastFuzzyDetails || !lastRecommendation || !lastInputs) {
        alert('Silakan hitung rekomendasi terlebih dahulu sebelum mencetak PDF');
        return;
    }
    
    const doc = new jsPDF();
    let yPos = 15;
    
    // Judul
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN REKOMENDASI PEMUPUKAN', 105, yPos, null, null, 'center');
    yPos += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistem Fuzzy Sugeno untuk Rekomendasi Pupuk', 105, yPos, null, null, 'center');
    yPos += 15;
    
    // Garis pemisah
    doc.setLineWidth(0.5);
    doc.line(15, yPos, 195, yPos);
    yPos += 10;
    
    // Data input
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA INPUT', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nitrogen (N): ${lastInputs.n} mg/kg`, 20, yPos);
    yPos += 8;
    doc.text(`Phosphate (P): ${lastInputs.p} mg/kg`, 20, yPos);
    yPos += 8;
    doc.text(`Kalium (K): ${lastInputs.k} mg/kg`, 20, yPos);
    yPos += 8;
    doc.text(`Luas Area: ${lastInputs.area} hektar`, 20, yPos);
    yPos += 15;
    
    // Rekomendasi pupuk
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REKOMENDASI PEMUPUKAN', 20, yPos);
    yPos += 10;
    
    // Tabel rekomendasi
    const recommendationData = [
        ['Pupuk', 'Dosis (kg/ha)', `Total (kg) untuk ${lastInputs.area} ha`],
        ['Urea', lastRecommendation.urea.rate, lastRecommendation.urea.total],
        ['SP-36', lastRecommendation.sp36.rate, lastRecommendation.sp36.total],
        ['KCl', lastRecommendation.kcl.rate, lastRecommendation.kcl.total]
    ];
    
    doc.autoTable({
        startY: yPos,
        head: [recommendationData[0]],
        body: recommendationData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: [44, 119, 68] },
        styles: { fontSize: 12 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // Detail fuzzy
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAIL PERHITUNGAN FUZZY SUGENO', 20, yPos);
    yPos += 10;
    
    // Derajat keanggotaan
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Derajat Keanggotaan:', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nitrogen Rendah: ${lastFuzzyDetails.nR.toFixed(2)}`, 30, yPos);
    yPos += 6;
    doc.text(`Nitrogen Sedang: ${lastFuzzyDetails.nS.toFixed(2)}`, 30, yPos);
    yPos += 6;
    doc.text(`Nitrogen Tinggi: ${lastFuzzyDetails.nT.toFixed(2)}`, 30, yPos);
    yPos += 10;
    
    doc.text(`Phosphate Rendah: ${lastFuzzyDetails.pR.toFixed(2)}`, 110, yPos - 16);
    doc.text(`Phosphate Sedang: ${lastFuzzyDetails.pS.toFixed(2)}`, 110, yPos - 10);
    doc.text(`Phosphate Tinggi: ${lastFuzzyDetails.pT.toFixed(2)}`, 110, yPos - 4);
    
    doc.text(`Kalium Rendah: ${lastFuzzyDetails.kR.toFixed(2)}`, 170, yPos - 16);
    doc.text(`Kalium Sedang: ${lastFuzzyDetails.kS.toFixed(2)}`, 170, yPos - 10);
    doc.text(`Kalium Tinggi: ${lastFuzzyDetails.kT.toFixed(2)}`, 170, yPos - 4);
    yPos += 10;
    
    // Aturan yang aktif
    doc.setFont('helvetica', 'bold');
    doc.text('Aturan yang Aktif (Bobot > 0):', 20, yPos);
    yPos += 8;
    
    const activeRules = lastFuzzyDetails.rules.filter(rule => rule.w > 0);
    const rulesData = activeRules.map(rule => [
        rule.condition,
        rule.w.toFixed(2),
        rule.urea,
        rule.sp36,
        rule.kcl
    ]);
    
    doc.autoTable({
        startY: yPos,
        head: [['Kondisi', 'Bobot', 'Urea', 'SP-36', 'KCl']],
        body: rulesData,
        theme: 'grid',
        headStyles: { fillColor: [13, 71, 161] },
        styles: { fontSize: 9 },
        margin: { top: 10 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // Hasil perhitungan
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Hasil Perhitungan:', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Bobot: ${lastFuzzyDetails.totalW.toFixed(2)}`, 30, yPos);
    yPos += 8;
    
    // Hitung nilai pembilang untuk setiap pupuk
    const ureaNumerator = activeRules.reduce((sum, rule) => sum + (rule.w * rule.urea), 0);
    const sp36Numerator = activeRules.reduce((sum, rule) => sum + (rule.w * rule.sp36), 0);
    const kclNumerator = activeRules.reduce((sum, rule) => sum + (rule.w * rule.kcl), 0);
    
    doc.text(`Urea: ${ureaNumerator.toFixed(2)} / ${lastFuzzyDetails.totalW.toFixed(2)} = ${lastFuzzyDetails.urea.toFixed(1)} kg/ha`, 30, yPos);
    yPos += 8;
    
    doc.text(`SP-36: ${sp36Numerator.toFixed(2)} / ${lastFuzzyDetails.totalW.toFixed(2)} = ${lastFuzzyDetails.sp36.toFixed(1)} kg/ha`, 30, yPos);
    yPos += 8;
    
    doc.text(`KCl: ${kclNumerator.toFixed(2)} / ${lastFuzzyDetails.totalW.toFixed(2)} = ${lastFuzzyDetails.kcl.toFixed(1)} kg/ha`, 30, yPos);
    yPos += 15;
    
    // Rumus perhitungan
    doc.setFont('helvetica', 'bold');
    doc.text('Rumus Perhitungan:', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.text('Hasil = Σ(w_i * output_i) / Σ(w_i)', 30, yPos);
    yPos += 8;
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString()}`, 105, 285, null, null, 'center');
    
    // Simpan PDF
    doc.save('rekomendasi_pemupukan.pdf');
}

// Event listener untuk tombol hitung
document.getElementById('calculate-btn').addEventListener('click', function() {
    // Ambil nilai input
    const n = parseFloat(document.getElementById('nitrogen').value) || 0;
    const p = parseFloat(document.getElementById('phosphate').value) || 0;
    const k = parseFloat(document.getElementById('potassium').value) || 0;
    const area = parseFloat(document.getElementById('area').value) || 1;
    
    // Validasi input
    if (n < 0 || n > 10) {
        alert('Nilai Nitrogen harus antara 0-10 mg/kg');
        return;
    }
    if (p < 0 || p > 50) {
        alert('Nilai Phosphate harus antara 0-50 mg/kg');
        return;
    }
    if (k < 0 || k > 30) {
        alert('Nilai Kalium harus antara 0-30 mg/kg');
        return;
    }
    if (area <= 0) {
        alert('Luas area harus lebih besar dari 0');
        return;
    }
    
    // Simpan input
    lastInputs = { n, p, k, area };
    
    // Perbarui visualisasi
    updateVisualization(n, p, k);
    
    // Hitung rekomendasi
    const results = calculateFertilizerRecommendation(n, p, k, area);
    lastRecommendation = results;
    lastFuzzyDetails = results.details;
    
    // Tampilkan hasil
    displayResults(results);
    
    // Tampilkan detail fuzzy
    displayFuzzyDetails(results.details);
});

// Event listener untuk tombol PDF
document.getElementById('pdf-btn').addEventListener('click', generatePDF);

// Contoh data untuk demonstrasi
window.addEventListener('load', function() {
    document.getElementById('nitrogen').value = '5.5';
    document.getElementById('phosphate').value = '25';
    document.getElementById('potassium').value = '15';
    document.getElementById('area').value = '2.5';
    
    // Otomatis hitung saat halaman dimuat
    document.getElementById('calculate-btn').click();
});