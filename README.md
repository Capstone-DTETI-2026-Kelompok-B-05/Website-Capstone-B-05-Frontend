# Frontend Smart Busway

Desain berasal dari capstone-fe(1).zip: login slideshow, warna biru, kartu membulat, logo dan layout dashboard. Implementasi memakai kontrak Website-Capstone-B-05-Backend-register.

## Menjalankan

1. Jalankan backend dengan MongoDB dan konfigurasi .env yang benar.
2. Di folder frontend, jalankan `npm install`.
3. File .env frontend sudah berisi `VITE_API_URL=http://localhost:5000/api/v1`. Ubah bila port backend berbeda. Restart Vite setelah mengubah .env.
4. Jalankan `npm run dev`, buka http://localhost:5173. CLIENT_ORIGIN backend harus sama dengan alamat frontend.
5. Login memakai akun di MongoDB. Tidak ada akun/password bawaan.

Gunakan Node.js 22.12+; disarankan versi 22 LTS yang memenuhi engine dependencies. Kunci versi dependency tersedia dalam package-lock.json.

## Hak akses dan navigasi

- Admin: Dashboard, Kelola Kamera, Kelola Akun. Ganti password melalui dropdown profil.
- Petugas: Dashboard saja; tidak ada sidebar atau ikon navigasi Dashboard.
- Klik profil kanan atas untuk membuka dropdown. Keluar akun berwarna merah, menghapus sesi dan kembali ke login. Dropdown menutup saat klik di luar atau Escape.
- Kelola Kamera tidak dirender untuk petugas, dan navigasi frontend dibatasi. Backend yang disertakan juga menolak POST/PATCH/DELETE kamera dari petugas (403).
- Petugas tetap boleh GET daftar kamera untuk memilih stream monitoring; akses kamera/riwayat tidak dibatasi per penugasan, mengikuti backend sumber.

## Integrasi

Semua URL relatif terhadap VITE_API_URL:

| Method | URL | Penggunaan |
| --- | --- | --- |
| POST | /auth/login | Login JWT |
| PUT | /auth/password | Ganti password admin |
| GET/POST | /accounts | Daftar/tambah akun |
| PATCH/DELETE | /accounts/:id | Edit/hapus akun |
| POST | /auth/users/:id/password-reset | Reset password |
| GET/POST | /cameras | Daftar/tambah kamera |
| PATCH/DELETE | /cameras/:id | Edit/hapus kamera |
| GET | /cameras/:id/connection-status | Cek port RTSP |
| GET | /analytics/history?limit=100 | Log jenis kendaraan dan timestamp, deteksi terakhir |
| GET | /analytics/statistics | Jumlah dan distribusi jenis kendaraan |
| POST | /mqtt/portal/command | {aksi: buka/tutup} atau {mode: manual/otomatis} |
| GET | /stream/mjpeg/:cameraId | Stream frame dengan header Authorization |
| POST | /access-requests | Permintaan akun dari login |
| GET | /access-requests | Daftar permintaan untuk admin |
| POST | /access-requests/:id/approve | Membuat akun petugas dari permintaan |
| POST | /access-requests/:id/reject | Menolak permintaan |

Data dashboard disegarkan setiap 5 detik, tanpa request polling yang tumpang tindih. Tidak menggunakan data demo. Bila request gagal, data terakhir tetap terlihat disertai pesan kegagalan. Kartu jumlah/distribusi mencakup semua riwayat, sedangkan log menampilkan 100 deteksi terakhir. Backend tidak menyertakan cameraId di riwayat/statistik, sehingga pilihan kamera hanya mengubah video, bukan riwayat global.

Live stream memakai fetch + Bearer JWT + parser multipart MJPEG, bukan URL RTSP langsung dan bukan token di query string. JWT hanya disimpan di sessionStorage tab. Ada batas ukuran frame dan timeout 15 detik tanpa frame; pengguna bisa mencoba kembali. Perlu patch rute stream backend yang sudah diterapkan dalam capstone-be paket ini. Sumber video rute ini adalah framePipeline: kamera harus mengirim JPEG ke camera-ingest memakai ID kamera yang sama. Menyimpan URL RTSP di Kelola Kamera saja tidak otomatis menghasilkan video.

Tombol buka/tutup dan mode mengirim perintah nyata ke backend MQTT. HTTP 202 berarti pesan dipublikasikan; bukan konfirmasi servo bergerak. Backend sumber belum menyediakan GET status portal/perangkat. Karena itu status OPEN/CLOSED dan AUTO/MANUAL pada dashboard diberi label status dari deteksi terakhir; frontend tidak mengubahnya secara optimistis saat perintah dikirim. Frame video, status broker, servo, FPS, dan status inference tidak diganti dengan nilai simulasi.

Hubungi admin membuka pengajuan akses. Admin menyetujui/menolak di bagian bawah Kelola Akun. Backend tidak mengirim email otomatis: admin perlu menyampaikan kredensial awal secara pribadi. Petugas yang memakai password awal diberi pesan untuk menghubungi admin; halaman petugas tetap hanya Dashboard sesuai permintaan.

## Pengujian

`npm test` menguji kontrak request, error autentikasi, pembatasan halaman, dan parser MJPEG yang menerima potongan jaringan. `npm run build` menghasilkan bundle produksi.

Perlu uji akhir dengan MongoDB, broker MQTT, sumber kamera, model ONNX dan perangkat pengguna. Status perintah tidak dianggap sebagai bukti perubahan posisi portal.
