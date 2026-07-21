// === Konfigurasi Firebase ===
var firebaseConfig = {
  apiKey: "AIzaSyBJ_V-1iouVYqyHcWa4rvnqeYUeM6R7_xw",
  authDomain: "monitoring-co2-84021.firebaseapp.com",
  databaseURL: "https://monitoring-co2-84021-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-co2-84021",
  storageBucket: "monitoring-co2-84021.appspot.com",
  messagingSenderId: "50243293824",
  appId: "1:50243293824:web:0d89061283bcc72d440c65",
  measurementId: "G-ND22GS2FY6"
};

// === Inisialisasi Firebase ===
firebase.initializeApp(firebaseConfig);
var database = firebase.database();
