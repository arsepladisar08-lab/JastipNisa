# JastipNisa

Aplikasi operasional jasa titip produk Flicka dengan frontend React dan backend Google Apps Script.

## Status arsitektur

**Target stack:** React + Vite + TypeScript + Google Apps Script + Google Sheets + Google Drive.

**Penting:** branch SOWAN tetap menjadi baseline React + Supabase sampai PR migrasi direview dan digabung. Branch `architecture/react-google-apps-script` kini berisi entry React GAS terpisah, layanan Apps Script, sheet schema, UI pelanggan/admin, serta build khusus. Belum ada Google Apps Script project/Spreadsheet/Drive deployment yang dikonfigurasi; ikuti GAS_SETUP.md untuk membuat staging di akun pemilik.

Dokumen utama pengembangan: [Peta Implementasi Terpadu — React + Google Apps Script](docs/IMPLEMENTATION_MAP_REACT_GAS.md). Panduan setup: [GAS_SETUP.md](docs/GAS_SETUP.md).

Pada website publik Vercel, tombol **Mulai Request** mengarah ke React + GAS Web App setelah `VITE_GAS_WEBAPP_URL` dikonfigurasi. Website publik dan aplikasi transaksi tetap berjalan pada origin terpisah; request pelanggan diproses di GAS agar `google.script.run` tetap digunakan secara native. URL deployment GAS adalah konfigurasi publik, bukan tempat menyimpan credential.


## Development preview

- React + GAS demo: `npm run dev:gas-demo` (port 3001; password demo admin: `demo-admin`). Data hanya sintetis dan tidak tersimpan ke produksi.
- Panduan kontrol pengembangan dan aturan bisnis: [docs/DEVELOPMENT_CONTROL.md](docs/DEVELOPMENT_CONTROL.md).
- Nomor WhatsApp pada app GAS dibaca dari baris `admin_whatsapp` di sheet `Settings`; isi format internasional digit saja dan set `is_public` ke `TRUE`.

## P4/P5 delivery

- Customer cancellation requests and admin review are implemented as a separate, non-destructive review register. Acceptance does not automatically cancel an order, release inventory or issue a refund.
- Database read snapshots are scoped to one API/locked execution; ID-keyed updates are grouped into contiguous sheet ranges. CI validates call counts with a local Spreadsheet stub.
- PR #12 has been merged into `SOWAN`. CI passed 37 unit tests, dependency audit, typecheck, both builds, and GAS validation. A live staging smoke test is still required. See [docs/DEVELOPMENT_CONTROL.md](docs/DEVELOPMENT_CONTROL.md) for constraints and setup.

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

## Panduan pengembangan berkelanjutan

- [Development Control](docs/DEVELOPMENT_CONTROL.md) — status audit, urutan kerja, aturan perubahan, dan workflow hemat konteks AI.

## Kondisi development saat ini

Entry default pada branch SOWAN masih memakai Supabase. Pada branch migrasi, entry GAS khusus dapat diuji/dibuild melalui perintah tambahan di bawah. Perintah npm standar masih memeriksa kompatibilitas baseline:

1. npm install
2. npm run typecheck
3. npm test
4. npm run build

Untuk membangun target GAS: jalankan npm run build:gas lalu npm run gas:validate. Build ini membundel `src/gas/main.tsx` ke satu file `gas/Index.html` dan tidak memakai entry Supabase lama. Instal clasp CLI secara global (npm install -g @google/clasp@3.4.1), login, konfigurasi .clasp.json, lalu ikuti docs/GAS_SETUP.md. Source legacy Supabase masih dipertahankan sementara hingga seluruh halaman dan data beralih.

Tidak ada Spreadsheet production, Drive folder, atau deployment GAS yang dibuat melalui commit GitHub ini. Periksa dan backup data aktual sebelum cutover.
