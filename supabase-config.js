// === Konfigurasi Supabase (Frontend & Backend API Key) ===

// FRONTEND API KEY (Anon Public Key JWT)
const SUPABASE_URL = "https://gvgmfvedkdfgbmdvcblm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2Z21mdmVka2RmZ2JtZHZjYmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzE4MzYsImV4cCI6MjA5NTEwNzgzNn0.ctT9LcGuypAmJDD-zliXN4T3e_9JpkDp5qx32urIyyA";

// NAMA TABEL MONITORING (Default: "monitoring")
const SUPABASE_TABLE_NAME = "monitoring";

// Inisialisasi Supabase Client dan simpan secara aman ke window.supabaseClient (menghindari bentrokan nama variabel)
if (window.supabase && typeof window.supabase.createClient === "function") {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
