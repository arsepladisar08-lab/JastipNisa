# JastipNisa

Aplikasi operasional jasa titip produk Flicka dengan frontend React dan backend Google Apps Script.

## Status arsitektur

**Target stack:** React + Vite + TypeScript + Google Apps Script + Google Sheets + Google Drive.

**Penting:** branch SOWAN saat ini masih berisi implementasi React + Supabase. Branch arsitektur baru terlebih dahulu menetapkan peta migrasi; source code runtime belum seluruhnya dipindahkan ke GAS. Jangan deploy branch dokumentasi ini sebagai aplikasi GAS produksi.

Dokumen utama pengembangan: [Peta Implementasi Terpadu — React + Google Apps Script](docs/IMPLEMENTATION_MAP_REACT_GAS.md). Panduan setup: [GAS_SETUP.md](docs/GAS_SETUP.md).

## Target architecture

- **Frontend:** React + Vite + TypeScript.
- **App runtime:** Google Apps Script Web App + HTML Service.
- **Bridge:** google.script.run, dengan typed Promise adapter.
- **Database:** Google Sheets.
- **File storage:** Google Drive.
- **Source control:** GitHub; Apps Script source dikelola melalui clasp.
- **Testing:** Vitest untuk domain logic; integration dan browser journey diuji pada deployment GAS staging.

React akan di-build menjadi satu file HTML yang disajikan melalui Apps Script HTML Service. Pola ini memungkinkan React menggunakan google.script.run secara native dan menghindari ketergantungan pada panggilan cross-origin langsung dari Vercel ke Apps Script.

## Aturan bisnis inti

- Katalog Flicka adalah referensi produk; bukan jaminan stok fisik.
- Admin harus mengonfirmasi ketersediaan dan mengirim foto aktual/kondisi sebelum pelanggan menyelesaikan format order.
- Fee per order: 1 produk Rp15.000; 2 produk Rp25.000; setiap produk setelah kedua menambah Rp10.000.
- Tidak ada batas jumlah pembelian per pelanggan dari sisi JastipNisa.
- Produk tidak dapat diretur ke toko. Kebijakan komplain JastipNisa perlu dibedakan dan ditetapkan tersendiri.
- Estimasi packing dan proses pengiriman adalah 2–3 hari kerja, bukan jaminan waktu tiba.
- Shopee adalah jalur opsional; pelanggan wajib mengonfirmasi nama akun Shopee setelah checkout.
- Deposit, pelunasan, barang tidak tersedia, penolakan foto, ongkir, dan kebijakan komplain yang belum diputuskan tidak boleh di-hard-code.

## Referensi utama

- [Peta implementasi terpadu dan kontrak backend](docs/IMPLEMENTATION_MAP_REACT_GAS.md)
- [Arsitektur target](docs/ARCHITECTURE.md)
- [Roadmap implementasi](docs/IMPLEMENTATION.md)
- [Audit referensi GAS](docs/GAS_REFERENCE_MIGRATION.md)
- [PRD awal — historis](docs/PRD.md)

## Kondisi development saat ini

Source code di branch SOWAN masih memakai Supabase. Untuk saat ini perintah npm yang ada masih memeriksa baseline tersebut:

1. npm install
2. npm run typecheck
3. npm test
4. npm run build

Untuk membangun target GAS: jalankan npm run build:gas lalu npm run gas:validate. Instal clasp CLI secara global (npm install -g @google/clasp@3.4.1), login, konfigurasi .clasp.json, lalu ikuti docs/GAS_SETUP.md. Source legacy Supabase masih dipertahankan sementara hingga seluruh halaman dan data beralih.

Tidak ada Spreadsheet production, Drive folder, atau deployment GAS yang dibuat melalui commit GitHub ini. Periksa dan backup data aktual sebelum cutover.
