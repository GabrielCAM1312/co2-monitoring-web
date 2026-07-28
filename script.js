// =================================================================
// LOGIKA UTAMA MONITORING CO2 (SUDAH TERKONEKSI KE SUPABASE)
// =================================================================

// === Konfigurasi Mode ===
let useDummyData = false; 

// Menyimpan data lokal untuk chart dan tabel
let data = []; 
let dataHistorisFiltered = [];
let allSupabaseRecords = [];

// Fungsi pembantu nama tabel dari supabase-config.js
const getTableName = () => (typeof SUPABASE_TABLE_NAME !== "undefined" ? SUPABASE_TABLE_NAME : "monitoring");

// === 1. Inisialisasi Chart.js Modern ===
const ctx = document.getElementById("co2Chart").getContext("2d");

// Buat Gradient Fill untuk Chart
const gradientBg = ctx.createLinearGradient(0, 0, 0, 400);
gradientBg.addColorStop(0, "rgba(16, 185, 129, 0.25)");
gradientBg.addColorStop(1, "rgba(16, 185, 129, 0.0)");

// Plugin custom 1: Menggambar area latar belakang warna zona kualitas udara (Air Quality Zone Bands)
const chartZoneBandsPlugin = {
  id: 'chartZoneBands',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!scales || !scales.y || !chartArea) return;
    const { left, right, top, bottom } = chartArea;
    const y = scales.y;

    const zones = [
      { min: 0, max: 700, fill: "rgba(16, 185, 129, 0.03)" },
      { min: 700, max: 1000, fill: "rgba(245, 158, 11, 0.04)" },
      { min: 1000, max: 2000, fill: "rgba(249, 115, 22, 0.05)" },
      { min: 2000, max: 5000, fill: "rgba(239, 68, 68, 0.06)" }
    ];

    ctx.save();
    zones.forEach(z => {
      const yMinPos = y.getPixelForValue(z.min);
      const yMaxPos = y.getPixelForValue(z.max);

      const zoneTop = Math.max(top, Math.min(bottom, yMaxPos));
      const zoneBottom = Math.min(bottom, Math.max(top, yMinPos));
      const zoneHeight = zoneBottom - zoneTop;

      if (zoneHeight > 0) {
        ctx.fillStyle = z.fill;
        ctx.fillRect(left, zoneTop, right - left, zoneHeight);
      }
    });
    ctx.restore();
  }
};

// Plugin custom 2: Menggambar garis vertikal panduan kursor (Vertical Crosshair Line saat Hover)
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
      const activePoint = chart.tooltip._active[0];
      const { ctx } = chart;
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
      ctx.stroke();
      ctx.restore();
    }
  }
};

// Plugin custom 3: Menggambar garis batas ambang kualitas udara (Threshold Badge Lines)
const thresholdLinesPlugin = {
  id: 'thresholdLines',
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!scales || !scales.y || !chartArea) return;
    const { left, right, top, bottom } = chartArea;
    const y = scales.y;

    const thresholds = [
      { value: 700, label: "700 ppm (Waspada)", color: "#f59e0b", bg: "rgba(254, 243, 199, 0.95)" },
      { value: 1000, label: "1000 ppm (Buruk)", color: "#f97316", bg: "rgba(255, 237, 213, 0.95)" },
      { value: 2000, label: "2000 ppm (Kritis)", color: "#ef4444", bg: "rgba(254, 226, 226, 0.95)" }
    ];

    ctx.save();
    thresholds.forEach(t => {
      const yPos = y.getPixelForValue(t.value);
      if (yPos >= top && yPos <= bottom) {
        // Garis batas putus-putus
        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 1.5;
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();

        // Badge pill label di ujung kanan grafik
        ctx.font = "bold 10px 'Plus Jakarta Sans', sans-serif";
        const textWidth = ctx.measureText(t.label).width;
        const badgeWidth = textWidth + 14;
        const badgeHeight = 18;
        const badgeX = right - badgeWidth - 6;
        const badgeY = yPos - 9;

        // Background pill
        ctx.fillStyle = t.bg;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
          ctx.fill();
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        }

        // Teks label
        ctx.fillStyle = t.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
      }
    });
    ctx.restore();
  }
};

const co2Chart = new Chart(ctx, {
  type: "line",
  plugins: [chartZoneBandsPlugin, crosshairPlugin, thresholdLinesPlugin],
  data: {
    labels: [],
    datasets: [{
      label: "Kadar CO₂ (ppm)",
      data: [],
      borderColor: "#10b981",
      borderWidth: 2.5,
      backgroundColor: gradientBg,
      fill: true,
      tension: 0.35,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: [],
      pointBorderColor: "#ffffff",
      pointBorderWidth: 1.5,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' },
        bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          title: (tooltipItems) => {
            const dataIndex = tooltipItems[0].dataIndex;
            const currentItem = currentActiveDataset[dataIndex];
            return currentItem ? `🕒 Waktu: ${currentItem.waktu}` : tooltipItems[0].label;
          },
          label: (context) => {
            const val = context.parsed.y;
            let status = "🟢 Normal / Safe";
            if (val >= 2000) status = "🚨 Kritis / Berbahaya";
            else if (val >= 1000) status = "⚠️ Buruk / Sumpek";
            else if (val >= 700) status = "⚡ Waspada Sirkulasi";
            return [
              ` Kadar CO₂: ${val} ppm`,
              ` Status: ${status}`
            ];
          }
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: false, 
        grid: { color: "rgba(226, 232, 240, 0.6)" },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: "#64748b" },
        title: { display: true, text: "Konsentrasi (ppm)", font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' }, color: "#475569" }
      },
      x: { 
        grid: { display: false },
        ticks: { 
          font: { family: 'Plus Jakarta Sans', size: 11 }, 
          color: "#64748b",
          maxTicksLimit: 7,   // Maksimal 7 penanda waktu agar jarak antar teks sangat longgar dan rapi
          maxRotation: 0,     // Teks tetap murni mendatar
          autoSkip: true
        },
        title: { display: true, text: "Tanggal & Waktu Pengamatan (Tgl Bln, Jam:Menit)", font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' }, color: "#475569" }
      }
    }
  }
});

// Variabel untuk melacak dataset aktif pada grafik
let currentActiveDataset = [];

// Smart Date Parser untuk ISO & Format Indonesia (DD/MM/YYYY)
function parseCustomDate(str) {
  if (!str) return null;
  if (str instanceof Date) return isNaN(str.getTime()) ? null : str;
  if (typeof str === "number") return new Date(str);

  let cleanStr = String(str).trim();

  // Jika format ISO (YYYY-MM-DD atau ISO String seperti 2026-07-12T11:25:16)
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime()) && (cleanStr.includes("-") || cleanStr.includes("T"))) {
    return d;
  }

  // Jika format DD/MM/YYYY HH:mm:ss atau DD-MM-YYYY, HH.mm.ss
  const parts = cleanStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,\s*|\s+)?(?:(\d{1,2})[:\.](\d{1,2})(?:[:\.](\d{1,2}))?)?/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // Month index (0 - 11)
    const year = parseInt(parts[3], 10);
    const hour = parts[4] ? parseInt(parts[4], 10) : 0;
    const min = parts[5] ? parseInt(parts[5], 10) : 0;
    const sec = parts[6] ? parseInt(parts[6], 10) : 0;

    const customDate = new Date(year, month, day, hour, min, sec);
    if (!isNaN(customDate.getTime())) {
      return customDate;
    }
  }

  return !isNaN(d.getTime()) ? d : null;
}

// Helper parsing baris data Supabase secara konsisten
function parseRowData(row) {
  let rawTime = row.waktu || row.created_at || row.timestamp;
  let dateObj = parseCustomDate(rawTime);
  let formattedTime = dateObj ? dateObj.toLocaleString("id-ID") : String(rawTime || "N/A");
  
  return {
    waktu: formattedTime,
    timestamp: dateObj ? dateObj.getTime() : NaN,
    rawTime: rawTime,
    co2: Number(row.co2 !== undefined ? row.co2 : (row.kadar_co2 !== undefined ? row.kadar_co2 : 0))
  };
}

// === 2. Warna Titik Grafik Berdasarkan Kategori ===
function colorPoint(value) {
  if (value >= 2000) return "#ef4444"; // Red Critical
  if (value >= 1000) return "#f97316"; // Orange Poor
  if (value >= 700) return "#f59e0b";  // Amber Warning
  return "#10b981";                    // Emerald Normal
}

// === 3. Update Status Indikator Air Quality Card ===
function updateStatus() {
  if (data.length === 0) return;

  const latest = data[data.length - 1].co2;
  const statusLabel = document.getElementById("statusLabel");
  const latestValue = document.getElementById("latestValue");
  const statusAdvice = document.getElementById("statusAdvice");

  if (!statusLabel || !latestValue) return;

  latestValue.textContent = latest;

  if (latest >= 2000) {
    statusLabel.textContent = "🚨 Kritis / Berbahaya";
    statusLabel.className = "inline-flex items-center px-4 py-2 rounded-xl text-sm font-extrabold bg-red-100 text-red-700 border border-red-200 shadow-sm";
    if (statusAdvice) statusAdvice.textContent = "Nyalakan exhaust fan & evakuasi area!";
  } else if (latest >= 1000) {
    statusLabel.textContent = "⚠️ Buruk / Sumpek";
    statusLabel.className = "inline-flex items-center px-4 py-2 rounded-xl text-sm font-extrabold bg-orange-100 text-orange-700 border border-orange-200 shadow-sm";
    if (statusAdvice) statusAdvice.textContent = "Buka ventilasi & tingkatkan sirkulasi udara.";
  } else if (latest >= 700) {
    statusLabel.textContent = "⚡ Waspada / Kurang Ventilasi";
    statusLabel.className = "inline-flex items-center px-4 py-2 rounded-xl text-sm font-extrabold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm";
    if (statusAdvice) statusAdvice.textContent = "Udara mulai jenuh, buka pintu/jendela.";
  } else {
    statusLabel.textContent = "🟢 Normal / Air Health Safe";
    statusLabel.className = "inline-flex items-center px-4 py-2 rounded-xl text-sm font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm";
    if (statusAdvice) statusAdvice.textContent = "Kualitas udara sangat baik dan sehat.";
  }

  // Update Panel Rekomendasi Tindakan Operasional
  updateActionAdvisory(latest);
}

// === Update Panel Rekomendasi Tindakan Operasional (Simple Mode) ===
function updateActionAdvisory(latestCo2) {
  const badgeEl = document.getElementById("advisoryBadge");
  const iconBgEl = document.getElementById("advisoryIconBg");
  const textEl = document.getElementById("actionSimpleText");

  if (!badgeEl || !textEl) return;

  if (latestCo2 >= 2000) {
    badgeEl.textContent = "🚨 BAHAYA KRITIS!";
    badgeEl.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse border border-red-300";
    if (iconBgEl) iconBgEl.className = "p-3 bg-red-100 text-red-600 rounded-xl";
    textEl.textContent = "EVAKUASI AREA! Nyalakan Exhaust Fan & Blower Darurat ke Kecepatan Maksimal (100%).";
  } else if (latestCo2 >= 1000) {
    badgeEl.textContent = "⚠️ Buruk / Sumpek";
    badgeEl.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200";
    if (iconBgEl) iconBgEl.className = "p-3 bg-orange-100 text-orange-600 rounded-xl";
    textEl.textContent = "Udara sumpek. Aktifkan Blower tambahan ke High Speed & buka ventilasi udara luar.";
  } else if (latestCo2 >= 700) {
    badgeEl.textContent = "⚡ Waspada Sirkulasi";
    badgeEl.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200";
    if (iconBgEl) iconBgEl.className = "p-3 bg-amber-100 text-amber-600 rounded-xl";
    textEl.textContent = "Udara mulai jenuh. Tingkatkan sirkulasi Exhaust Fan ke Kecepatan Sedang (Medium Speed).";
  } else {
    badgeEl.textContent = "🟢 Kualitas Udara Optimal";
    badgeEl.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (iconBgEl) iconBgEl.className = "p-3 bg-emerald-50 text-emerald-600 rounded-xl";
    textEl.textContent = "Kualitas udara sangat baik. Pertahankan sirkulasi standar (Eco Mode).";
  }
}

// === 4. Render Tabel Data Historis ===
function renderTable(dataset) {
  const tableBody = document.getElementById("dataTable");
  if (!tableBody) return;

  if (dataset.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-slate-400">Tidak ada data ditemukan untuk tanggal yang dipilih.</td></tr>`;
    return;
  }

  tableBody.innerHTML = dataset.map(item => {
    let badgeClass = "bg-emerald-100 text-emerald-700";
    let badgeText = "Normal";
    if (item.co2 >= 2000) { badgeClass = "bg-red-100 text-red-700"; badgeText = "Berbahaya"; }
    else if (item.co2 >= 1000) { badgeClass = "bg-orange-100 text-orange-700"; badgeText = "Buruk"; }
    else if (item.co2 >= 700) { badgeClass = "bg-amber-100 text-amber-700"; badgeText = "Waspada"; }

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-3.5 text-center font-medium text-slate-700 border-b border-slate-100">${item.waktu}</td>
        <td class="px-6 py-3.5 text-center font-bold text-slate-900 border-b border-slate-100">${item.co2} ppm</td>
        <td class="px-6 py-3.5 text-center border-b border-slate-100">
          <span class="inline-block px-3 py-1 rounded-full text-xs font-bold ${badgeClass}">${badgeText}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// Update Statistik Analisis (Min, Max, Rata-rata CO2)
function updateAnalytics(dataset) {
  if (!dataset || dataset.length === 0) return;

  const minCo2El = document.getElementById("minCo2Value");
  const minCo2TimeEl = document.getElementById("minCo2Time");
  const maxCo2El = document.getElementById("maxCo2Value");
  const maxCo2TimeEl = document.getElementById("maxCo2Time");
  const avgCo2El = document.getElementById("avgCo2Value");

  if (!minCo2El || !maxCo2El || !avgCo2El) return;

  let minObj = dataset[0];
  let maxObj = dataset[0];
  let sum = 0;

  dataset.forEach(item => {
    const val = item.co2;
    sum += val;
    if (val < minObj.co2) minObj = item;
    if (val > maxObj.co2) maxObj = item;
  });

  const avgVal = Math.round(sum / dataset.length);

  minCo2El.textContent = minObj.co2;
  if (minCo2TimeEl) minCo2TimeEl.textContent = `Waktu: ${minObj.waktu}`;

  maxCo2El.textContent = maxObj.co2;
  if (maxCo2TimeEl) maxCo2TimeEl.textContent = `Waktu: ${maxObj.waktu}`;

  avgCo2El.textContent = avgVal;
}

// === 5. Render Grafik Rapih & Proporsional (Maksimal 100 Data) ===
function updateChart(dataset) {
  // Batasi grafik HANYA menampilkan maksimal 100 data saja agar grafik selalu mudah dibaca
  const limitedDataset = dataset.length > 100 ? dataset.slice(-100) : dataset;
  currentActiveDataset = limitedDataset;

  // Format label X-axis agar menampilkan Tanggal dan Jam secara rapi (misal: "12 Jul, 11:25")
  const formatTimeLabel = (item) => {
    if (item.timestamp && !isNaN(item.timestamp)) {
      const d = new Date(item.timestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
      const monthStr = monthNames[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');

      return `${day} ${monthStr}, ${hours}:${mins}`;
    }
    return item.waktu;
  };

  // Skala Y-axis dinamis yang proporsional agar kurva grafik tidak gepeng
  const co2Values = limitedDataset.map(item => item.co2);
  if (co2Values.length > 0) {
    const minVal = Math.min(...co2Values);
    const maxVal = Math.max(...co2Values);
    co2Chart.options.scales.y.min = Math.max(0, Math.floor((minVal - 50) / 50) * 50);
    co2Chart.options.scales.y.suggestedMax = Math.max(1200, Math.ceil((maxVal + 100) / 100) * 100);
  co2Chart.data.labels = limitedDataset.map(item => formatTimeLabel(item));
  co2Chart.data.datasets[0].data = limitedDataset.map(item => item.co2);
  co2Chart.data.datasets[0].pointBackgroundColor = limitedDataset.map(item => colorPoint(item.co2));

  // Terapkan mode grafik yang sedang aktif
  if (currentChartMode === 'bar') {
    co2Chart.config.type = 'bar';
    co2Chart.data.datasets[0].type = 'bar';
    co2Chart.data.datasets[0].backgroundColor = limitedDataset.map(item => colorPoint(item.co2));
    co2Chart.data.datasets[0].borderColor = limitedDataset.map(item => colorPoint(item.co2));
    co2Chart.data.datasets[0].borderWidth = 1;
    co2Chart.data.datasets[0].borderRadius = 4;
    co2Chart.data.datasets[0].stepped = false;
    co2Chart.data.datasets[0].fill = false;
  } else if (currentChartMode === 'stepped') {
    co2Chart.config.type = 'line';
    co2Chart.data.datasets[0].type = 'line';
    co2Chart.data.datasets[0].stepped = true;
    co2Chart.data.datasets[0].borderColor = "#10b981";
    co2Chart.data.datasets[0].backgroundColor = "rgba(16, 185, 129, 0.1)";
    co2Chart.data.datasets[0].fill = true;
  } else {
    co2Chart.config.type = 'line';
    co2Chart.data.datasets[0].type = 'line';
    co2Chart.data.datasets[0].stepped = false;
    co2Chart.data.datasets[0].borderColor = "#10b981";
    co2Chart.data.datasets[0].backgroundColor = gradientBg;
    co2Chart.data.datasets[0].fill = true;
  }

  co2Chart.update();

  // Otomatis hitung dan perbarui kartu analisis statistik
  updateAnalytics(limitedDataset);
}

// === 3 Mode Tampilan Grafik Switcher ('line', 'bar', 'stepped') ===
let currentChartMode = 'line';

function setChartMode(mode) {
  currentChartMode = mode;

  // Update tombol mode aktif
  document.querySelectorAll(".chart-mode-btn").forEach(btn => {
    btn.className = "chart-mode-btn px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-slate-900 bg-transparent";
  });
  const activeBtn = document.getElementById(`mode-btn-${mode}`);
  if (activeBtn) {
    activeBtn.className = "chart-mode-btn px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white shadow-xs";
  }

  if (!currentActiveDataset || currentActiveDataset.length === 0) return;
  updateChart(currentActiveDataset);
}

// === 6. Filter Preset Otomatis & Custom Grafik Dashboard ===
function showLast100() {
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 transition";
  });
  const btn100 = document.getElementById("preset-100");
  if (btn100) {
    btn100.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white border border-emerald-600 shadow-sm transition";
  }

  // Biarkan input waktu tetap kosong secara default
  const startEl = document.getElementById("startTime");
  const endEl = document.getElementById("endTime");
  if (startEl) startEl.value = "";
  if (endEl) endEl.value = "";

  if (allSupabaseRecords.length === 0) return;

  // Ambil 100 data terbaru (terakhir) dari rekaman database
  data = allSupabaseRecords.slice(-100);
  updateChart(data);
}

function filterQuick(hours) {
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 transition";
  });
  const activeBtn = document.getElementById(`preset-${hours}h`);
  if (activeBtn) {
    activeBtn.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white border border-emerald-600 shadow-sm transition";
  }

  if (allSupabaseRecords.length === 0) return;

  const lastRecord = allSupabaseRecords[allSupabaseRecords.length - 1];
  const referenceMs = lastRecord && !isNaN(lastRecord.timestamp) ? lastRecord.timestamp : new Date().getTime();
  const pastMs = referenceMs - hours * 60 * 60 * 1000;

  const filtered = allSupabaseRecords.filter(item => {
    return !isNaN(item.timestamp) && item.timestamp >= pastMs && item.timestamp <= referenceMs;
  });

  if (filtered.length > 0) {
    updateChart(filtered);
  } else {
    updateChart(data);
  }
}

function applyTimeFilter() {
  const startInput = document.getElementById("startTime").value;
  const endInput = document.getElementById("endTime").value;
  if (!startInput || !endInput) return alert("Pilih kedua rentang waktu terlebih dahulu.");

  const startMs = new Date(startInput).getTime();
  const endMs = new Date(endInput).getTime();

  if (isNaN(startMs) || isNaN(endMs)) return alert("Format tanggal/waktu yang dimasukkan tidak valid.");

  const filtered = allSupabaseRecords.filter(item => {
    return !isNaN(item.timestamp) && item.timestamp >= startMs && item.timestamp <= endMs;
  });

  if (filtered.length === 0) {
    alert("Tidak ditemukan data pada rentang waktu yang dipilih.");
    return;
  }
  updateChart(filtered);
}

function resetGraph() {
  // 1. Kosongkan nilai input tanggal & jam custom (startTime dan endTime)
  const startEl = document.getElementById("startTime");
  const endEl = document.getElementById("endTime");
  if (startEl) startEl.value = "";
  if (endEl) endEl.value = "";

  // 2. Hapus highlight aktif dari SELURUH tombol preset otomatis
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 transition";
  });

  // 3. Tampilkan kembali grafik dengan seluruh rekaman data dari database
  data = [...allSupabaseRecords];
  updateChart(data);
}

// Helper aman untuk mendapatkan Supabase Client Instance
function getSupabaseClient() {
  if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
    return window.supabaseClient;
  }
  if (window.supabase && typeof window.supabase.from === "function") {
    return window.supabase;
  }
  return null;
}

// === 7. Fetch Supabase Data (Mengambil Rekod Terbaru dari Database) ===
async function fetchSupabaseData() {
  const statusEl = document.getElementById("connectionStatus");
  const client = getSupabaseClient();

  if (!client) {
    if (statusEl) {
      statusEl.textContent = "⚠️ Status Koneksi: Menunggu Supabase API Key...";
      statusEl.className = "text-sm font-semibold text-amber-600 mt-1 flex items-center gap-1.5";
    }
    return;
  }

  try {
    // Ambil data terbaru dari tabel monitoring (diurutkan berdasarkan waktu descending)
    let res = await client
      .from(getTableName())
      .select("*")
      .order("waktu", { ascending: false })
      .limit(1000);

    if (res.error) {
      console.error("Gagal terhubung ke Supabase:", res.error);
      if (statusEl) {
        statusEl.textContent = "❌ Status Koneksi: Gagal Terhubung! (" + res.error.message + ")";
        statusEl.className = "text-sm font-semibold text-red-600 mt-1 flex items-center gap-1.5";
      }
    } else if (res.data) {
      if (statusEl) {
        statusEl.textContent = "🟢 Status Koneksi: Terhubung ke Supabase Cloud (Live)";
        statusEl.className = "text-sm font-semibold text-emerald-600 mt-1 flex items-center gap-1.5";
      }

      // Urutkan secara kronologis (terlama ke terbaru) untuk grafik
      allSupabaseRecords = res.data.reverse().map(parseRowData);
      dataHistorisFiltered = [...allSupabaseRecords];

      // Tampilkan 100 data terakhir secara otomatis pada grafik
      showLast100();

      renderTable(dataHistorisFiltered);
      updateStatus();
    }
  } catch (error) {
    console.error("Error pada fetchSupabaseData:", error);
  }
}

// === 8. Filter Form Historis (Pencarian Tanggal Presisi) ===
const filterForm = document.getElementById("filterForm");
if (filterForm) {
  filterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const startVal = document.getElementById("startDate").value; // e.g. "2026-07-10"
    const endVal = document.getElementById("endDate").value;     // e.g. "2026-07-12"

    if (!startVal || !endVal) return alert("Pilih tanggal awal dan tanggal akhir terlebih dahulu.");

    const client = getSupabaseClient();
    if (!client) return alert("Supabase belum terhubung.");

    const startISO = startVal + "T00:00:00";
    const endISO = endVal + "T23:59:59";

    // Query Supabase secara langsung dengan rentang tanggal ISO T00:00:00 s.d T23:59:59
    let res = await client
      .from(getTableName())
      .select("*")
      .gte("waktu", startISO)
      .lte("waktu", endISO)
      .order("waktu", { ascending: true })
      .limit(1000);

    if (!res.error && res.data && res.data.length > 0) {
      dataHistorisFiltered = res.data.map(parseRowData);
      renderTable(dataHistorisFiltered);
    } else {
      // Fallback: Filter dari data lokal menggunakan milidetik
      const startMs = new Date(startVal + "T00:00:00").getTime();
      const endMs = new Date(endVal + "T23:59:59.999").getTime();

      dataHistorisFiltered = allSupabaseRecords.filter(item => {
        return !isNaN(item.timestamp) && item.timestamp >= startMs && item.timestamp <= endMs;
      });

      if (dataHistorisFiltered.length === 0) {
        alert(`Tidak ditemukan data historis pada tanggal ${startVal} s.d ${endVal}.`);
      }

      renderTable(dataHistorisFiltered);
    }
  });
}

// === 9. Export CSV / Excel Download ===
function downloadCSV() {
  const dataset = dataHistorisFiltered.length > 0 ? dataHistorisFiltered : data;
  if (dataset.length === 0) return alert("Tidak ada data untuk diunduh!");

  let csvContent = "data:text/csv;charset=utf-8,Waktu Pengamatan,Kadar CO2 (ppm)\n";
  dataset.forEach(item => {
    const cleanTime = String(item.waktu).replace(",", "");
    csvContent += `${cleanTime},${item.co2}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `log_co2_basement_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// === 10. Real-time Subscription ===
const realtimeClient = getSupabaseClient();
if (realtimeClient && typeof realtimeClient.channel === "function") {
  try {
    realtimeClient
      .channel("co2_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: getTableName() }, (payload) => {
        const newData = parseRowData(payload.new);
        allSupabaseRecords.push(newData);
        data.push(newData);
        updateChart(data);
        renderTable(dataHistorisFiltered.length > 0 ? dataHistorisFiltered : data);
        updateStatus();
      })
      .subscribe();
  } catch (err) {
    console.warn("Realtime listener error:", err);
  }
}

// === 11. Navigasi Halaman / Section ===
function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active");

  const btnDash = document.getElementById("nav-dashboard");
  const btnHist = document.getElementById("nav-historis");

  if (sectionId === 'dashboard') {
    if (btnDash) btnDash.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30";
    if (btnHist) btnHist.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white";
  } else {
    if (btnHist) btnHist.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30";
    if (btnDash) btnDash.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white";
    renderTable(dataHistorisFiltered.length > 0 ? dataHistorisFiltered : data);
  }
}

// Inisialisasi awal
fetchSupabaseData();
