# JastipNisa — Arsitektur Target

> Dokumen ringkas ini mengikuti [Peta Implementasi Terpadu React + Google Apps Script](IMPLEMENTATION_MAP_REACT_GAS.md), yang menjadi sumber kebenaran arsitektur dan rencana migrasi.

## Stack

- **Frontend:** React + Vite + TypeScript.
- **App runtime:** Google Apps Script Web App + HTML Service.
- **Client/server bridge:** google.script.run melalui typed Promise adapter.
- **Data:** Google Sheets.
- **File storage:** Google Drive.
- **Source control/deployment:** GitHub + clasp.
- **Tests:** Vitest untuk domain logic; integration/browser tests pada GAS staging.

## Deployment model

React di-build sebagai satu file HTML dengan JavaScript dan CSS inline. Apps Script HTML Service menyajikan file tersebut melalui Web App. React memanggil fungsi server melalui google.script.run. Target awal tidak memakai Vercel sebagai host frontend maupun REST API lintas-domain.

Gunakan route berbasis hash atau routing satu halaman yang kompatibel dengan HTML Service. Build GAS khusus harus diverifikasi; output Vite default tidak otomatis siap digunakan oleh Apps Script.

## Backend boundaries

Apps Script menjadi batas kepercayaan untuk seluruh operasi data:

- Validasi input, aturan fee, status workflow dan total pembayaran.
- Autentikasi sesi admin dan token akses pelanggan.
- CRUD terkontrol atas katalog, varian, request, unit, pembeli, pesanan, pembayaran, pengiriman dan pengeluaran.
- Operasi LockService untuk mutasi yang rentan race condition.
- Repository Google Sheets dan layanan file Google Drive.

Hanya fungsi API eksplisit yang boleh dipanggil frontend. Helper internal menggunakan akhiran underscore. Jangan menyediakan fungsi generik untuk membaca sheet atau mengubah baris arbitrer.

## Data model

Sheet utama: Katalog, Varian, Request, Unit, Pembeli, Pesanan, Item_Pesanan, Pembayaran, Pengeluaran, Rekap dan Pengaturan.

Item_Pesanan adalah tambahan teknis yang direkomendasikan untuk memisahkan wishlist/request awal dari transaksi final dan alokasi unit fisik. Deposit yang tercatat sebelum order final harus dapat ditautkan ke request, lalu dialokasikan ke order tepat satu kali.

ID dibuat oleh server dan stabil. Nomor baris spreadsheet bukan identifier API.

## Security and privacy

- Web App dapat berjalan sebagai deployer agar backend mengakses Spreadsheet/Drive dengan otoritas pemilik; semua API publik harus dianggap dapat dipanggil pengunjung.
- Admin auth divalidasi pada setiap API admin di server. Jangan mengandalkan UI tersembunyi atau email Session sebagai satu-satunya identitas karena email active user dapat tidak tersedia pada web app yang dijalankan sebagai deployer.
- Customer access memakai token acak berentropi tinggi; hanya hash token yang disimpan.
- Public API mengembalikan allow-list field. Data pembeli, pembayaran dan bukti transfer tidak boleh menjadi data publik.
- File Drive bersifat privat secara default. Foto aktual untuk pelanggan harus disajikan hanya setelah token terkait diverifikasi.
- Validasi, lock, audit trail dan idempotency berada di GAS, bukan hanya di React.

## Kondisi migrasi

Repository SOWAN masih memuat implementasi Supabase. Perubahan dokumen ini menetapkan arsitektur target, bukan klaim bahwa source code, data, deployment atau database sudah dimigrasikan. Supabase hanya dihapus setelah parity GAS, pengujian, backup dan cutover selesai.

Detail diagram, API, data dictionary, status, security, roadmap dan acceptance criteria ada di [IMPLEMENTATION_MAP_REACT_GAS.md](IMPLEMENTATION_MAP_REACT_GAS.md).
