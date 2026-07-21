// === Konfigurasi Mode ===
let useDummyData = true; // ubah ke false jika sudah terhubung ke Firebase

// === Data Dummy ===
const dummyData = [
  { waktu: "09/02/2026 00:30:00", co2: 750 },
  { waktu: "09/02/2026 00:31:00", co2: 820 },
  { waktu: "09/02/2026 00:32:00", co2: 950 },
  { waktu: "09/02/2026 00:33:00", co2: 1100 },
  { waktu: "09/02/2026 00:34:00", co2: 1250 },
  { waktu: "09/02/2026 00:35:00", co2: 980 },
  { waktu: "09/02/2026 00:36:00", co2: 870 },
  { waktu: "10/02/2026 00:30:00", co2: 2000 },
];

let data = [...dummyData];

// === Inisialisasi Chart ===
const ctx = document.getElementById("co2Chart").getContext("2d");
const co2Chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: data.map(item => item.waktu),
    datasets: [{
      label: "Kadar CO₂ (ppm)",
      data: data.map(item => item.co2),
      borderColor: "rgb(75,192,192)",
      backgroundColor: "rgba(75,192,192,0.2)",
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: data.map(item => colorPoint(item.co2)),
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: { display: true, text: "Grafik Kadar CO₂" },
      legend: { display: false }
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "ppm" } },
      x: { title: { display: true, text: "Waktu" } }
    }
  }
});

// === Fungsi Warna Titik ===
function colorPoint(value) {
  if (value >= 2000) return "red";
  if (value >= 1000) return "yellow";
  return "green";
}

// === Render Tabel ===
function renderTable(filteredData) {
  const tableBody = document.getElementById("dataTable");
  tableBody.innerHTML = filteredData.map(item =>
    `<tr><td>${item.waktu}</td><td>${item.co2} ppm</td></tr>`
  ).join("");
}

// === Status Udara ===
function updateStatus() {
  const latest = data[data.length - 1].co2;
  const statusLabel = document.getElementById("statusLabel");
  const latestValue = document.getElementById("latestValue");
  latestValue.textContent = `${latest} ppm`;

  if (latest >= 2000) {
    statusLabel.textContent = "Berbahaya";
    statusLabel.className = "status tinggi";
  } else if (latest >= 1000) {
    statusLabel.textContent = "Sedang";
    statusLabel.className = "status sedang";
  } else {
    statusLabel.textContent = "Aman";
    statusLabel.className = "status aman";
  }
}

// === Filter Grafik ===
function applyTimeFilter() {
  const startInput = document.getElementById("startTime").value;
  const endInput = document.getElementById("endTime").value;
  if (!startInput || !endInput) return alert("Isi kedua waktu terlebih dahulu.");

  const start = new Date(startInput);
  const end = new Date(endInput);
  const filtered = data.filter(item => {
    const waktu = new Date(item.waktu);
    return waktu >= start && waktu <= end;
  });
  updateChart(filtered);
}

function resetGraph() {
  updateChart(data);
  document.getElementById("startTime").value = "";
  document.getElementById("endTime").value = "";
}

// === Update Chart ===
function updateChart(dataset) {
  co2Chart.data.labels = dataset.map(item => item.waktu);
  co2Chart.data.datasets[0].data = dataset.map(item => item.co2);
  co2Chart.data.datasets[0].pointBackgroundColor = dataset.map(item => colorPoint(item.co2));
  co2Chart.update();
}

// === Firebase Listener ===
if (!useDummyData) {
  const co2Ref = database.ref("co2_data");
  co2Ref.on("value", snapshot => {
    const firebaseData = snapshot.val();
    if (firebaseData) {
      data = Object.values(firebaseData);
      updateChart(data);
      renderTable(data);
      updateStatus();
    }
  }, error => {
    console.error("Firebase error:", error);
    alert("Gagal terhubung ke Firebase, beralih ke Dummy Mode.");
    useDummyData = true;
  });
}

// === Navigasi Antar Section ===
function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach(sec => {
    sec.classList.remove("active");
  });
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add("active");
  }
}

// === Inisialisasi Awal ===
renderTable(data);
updateStatus();
