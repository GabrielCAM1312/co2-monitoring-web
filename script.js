// =================================================================
// LOGIKA UTAMA MONITORING CO2 (SUDAH TERKONEKSI KE SUPABASE)
// =================================================================

// === Konfigurasi Mode ===
let useDummyData = false; 

// Menyimpan data lokal untuk chart dan tabel
let data = []; 
let dataHistorisFiltered = [];

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
      borderWidth: 3,
      backgroundColor: gradientBg,
      fill: true,
      tension: 0.35,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: [],
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
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
        ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: "#64748b" },
        title: { display: true, text: "Waktu Pengamatan", font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' }, color: "#475569" }
      }
    }
  }
});

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
    tableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-slate-400">Tidak ada data ditemukan. Filter tanggal terlebih dahulu.</td></tr>`;
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

// === 5. Render Grafik ===
function updateChart(dataset) {
  co2Chart.data.labels = dataset.map(item => item.waktu);
  co2Chart.data.datasets[0].data = dataset.map(item => item.co2);
  co2Chart.data.datasets[0].pointBackgroundColor = dataset.map(item => colorPoint(item.co2));
  co2Chart.update();
}

// Helper parsing baris data Supabase secara konsisten
function parseRowData(row) {
  let rawTime = row.waktu || row.created_at || row.timestamp;
  let dateObj = (rawTime && !isNaN(Date.parse(rawTime))) ? new Date(rawTime) : null;
  let formattedTime = dateObj ? dateObj.toLocaleString("id-ID") : String(rawTime || "N/A");
  
  return {
    waktu: formattedTime,
    timestamp: dateObj ? dateObj.getTime() : (rawTime ? new Date(rawTime).getTime() : NaN),
    rawTime: rawTime,
    co2: Number(row.co2 !== undefined ? row.co2 : (row.kadar_co2 !== undefined ? row.kadar_co2 : 0))
  };
}

// === 6. Filter Grafik Dashboard ===
function applyTimeFilter() {
  const startInput = document.getElementById("startTime").value;
  const endInput = document.getElementById("endTime").value;
  if (!startInput || !endInput) return alert("Pilih kedua rentang waktu terlebih dahulu.");

  const startMs = new Date(startInput).getTime();
  const endMs = new Date(endInput).getTime();

  if (isNaN(startMs) || isNaN(endMs)) return alert("Format tanggal/waktu yang dimasukkan tidak valid.");

  const filtered = data.filter(item => {
    let itemMs = item.timestamp;
    if (isNaN(itemMs)) {
      itemMs = new Date(item.rawTime || item.waktu).getTime();
    }
    return !isNaN(itemMs) && itemMs >= startMs && itemMs <= endMs;
  });

  if (filtered.length === 0) {
    alert("Tidak ditemukan data pada rentang waktu yang dipilih.");
    return;
  }
  updateChart(filtered);
}

function resetGraph() {
  updateChart(data);
  document.getElementById("startTime").value = "";
  document.getElementById("endTime").value = "";
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

// === 7. Fetch Supabase Data (50 Data Terbaru) ===
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
    // Coba urutkan berdasarkan kolom 'waktu'
    let res = await client
      .from(getTableName())
      .select("*")
      .order("waktu", { ascending: false })
      .limit(50);

    // Jika kolom 'waktu' tidak ada, coba urutkan berdasarkan 'created_at' atau ambil tanpa order
    if (res.error && res.error.code === "42703") {
      res = await client
        .from(getTableName())
        .select("*")
        .limit(50);
    }

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

      data = res.data.map(parseRowData);
      dataHistorisFiltered = [...data];
      updateChart(data);
      renderTable(dataHistorisFiltered);
      updateStatus();
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

    const startVal = document.getElementById("startDate").value;
    const endVal = document.getElementById("endDate").value;

    if (!startVal || !endVal) return alert("Pilih tanggal awal dan tanggal akhir terlebih dahulu.");

    // Atur jam awal 00:00:00 dan jam akhir 23:59:59 agar seluruh hari tercakup
    const startDateObj = new Date(startVal + "T00:00:00");
    const endDateObj = new Date(endVal + "T23:59:59.999");

    const startMs = startDateObj.getTime();
    const endMs = endDateObj.getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      return alert("Format tanggal yang dimasukkan tidak valid.");
    }

    const client = getSupabaseClient();
    let fetchedResults = null;

    if (client) {
      try {
        const startISO = startDateObj.toISOString();
        const endISO = endDateObj.toISOString();

        // 1. Coba query Supabase dengan rentang waktu presisi 00:00:00 s.d 23:59:59
        let res = await client
          .from(getTableName())
          .select("*")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .order("created_at", { ascending: true });

        // 2. Jika kolom 'created_at' tidak ada, coba dengan kolom 'waktu'
        if (res.error && res.error.code === "42703") {
          res = await client
            .from(getTableName())
            .select("*")
            .gte("waktu", startVal)
            .lte("waktu", endVal + " 23:59:59")
            .order("waktu", { ascending: true });
        }

        if (!res.error && res.data && res.data.length > 0) {
          fetchedResults = res.data.map(parseRowData);
        }
      } catch (err) {
        console.warn("Filtering Supabase gagal, menggunakan fallback filter lokal:", err);
      }
    }

    // Jika query Supabase mengembalikan data, gunakan hasil tersebut
    if (fetchedResults && fetchedResults.length > 0) {
      dataHistorisFiltered = fetchedResults;
    } else {
      // Fallback: Filter dari data lokal yang ada secara presisi berdasarkan timestamp milidetik
      dataHistorisFiltered = data.filter(item => {
        let itemMs = item.timestamp;
        if (isNaN(itemMs)) {
          itemMs = new Date(item.rawTime || item.waktu).getTime();
        }
        return !isNaN(itemMs) && itemMs >= startMs && itemMs <= endMs;
      });
    }

    if (dataHistorisFiltered.length === 0) {
      alert("Tidak ditemukan data historis pada rentang tanggal tersebut.");
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
