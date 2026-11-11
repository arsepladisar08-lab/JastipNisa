# JastipNisa — Roadmap Implementasi

Peta implementasi terperinci: [IMPLEMENTATION_MAP_REACT_GAS.md](IMPLEMENTATION_MAP_REACT_GAS.md).

## Arah teknologi

Target arsitektur adalah React + Vite + TypeScript yang disajikan melalui Google Apps Script HTML Service, dengan Google Sheets sebagai database operasional dan Google Drive sebagai file storage. React memanggil backend melalui google.script.run.

Dokumentasi lama yang memilih Supabase sudah tidak menjadi keputusan arsitektur target. Namun source code branch SOWAN masih memakai Supabase sampai pekerjaan migrasi selesai.

## Urutan delivery

| Fase | Fokus | Output utama |
|---|---|---|
| 0 | Data foundation | Spreadsheet, sheet schema, Drive folders, Script Properties, IDs, fee tests dan keputusan struktur deposit |
| 1 | Backend GAS | API facade, validation, auth, repositories, request/order/payment/inventory/shipment services |
| 1.5 | React shell di HTML Service | typed bridge, Vite single-file build, hash routing, local mock, clasp staging |
| 1.6 | Admin workflow | Dashboard, katalog/varian, request & daftar buru, unit aktual, order final, payment ledger, shipping, expenses |
| 2 | Customer front office | Multi-item request, access token, portal status, foto aktual, format order, Shopee username |
| 2.5 | Finance/reporting | Kas terverifikasi, pembayaran Shopee terpisah, deposit, piutang, HPP, biaya dan laba sementara |
| 3+ | Out of MVP | Multi-jastiper, multi-tenant, escrow, payment gateway dan otomasi pihak ketiga |

## Prinsip delivery

1. Bangun kontrak data dan service backend sebelum memindahkan UI secara masif.
2. Pindahkan fitur bertahap; jangan port state mock sebagai data produksi.
3. Setiap mutasi penting divalidasi di server dan memiliki audit trail.
4. Status tidak boleh diubah secara bebas. Gunakan state machine yang eksplisit.
5. Jangan menghapus Supabase code/schema sampai pengganti GAS lolos acceptance dan data yang dibutuhkan sudah dibackup.
6. Gunakan Spreadsheet, Drive folder, dan deployment staging yang terpisah dari production.
7. Jangan mengubah keputusan bisnis yang belum final menjadi default implementasi.

## Progress implementasi setelah audit 11 Nov 2026

- [x] P0 deep-link GAS dan P1 mock lokal digabung ke `SOWAN` melalui PR #10.
- [x] P2 guard sesi admin, keputusan/token pelanggan, fingerprint idempotency pembayaran/pengeluaran, dan validasi integritas Drive diimplementasikan pada branch kerja P2/P3.
- [x] P3 lazy-load foto portal dan CTA WhatsApp berbasis konfigurasi GAS diimplementasikan pada branch kerja P2/P3.
- [ ] Review PR, CI penuh, dan uji integrasi di GAS staging masih diperlukan; belum ada deployment produksi.

## Status saat dokumen dibuat

- [x] Repo SOWAN dan PR #1 yang telah digabung ditinjau sebagai baseline.
- [x] Tiga referensi produk/GAS/TSX dianalisis dan disatukan dalam peta implementasi.
- [x] Target arsitektur React + Google Apps Script ditetapkan.
- [ ] Spreadsheet dev dan schema sheet dibuat.
- [ ] Backend GAS dan security service dibangun.
- [ ] React diintegrasikan dengan google.script.run.
- [ ] Admin workflow dipindahkan.
- [ ] Customer front office dipindahkan.
- [ ] Finance, staging, browser test dan cutover diselesaikan.

Status ini menunjukkan penyelesaian dokumen arsitektur saja; bukan status implementasi aplikasi.
