// === Konfigurasi Supabase (Frontend & Backend API Key) ===

// 1. FRONTEND API KEY (Publishable / Anon Public Key)
const SUPABASE_URL = "https://gvgmfvedkdfgbmdvcblm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y4R0QjtzyXDHSpcpt1eooA_DJybDs-j"; // Publishable API Key Anda
// JWT Anon Key sebelumnya: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

/*
// 2. BACKEND API KEY (Opsional - Service Role Key / Backend Server)
const BACKEND_SUPABASE_URL = "https://gvgmfvedkdfgbmdvcblm.supabase.co";
const BACKEND_SERVICE_ROLE_KEY = ""; // Masukkan Service Role Key di sini jika digunakan di Node.js / Python
*/

// 3. NAMA TABEL MONITORING (Default: "monitoring")
const SUPABASE_TABLE_NAME = "monitoring";

// Inisialisasi Supabase Client dan simpan secara aman ke window.supabaseClient (menghindari bentrokan nama variabel)
if (window.supabase && typeof window.supabase.createClient === "function") {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
