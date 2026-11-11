# Audit Referensi Google Apps Script

> Dokumen arsitektur dan peta implementasi terbaru: [IMPLEMENTATION_MAP_REACT_GAS.md](IMPLEMENTATION_MAP_REACT_GAS.md).

## Sumber yang diperiksa

- Project Brief JastipNisa v0.2.1 sebagai referensi kebutuhan dan aturan bisnis.
- Index JastipNisa1.html sebagai prototipe frontend HTML Service.
- Code JastipNisa1.gs sebagai prototipe backend Apps Script dengan Google Sheets.
- jastipnisa_fullstack_webapp.tsx sebagai prototype UI React dan alur pelanggan/admin.

## Keputusan baru

Berbeda dari keputusan awal di dokumen ini, target yang dipilih sekarang adalah **React + Vite + TypeScript + Google Apps Script + Google Sheets + Google Drive**.

React di-build menjadi satu HTML melalui pipeline build khusus lalu disajikan oleh Apps Script HTML Service. Pemanggilan server menggunakan google.script.run. Google Sheets menyimpan data operasional dan Drive menyimpan file.

Dokumen ini tidak lagi menetapkan Supabase sebagai arsitektur target.

## Yang dipertahankan dari prototipe GAS

- Pola HTML Service dan google.script.run.
- Fee calculator dan fee table.
- Katalog referensi dan cart/wishlist.
- Customer status journey dan format order.
- Shopee username confirmation.
- Admin dashboard, daftar buru, unit aktual, pembayaran, pengeluaran dan pengiriman.
- Spreadsheet sebagai sumber data operasional.

## Temuan yang harus diperbaiki sebelum code dipakai

1. Lookup pelanggan saat ini menggunakan kode order pendek dan empat digit nomor telepon. Ganti dengan access token berentropi tinggi; simpan hanya hash token.
2. Pembuatan order langsung saat pelanggan mengirim cart mencampur request awal dan order final. Pisahkan request group/item request dari order dan item order final.
3. Update menggunakan nomor baris sheet sebagai identitas. Ganti dengan ID record stabil yang dibuat server.
4. Status order dan unit dapat diubah bebas. Ganti dengan validasi state transition di service GAS.
5. Operasi penting seperti pembuatan unit, pembayaran, konversi request dan alokasi unit membutuhkan LockService, validasi relasi, idempotency dan audit.
6. Data Settings tidak boleh dikembalikan seluruhnya ke client. Public API hanya mengeluarkan field yang diizinkan.
7. Password placeholder di source Code.gs harus dihapus. Secret disimpan di Script Properties; autentikasi dan pemeriksaan sesi dilakukan server-side.
8. CacheService hanya cache sementara; jangan dijadikan penyimpanan transaksi atau audit.
9. File foto dan bukti pembayaran memerlukan kebijakan akses Drive. Jangan mengandalkan URL publik sebagai pengganti otorisasi.
10. Semua input publik harus divalidasi di GAS. Validasi browser saja tidak cukup.
11. Dashboard keuangan harus dihitung dari transaksi terverifikasi, HPP unit dan pengeluaran; jangan memakai data sample atau status order saja.

## Relasi dengan codebase SOWAN

SOWAN berisi implementasi React + Supabase yang sudah mengandung katalog, admin, request, unit, order, payment, shipment dan expenses. Bagian UI dan domain modelnya dapat membantu sebagai pembanding, tetapi semua akses langsung Supabase perlu dipindahkan ke typed GAS API adapter dan service GAS.

Codebase saat ini belum menjadi React + GAS. Detail konversi tiap area, kontrak API, model sheet, keamanan, roadmap, test dan acceptance criteria dijabarkan pada dokumen peta implementasi terpadu.
