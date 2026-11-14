# MUSIC2D — Retro Vinyl Audio Player 🎵🕹️

Web audio player yang didesain dan dibuat persis sesuai dengan konsep retro-futuristik / skeuomorfik / pixel-art pada gambar referensi Anda, lengkap dengan berbagai peningkatan interaktif yang tetap setia pada tema!

---

## 🌟 Fitur Utama & Peningkatan (Stay On-Theme)

1. **Skeuomorphic Vinyl Turntable**:
   - Piringan hitam (*vinyl record*) berputar halus saat musik dimainkan dengan pantulan cahaya (*sheen*) & alur piringan (*grooves*).
   - **Tonearm interaktif**: Jarum bergerak ke atas piringan hitam saat *Play*, dan terangkat kembali saat *Pause*.
   - **Pitch Slider (+8 / 0 / -8)**: Slider pengatur kecepatan & nada putaran turntable secara real-time.
   - **33 / 45 RPM Switch**: Penggantian kecepatan putar piringan hitam (standar LP 33⅓ RPM vs Single 45 RPM).
   - **Baut & Finishing Metal**: Tekstur brushed aluminium dengan 4 baut sudut dan lampu indikator stroboskopik.

2. **Mesin Audio (Web Audio API)**:
   - Memutar track synth Lo-Fi procedural bawaan dan file MP3 lokal.
   - Track *Disenchanted* dan *Can't Help Falling in Love* memakai file MP3 lokal di folder project.
   - Gunakan tombol **+ Add songs** untuk memilih satu atau beberapa file audio; lagu tersimpan di browser ini dan tetap tersedia setelah halaman dimuat ulang.
   - Tombol **×** pada kartu lagu menghapusnya dari player setelah konfirmasi; file asli di komputer tidak ikut dihapus.
   - **Efek Suara Gesekan Jarum Vinyl (*Vinyl Crackle*)**: Fitur suara kresek-kresek khas piringan hitam analog vintage yang dapat dinyalakan/dimatikan dengan satu tombol.
   - **Efek Deselerasi Motor Turntable**: Saat dihentikan (*Pause*), suara melambat dengan efek *pitch-glide down* khas piringan analog yang mati.

3. **Waveform Visualizer Interaktif**:
   - Batang-batang gelombang audio (*waveform*) yang bergerak dinamis mengikuti frekuensi audio.
   - Batang yang sudah terputar berwarna hitam pekat, sedangkan sisa lagu berwarna silver matte.
   - **Click to Seek**: Klik di titik mana saja pada waveform untuk langsung melompat ke detik lagu yang diinginkan.

4. **Kategori Musik & Album Carousel**:
   - Filter pill (*Classic, 90s, New, Instrumental, Modern pop*).
   - Kartu album berestetika monokrom hitam-putih (*Daily Chaos*, *Simple Things*, *Not so good*, *Disenchanted*, *Can't Help Falling in Love*) dalam carousel horizontal yang bisa digulir. Klik kartu untuk langsung memutar lagunya di turntable.

5. **Daftar Playlist Favorit & Navigasi**:
   - Sidebar navigasi minimalis dengan ikon fungsional.
   - Bagian *Favorite Playlists (4)* dengan tombol putar cepat.
   - Fitur Like (+392) yang interaktif menambah jumlah apresiasi.
   - Input pencarian (*Search*) real-time.

---

## 🚀 Cara Menjalankan

Karena dibuat dengan **Pure HTML5, CSS3, dan Vanilla JavaScript (Web Audio API)**, Anda tidak membutuhkan build tools atau instalasi rumit:

### Opsi 1: Buka Langsung di Browser
Klik ganda file `index.html` di penjelajah berkas Windows (File Explorer):
`C:\Users\LIFE\.gemini\antigravity\scratch\music2d-player\index.html`

### Opsi 2: Menggunakan Local Server (Opsional)
Jalankan server lokal via PowerShell / Command Prompt:
```powershell
cd C:\Users\LIFE\.gemini\antigravity\scratch\music2d-player
python -m http.server 8000
```
Lalu buka [http://localhost:8000](http://localhost:8000) di browser Anda.

---

## 📁 Struktur Berkas

```
music2d-player/
│
├── index.html     # Struktur semantik UI, turntable deck, tombol & layout
├── style.css      # Styling neumorphic, metallic deck, pixel typography, animasi vinyl & tonearm
├── synth.js       # Web Audio API engine (synthesizer Lo-Fi, vinyl crackle, frequency analyzer)
├── app.js         # Logika interaksi UI, waveform seeker, filter kategori, kontrol turntable
└── README.md      # Panduan dokumentasi
```

Lagu baru bisa ditambahkan melalui tombol **+ Add songs** tanpa mengedit kode. File disimpan di penyimpanan browser lokal (IndexedDB), tidak diunggah, dan tidak otomatis tersinkron ke browser atau perangkat lain. Menghapus data situs/browser juga menghapus lagu yang tersimpan. Tombol **×** menghapus lagu dari player; file asli di folder project tetap ada.
