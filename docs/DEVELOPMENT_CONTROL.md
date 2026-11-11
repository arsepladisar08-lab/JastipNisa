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

### Implementasi P0/P1 pada branch kerja (menunggu PR review)

- `doGet(e)` membaca `page` dan `t`, melakukan allow-list halaman serta validasi pola token, lalu menyisipkan `window.__JN_BOOT__` yang sudah di-escape.
- `src/gas/main.tsx` memindahkan bootstrap portal/admin ke route HashRouter dan menyimpan token portal yang tervalidasi ke sessionStorage.
- Builder tautan portal/admin ditambahkan di `src/lib/gasWebApp.ts`; token yang salah format atau token pada halaman admin ditolak.
- Request baru dan reissue token admin menampilkan tautan portal siap salin bila URL Web App tersedia.
- `src/lib/gasMock.ts` meniru API GAS di memori, memuat dua request group, satu order, satu pembayaran awaiting verification, dan data katalog sintetis.
- Jalankan preview demo dengan `npm run dev:gas-demo` (port 3001). Password admin demo: `demo-admin`.
- Mock tidak aktif di production; validator bundle GAS menolak marker kode mock bila masuk ke HTML produksi.

### Gap yang perlu ditangani

1. `gas/Code.gs` → `doGet()` belum menerima parameter `page`/token. URL portal/admin yang deep-linked belum diselesaikan.
2. `src/lib/gasClient.ts` langsung menolak `GAS_BRIDGE_UNAVAILABLE` bila `google.script.run` tidak tersedia. Local mock terisolasi belum ada.
3. `apiAdminConfirmPayment` masih menjadi alias duplikat dari `apiAdminVerifyPayment`.
4. Login throttle hanya berdasarkan browser ID yang dikirim client; tidak ada bukti rate limit global/per-phone untuk create request.
5. Admin portal token saat ini ditampilkan/disalin sebagai token mentah; tautan portal siap-pakai perlu diselesaikan bersama routing deep-link.
6. Foto portal dimuat serentak di `PortalPage.refresh`; pertimbangkan lazy loading setelah ukur dampaknya.
7. WhatsApp button/template dan alur pembatalan belum terlihat lengkap di UI.
8. `Database.gs` membaca sheet penuh untuk operasi lookup; optimasi hanya setelah baseline latency dicatat.
9. CI perlu menggunakan lockfile (`npm ci`). Pastikan `package-lock.json` benar-benar tersedia pada branch sebelum mewajibkannya.

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
