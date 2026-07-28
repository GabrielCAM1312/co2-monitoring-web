// === Konfigurasi Supabase (Frontend & Backend API Key) ===

// 1. FRONTEND API KEY (Anon Public Key)
const SUPABASE_URL = "https://gvgmfvedkdfgbmdvcblm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2Z21mdmVka2RmZ2JtZHZjYmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzE4MzYsImV4cCI6MjA5NTEwNzgzNn0.ctT9LcGuypAmJDD-zliXN4T3e_9JpkDp5qx32urIyyA";

/*
// 2. BACKEND API KEY (Opsional - Service Role Key / Backend Server)
const BACKEND_SUPABASE_URL = "https://gvgmfvedkdfgbmdvcblm.supabase.co";
const BACKEND_SERVICE_ROLE_KEY = ""; // Masukkan Service Role Key di sini jika digunakan di Node.js / Python
*/

// 3. NAMA TABEL MONITORING (Default: "monitoring")
const SUPABASE_TABLE_NAME = "monitoring";

// Inisialisasi Supabase Client dan simpan ke window.supabase
if (window.supabase && typeof window.supabase.createClient === "function") {
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
var supabase = window.supabase;
