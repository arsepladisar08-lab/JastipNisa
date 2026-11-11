# JastipNisa — Development Control

Dokumen ini adalah ringkasan operasional untuk menjaga kesinambungan sesi pengembangan, termasuk sesi Google AI Studio. Baca dokumen ini sebelum mengubah kode.

## Source of truth

- Repository: https://github.com/arsepladisar08-lab/JastipNisa
- Baseline branch: `SOWAN`
- Work branch awal: `codex/audit-foundation-2026-11`
- Target transaksi: React + Google Apps Script HTML Service + Google Sheets + Google Drive.
- Entry Vercel saat ini: `src/main.tsx` → `src/App.tsx` (legacy Supabase baseline).
- Entry GAS: `src/gas/main.tsx` → `src/gas/GasApp.tsx`.
- GAS backend: `gas/*.gs`.
- Source of truth arsitektur terperinci: `docs/IMPLEMENTATION_MAP_REACT_GAS.md`.
- Aturan visual: `docs/DESIGN.md`.

## Aturan bisnis yang tidak boleh berubah tanpa keputusan pemilik

- Fee 1 produk Rp15.000.
- Fee 2 produk Rp25.000.
- Produk ketiga dan seterusnya menambah Rp10.000 per produk.
- Tidak ada batas jumlah pembelian per pelanggan.
- Produk tidak dapat diretur ke toko.
- Jangan mengarang nominal deposit/pelunasan, refund, ongkir, penanganan barang tidak tersedia, atau penolakan foto.
- Semua validasi dan perubahan status yang berdampak pada data harus divalidasi server-side.
- Jangan hapus Supabase source atau migrasi SQL sebelum cutover dan backup disetujui.

## Kondisi audit repository — 11 Nov 2026

### Sudah ada implementasi/commit, tetapi tetap perlu pengujian integrasi

- Jalur CTA Vercel ke GAS Web App sudah ditambahkan.
- Persiapan kompresi file foto sebelum upload sudah ada di `src/lib/uploadPreparation.ts`.
- API admin untuk terbitkan ulang dan cabut token portal sudah ada.
- Rotasi password admin menggunakan auth version sudah ada.
- Idempotency payload request sudah memiliki commit tersendiri.

### P0/P1 — merged ke `SOWAN` (PR #10)

- `doGet(e)` membaca `page` dan `t`, melakukan allow-list halaman serta validasi pola token, lalu menyisipkan `window.__JN_BOOT__` yang sudah di-escape.
- `src/gas/main.tsx` memetakan bootstrap ke HashRouter; deep link pelanggan/admin langsung ke route terkait.
- Builder tautan portal/admin tersedia di `src/lib/gasWebApp.ts`; request baru dan reissue token admin dapat menghasilkan tautan portal siap salin.
- `src/lib/gasMock.ts` menyediakan API mock in-memory; jalankan `npm run dev:gas-demo` (port 3001), login admin demo dengan `demo-admin`.
- Mock hanya aktif pada Vite development dengan mode/flag eksplisit; validator build GAS menolak marker mock di bundle produksi.

### P2/P3 — diimplementasikan pada branch kerja ini, menunggu review dan CI

**P2 — Security & transaction integrity**
- Mutasi admin yang memakai `LockService` memvalidasi ulang sesi setelah lock didapat, sehingga logout/rotasi password tidak meninggalkan mutasi yang lolos hanya dari pemeriksaan awal.
- Keputusan pelanggan divalidasi ulang bersama token dan status item di dalam lock; retry keputusan yang sama idempotent, keputusan berlawanan ditolak.
- Penolakan item melepas unit yang masih berstatus `held` dan membersihkan alokasi request agar stok tidak tertahan.
- Detail order dan konfirmasi username Shopee memvalidasi ulang token serta state order di dalam lock.
- Pembayaran dan pengeluaran menyimpan fingerprint payload untuk mendeteksi idempotency key yang dipakai ulang dengan data berbeda; retry identik dipakai ulang, konflik ditolak.
- Verifikasi pembayaran menerima retry keputusan yang sama dan menolak keputusan terminal yang berlawanan.
- Foto pelanggan dan bukti pembayaran admin dibaca dengan pemeriksaan token/sesi yang diserialkan; upload foto revalidasi status request dan membersihkan file Drive sementara jika request berubah.
- Form pembayaran/pengeluaran mempertahankan idempotency key lintas retry di form yang sama; pembayaran juga mempertahankan Drive proof ID yang telah diunggah agar retry tidak mengunggah ulang file yang sama. Kunci diganti bila payload atau file bukti berubah.

**P3 — Customer experience**
- Foto aktual tidak lagi diunduh semua saat portal dibuka. Pelanggan menekan **Lihat foto aktual** untuk memuat foto item terkait.
- CTA WhatsApp memakai nomor `admin_whatsapp` dari public GAS Settings. Jika kosong/tidak valid, portal menampilkan status konfigurasi, bukan tautan mati.
- Fungsi pembentuk tautan WhatsApp dinormalisasi untuk nomor lokal Indonesia dan diuji terpisah.

**Konfigurasi WhatsApp admin**
- Buka sheet `Settings` pada spreadsheet GAS.
- Cari baris `setting_key = admin_whatsapp`.
- Isi `setting_value` dengan nomor dalam format internasional digit saja, misalnya `6281234567890`; tandai `is_public = TRUE`.
- Tidak perlu menambahkan nomor ke source code. `getPublicSettings_()` hanya mengekspos key publik yang diizinkan.

**Batas verifikasi**
- CI memeriksa typecheck, unit test, build Vercel, build single-file GAS, dan validator struktur/guard keamanan.
- Pengujian integrasi nyata terhadap Script Properties, Google Sheets, Drive, dan Web App staging belum dilakukan dari branch ini. Jangan menganggap perubahan sudah live sebelum owner menjalankan staging smoke test.
## Urutan kerja yang disarankan

### P0 — Stabilkan routing dan kontrak app

- Buat deep-link GAS yang tervalidasi melalui parameter `e.parameter` di `doGet(e)`.
- Jangan pernah menyimpan token plaintext di sheet atau log.
- Tulis test untuk URL parsing/routing dan token invalid.
- Verifikasi bahwa portal dapat dimuat dari tautan baru pada Web App GAS staging.

### P1 — Mock yang aman untuk development

- Buat mock hanya aktif saat environment development atau flag eksplisit.
- Jangan pernah fallback ke mock pada production.
- Mock harus mengimplementasikan seluruh method `gasCall` yang dipakai UI atau menolak method yang tidak didukung secara eksplisit.
- Seed data harus sintetis dan banner demo harus terlihat.
- Build GAS production harus bebas dari mock aktif.

### P2 — Security & integritas transaksi

- Review auth version, token reissue/revoke, idempotency, LockService, payment verification, unit reservation.
- Buat pengujian race-condition dan duplicate submission.
- Jangan menambah pembatasan jumlah produk per pelanggan.
- Hindari global lockout yang dapat dipicu attacker untuk mengunci admin.

### P3 — Customer experience

- Tautan portal siap pakai.
- Lazy-load foto jika dibutuhkan.
- WhatsApp link/template dari setting admin (nomor kosong harus menghasilkan state yang jelas, bukan link mati).

### P4 — Workflow order

- Selesaikan pembatalan hanya setelah state machine, shipment, unit release, payment ledger dan refund decision dirumuskan.
- Tidak ada refund otomatis tanpa kebijakan eksplisit.
- Order shipped/completed tidak boleh dibatalkan melalui jalur yang sama.

### P5 — Performance & cleanup

- Ukur latency dan ukuran sheet terlebih dahulu.
- Tambahkan cache/index hanya dengan invalidasi yang teruji.
- Pecah komponen besar secara bertahap tanpa perubahan perilaku.
- Tambahkan test kontrak API, accessibility, dan concurrency.

## Aturan kerja setiap perubahan

1. Baca file target dan caller/callee langsung yang relevan; jangan memuat ulang seluruh repo.
2. Buat perubahan kecil yang terisolasi.
3. Pertahankan kontrak API dan aturan bisnis kecuali tugas secara eksplisit mengubahnya.
4. Jalankan `npm run typecheck`, `npm test`, `npm run build`, `npm run build:gas`, dan `npm run gas:validate`.
5. Laporkan command yang benar-benar dijalankan dan hasilnya. Jangan mengklaim test lolos bila hanya membaca source.
6. Satu fitur = satu commit dengan pesan konvensional.
7. Jangan mengubah deployment production atau Script Properties tanpa persetujuan/akses pemilik.
8. Setelah merge/commit, perbarui bagian status ini dan `docs/IMPLEMENTATION.md`.

## Prompt ringkas untuk sesi Google AI Studio

Baca `docs/DEVELOPMENT_CONTROL.md` dan hanya file yang disebutkan oleh tugas. Jangan melakukan audit repository penuh. Implementasikan hanya scope yang diberikan. Pertahankan business rules, API contracts, dan arsitektur. Jalankan command verifikasi yang tersedia dan laporkan file berubah, hasil test, serta risiko yang tersisa. Jangan mengarang test yang belum dijalankan.
