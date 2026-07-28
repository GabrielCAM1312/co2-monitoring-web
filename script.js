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

const co2Chart = new Chart(ctx, {
  type: "line",
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
        backgroundColor: "#0f172a",
        titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' },
        bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          title: (tooltipItems) => {
            const dataIndex = tooltipItems[0].dataIndex;
            const currentItem = currentActiveDataset[dataIndex];
            return currentItem ? `Waktu: ${currentItem.waktu}` : tooltipItems[0].label;
          },
          label: (context) => ` Kadar CO₂: ${context.parsed.y} ppm`
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: "rgba(226, 232, 240, 0.6)" },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: "#64748b" },
        title: { display: true, text: "Konsentrasi (ppm)", font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' }, color: "#475569" }
      },
      x: { 
        grid: { display: false },
        ticks: { 
          font: { family: 'Plus Jakarta Sans', size: 11 }, 
          color: "#64748b",
          maxTicksLimit: 10,  // Pembatasan maksimal 10 label agar tidak saling menumpuk
          maxRotation: 0,     // Label tetap mendatar rapi
          autoSkip: true      // Otomatis melompati label jika terlalu rapat
        },
        title: { display: true, text: "Waktu Pengamatan (Jam:Menit)", font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' }, color: "#475569" }
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

  // Jika format ISO (YYYY-MM-DD atau ISO String)
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

// === 5. Render Grafik Rapih & Proporsional ===
function updateChart(dataset) {
  currentActiveDataset = dataset;

  const formatTimeLabel = (item) => {
    if (item.timestamp && !isNaN(item.timestamp)) {
      const d = new Date(item.timestamp);
      return d.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    }
    return item.waktu;
  };

  co2Chart.data.labels = dataset.map(item => formatTimeLabel(item));
  co2Chart.data.datasets[0].data = dataset.map(item => item.co2);
  co2Chart.data.datasets[0].pointBackgroundColor = dataset.map(item => colorPoint(item.co2));

  if (dataset.length > 50) {
    co2Chart.data.datasets[0].pointRadius = 2;
    co2Chart.data.datasets[0].pointHoverRadius = 6;
  } else if (dataset.length > 20) {
    co2Chart.data.datasets[0].pointRadius = 3.5;
    co2Chart.data.datasets[0].pointHoverRadius = 7;
  } else {
    co2Chart.data.datasets[0].pointRadius = 5;
    co2Chart.data.datasets[0].pointHoverRadius = 8;
  }

  co2Chart.update();
}

// === 6. Filter Preset Otomatis & Custom Grafik Dashboard ===
function filterQuick(hours) {
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 transition";
  });
  const activeBtn = document.getElementById(`preset-${hours}h`);
  if (activeBtn) {
    activeBtn.className = "preset-btn px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white border border-emerald-600 shadow-sm transition";
  }

  const now = new Date();
  const past = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const formatInputDateTime = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const startEl = document.getElementById("startTime");
  const endEl = document.getElementById("endTime");

  if (startEl && endEl) {
    startEl.value = formatInputDateTime(past);
    endEl.value = formatInputDateTime(now);
  }

  const startMs = past.getTime();
  const endMs = now.getTime();

  const filtered = allSupabaseRecords.filter(item => {
    return !isNaN(item.timestamp) && item.timestamp >= startMs && item.timestamp <= endMs;
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
  filterQuick(24);
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

// === 7. Fetch Supabase Data (Mengambil Seluruh Data dari Database) ===
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
    let res = await client
      .from(getTableName())
      .select("*");

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

      // Parse semua record dan urutkan berdasarkan timestamp secara kronologis
      allSupabaseRecords = res.data.map(parseRowData).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      data = [...allSupabaseRecords];
      dataHistorisFiltered = [...data];

      updateChart(data);
      renderTable(dataHistorisFiltered);
      updateStatus();

      // Aktifkan preset 24 jam otomatis jika data banyak
      filterQuick(24);
    }
  } catch (error) {
    console.error("Error pada fetchSupabaseData:", error);
  }
}

// === 8. Filter Form Historis ===
const filterForm = document.getElementById("filterForm");
if (filterForm) {
  filterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const startVal = document.getElementById("startDate").value; // e.g. "2026-07-10"
    const endVal = document.getElementById("endDate").value;     // e.g. "2026-07-12"

    if (!startVal || !endVal) return alert("Pilih tanggal awal dan tanggal akhir terlebih dahulu.");

    const startDateObj = new Date(startVal + "T00:00:00");
    const endDateObj = new Date(endVal + "T23:59:59.999");

    const startMs = startDateObj.getTime();
    const endMs = endDateObj.getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      return alert("Format tanggal yang dimasukkan tidak valid.");
    }

    // Filter dari seluruh record Supabase menggunakan timestamp milidetik yang presisi
    dataHistorisFiltered = allSupabaseRecords.filter(item => {
      return !isNaN(item.timestamp) && item.timestamp >= startMs && item.timestamp <= endMs;
    });

    if (dataHistorisFiltered.length === 0) {
      alert(`Tidak ditemukan data historis pada tanggal ${startVal} s.d ${endVal}. Silakan periksa ketersediaan data di database Anda.`);
    }

    renderTable(dataHistorisFiltered);
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
