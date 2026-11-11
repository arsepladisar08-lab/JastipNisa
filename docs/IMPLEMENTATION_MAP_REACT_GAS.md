# JastipNisa — Peta Implementasi Terpadu
## Arsitektur React + Google Apps Script

| Properti | Nilai |
|---|---|
| Versi dokumen | 1.0.0 |
| Tanggal | 11 November 2026 |
| Status | Peta implementasi target — belum seluruhnya diimplementasikan |
| Repository | arsepladisar08-lab/JastipNisa |
| Branch acuan | SOWAN |
| Arsitektur target | React + Vite + TypeScript + Google Apps Script + Google Sheets + Google Drive |

> Dokumen ini menjadi peta implementasi utama setelah keputusan berpindah dari React + Supabase ke React + Google Apps Script. Dokumen ini menyatukan kebutuhan bisnis, referensi prototipe GAS, dan referensi UI TSX. Status “direncanakan” tidak boleh dibaca sebagai fitur yang sudah selesai.

---

## 1. Ringkasan keputusan

JastipNisa akan menggunakan satu aplikasi React yang berkomunikasi langsung dengan server-side Google Apps Script melalui HTML Service.

- **Frontend:** React + Vite + TypeScript.
- **Runtime aplikasi:** Google Apps Script Web App dengan HTML Service.
- **Komunikasi frontend/backend:** google.script.run, dibungkus menjadi Promise-based typed client.
- **Database operasional:** Google Sheets.
- **Penyimpanan file:** Google Drive.
- **Sumber kode:** GitHub.
- **Build dan deployment GAS:** Vite build single-file + clasp.
- **Autentikasi admin:** autentikasi aplikasi yang diverifikasi server-side oleh Apps Script.
- **Akses pelanggan:** tanpa akun website; menggunakan token akses pesanan berentropi tinggi.

### Mengapa pola ini dipilih

Pola ini mempertahankan React untuk antarmuka modern dan memanfaatkan Google Sheets/Drive yang sesuai dengan operasi JastipNisa. Dengan menyajikan React dari HTML Service, frontend dapat memakai google.script.run secara native. Kita tidak perlu menjadikan Apps Script sebagai REST API lintas-domain yang dipanggil langsung dari domain Vercel.

Google mendeskripsikan google.script.run sebagai API asinkron untuk halaman HTML Service yang memanggil fungsi Apps Script. Panggilan dapat selesai tidak berurutan dan dibatasi hingga 10 panggilan server bersamaan; karena itu client adapter perlu mengatur antrean mutasi dan menangani success/failure secara eksplisit. Lihat referensi resmi pada bagian 16.

### Batasan arsitektur

Arsitektur ini cocok untuk aplikasi operasional satu layanan/satu admin atau tim kecil dengan volume data yang masih sesuai dengan kuota Apps Script dan batas performa Google Sheets. Ini bukan fondasi multi-tenant atau transaksi ber-volume tinggi. Jika nanti volume, konkurensi, kebutuhan audit, atau pemisahan tenant meningkat secara signifikan, backend relasional perlu dievaluasi kembali.

---

## 2. Referensi yang digabungkan dan aturan prioritas

Dokumen ini memakai tiga kelompok referensi berikut.

| Referensi | Peran dalam peta | Yang dipertahankan | Yang tidak disalin mentah |
|---|---|---|---|
| Project Brief JastipNisa v0.2.1 | Sumber utama kebutuhan produk, aturan bisnis, fase, dan model data | Alur deposit, request, pencarian barang, konfirmasi foto, fee, data order, Shopee, pengiriman, ledger dan keputusan terbuka | Opsi stack lama yang menyebut Supabase/PostgreSQL; arsitektur disesuaikan dengan keputusan React + GAS |
| Index JastipNisa1.html + Code JastipNisa1.gs | Referensi alur operasional GAS dan integrasi Google Sheets | google.script.run, struktur sheet awal, katalog, cart sederhana, kode pesanan, admin, daftar buru, unit dan pembayaran | Pola identitas order + empat digit HP, update berdasarkan nomor baris, akses Settings tanpa allow-list, transisi status bebas, dan pembuatan order final terlalu dini |
| jastipnisa_fullstack_webapp.tsx | Referensi UI/UX dan cakupan fitur | Katalog, filter, cart, kalkulasi fee, customer tracker, format order, Shopee confirmation, dashboard, hunting list, katalog admin, pengeluaran | State mock, PIN demo 1126/nisa, data pelanggan contoh, pencarian melalui nomor telepon, status admin bebas, dan metrik keuangan berbasis data simulasi |

### Hierarki keputusan

1. Aturan bisnis yang sudah diputuskan di Brief v0.2.1 menjadi sumber kebenaran.
2. Bagian “Perlu keputusan” tetap menjadi keputusan terbuka. Developer tidak boleh mengubahnya menjadi default diam-diam.
3. Referensi GAS adalah bukti konsep alur, bukan standar keamanan atau model data final.
4. TSX adalah referensi tampilan dan perilaku UI. Semua data dan aksi harus dihubungkan ulang ke backend GAS.
5. Bila ada konflik antara prototipe dan Brief v0.2.1, ikuti Brief v0.2.1, kecuali pemilik proyek memutuskan perubahan secara eksplisit.

---

## 3. Kondisi repository saat keputusan arsitektur berubah

Branch SOWAN saat ini sudah memiliki implementasi React + Vite + TypeScript yang terhubung ke Supabase. PR #1 telah digabungkan ke SOWAN pada 11 November 2026.

Artinya:

- Kode saat ini **belum menjadi aplikasi React + GAS**.
- Masih ada Supabase client, Supabase schema/migrations, RLS, dan dokumentasi setup Supabase.
- Dokumen ini menetapkan target arsitektur dan urutan migrasi; ini bukan klaim bahwa migrasi kode sudah selesai.
- Pekerjaan migrasi perlu dibuat pada branch terpisah. Branch SOWAN tetap menjadi baseline sampai pengganti lolos verifikasi.
- Jangan menghapus schema, migration, atau dependency Supabase sebelum semua fungsi pengganti GAS terbukti bekerja dan setiap data yang memang perlu dipertahankan sudah diekspor serta dicadangkan.
- Belum ada bukti di repository bahwa proyek Supabase production atau deployment Vercel aktif telah dikonfigurasi. Sebelum cutover, tetap lakukan pemeriksaan kredensial dan data aktual; jangan menyimpulkan tidak ada data hanya dari isi repository.

---

## 4. Arsitektur target

~~~text
Pelanggan / Admin
       |
       v
Google Apps Script Web App URL
       |
       v
HTML Service: Index.html (hasil build React)
       |
       v
React + Vite + TypeScript
  - Public pages
  - Customer request/status pages
  - Admin workspace
  - Typed GAS client adapter
       |
       | google.script.run (async RPC)
       v
Apps Script server-side services
  - Public API facade
  - Customer API facade
  - Admin API facade
  - Authentication & authorization
  - Validation & business rules
  - Order / payment / inventory services
  - Spreadsheet repositories
  - Drive file service
       |
       +--------------------+
       |                    |
       v                    v
Google Sheets          Google Drive
operational records    private file storage
~~~

### 4.1 Frontend React

React tetap bertanggung jawab atas:

- Navigasi dan komposisi halaman.
- Form pelanggan dan admin.
- State UI, loading, error, empty state, dan konfirmasi.
- Validasi pengalaman pengguna (validasi server tetap wajib).
- Kalkulasi preview fee untuk kenyamanan pelanggan.
- Render katalog, foto, status, daftar buru, dan laporan dari data API.

React tidak boleh:

- Mengakses Spreadsheet atau Drive secara langsung.
- Menyimpan kredensial admin permanen di browser.
- Menjadi sumber kebenaran untuk harga, fee, pembayaran, status, atau otorisasi.
- Menentukan bahwa pembayaran sudah valid hanya karena form berhasil dikirim.

### 4.2 Distribusi React melalui Apps Script HTML Service

Target rilis awal tidak menggunakan Vercel sebagai host frontend. Build React dibuat menjadi satu file HTML yang memuat bundle JavaScript dan CSS secara inline, lalu disimpan sebagai file HTML yang disajikan oleh Apps Script HTML Service.

Konsekuensinya:

- Buat target build khusus GAS, misalnya perintah build:gas.
- Output build harus menghasilkan satu file HTML siap disalin ke direktori project Apps Script.
- Gunakan routing berbasis hash atau router yang kompatibel dengan satu halaman HTML Service; jangan mengandalkan server rewrite URL path.
- Pastikan asset font, ikon, gambar, dan CSS tidak bergantung pada path lokal hasil build.
- Mode development Vite tetap tersedia. Untuk development lokal, sediakan adapter mock agar halaman dapat diuji tanpa mengirim request ke produksi.
- URL deployment Apps Script menjadi URL aplikasi publik dan admin.

Teknik build single-file harus diverifikasi dengan build output nyata pada fase implementasi; jangan menganggap file hasil Vite default otomatis kompatibel dengan HTML Service.

### 4.3 Komunikasi React ke Apps Script

Gunakan google.script.run, bukan fetch langsung ke URL Apps Script dari origin Vercel.

Buat satu adapter typed di sisi React, misalnya src/lib/gasClient.ts:

- Menyediakan Promise wrapper dengan withSuccessHandler dan withFailureHandler.
- Mendefinisikan request/response type untuk setiap operasi.
- Menormalkan error server menjadi pesan UI yang aman.
- Mengatur antrean untuk mutasi yang harus berurutan.
- Menghindari banyak panggilan kecil yang tidak perlu.
- Membatasi paralelisme karena google.script.run memiliki batas 10 panggilan bersamaan dan eksekusi asinkron tidak dijamin berurutan.
- Tidak mengekspos fungsi internal Apps Script yang tidak dibutuhkan frontend.

Di sisi GAS, hanya fungsi API yang memang menjadi kontrak frontend yang boleh memiliki nama publik. Helper internal gunakan akhiran underscore, misalnya validateRequest_(), findById_(), requireAdmin_(), dan writeRows_().

### 4.4 Apps Script sebagai backend

Pisahkan fungsi per tanggung jawab. Jangan mempertahankan satu Code.gs monolitik yang berisi seluruh operasi.

Struktur source yang direkomendasikan:

~~~text
gas/
  appsscript.json
  Code.gs
  Config.gs
  ApiPublic.gs
  ApiCustomer.gs
  ApiAdmin.gs
  AuthService.gs
  CustomerTokenService.gs
  CatalogService.gs
  RequestService.gs
  OrderService.gs
  PaymentService.gs
  InventoryService.gs
  ShipmentService.gs
  ReportService.gs
  SpreadsheetRepository.gs
  DriveStorage.gs
  Validation.gs
  Index.html                 # generated React build
~~~

Catatan: Apps Script project dapat menampilkan file-file server sebagai beberapa file .gs. Struktur di atas adalah pembagian tanggung jawab source, bukan keharusan struktur folder internal di editor Apps Script.

### 4.5 Google Sheets sebagai database operasional

Satu Spreadsheet menjadi sumber data utama. Setiap tabel logis ditempatkan pada sheet terpisah. Gunakan ID stabil untuk setiap record; jangan memakai nomor baris sebagai identitas record.

Sheet inti yang direncanakan:

1. Katalog
2. Varian
3. Request
4. Unit
5. Pembeli
6. Pesanan
7. Item_Pesanan — tambahan teknis yang disarankan agar item order dan alokasi unit tidak dicampur dengan request awal.
8. Pembayaran
9. Pengeluaran
10. Rekap — ringkasan formula/query, bukan tempat mengedit transaksi.
11. Pengaturan — konfigurasi non-rahasia yang memang perlu dapat diubah admin.

Brief v0.2.1 menyebut sembilan sheet utama. Item_Pesanan ditambahkan sebagai rekomendasi teknis karena sistem memerlukan pemisahan eksplisit antara request awal pelanggan dan daftar barang final pada order. Pengaturan dapat berupa sheet non-rahasia; rahasia autentikasi tetap disimpan di Script Properties.

Jangan membuat sheet publik atau mempublikasikan Spreadsheet. Semua pembacaan dan penulisan dilakukan dari server Apps Script.

### 4.6 Google Drive sebagai file storage

Gunakan folder Drive khusus JastipNisa, dengan subfolder yang dibedakan untuk:

- Foto aktual unit.
- Bukti pembayaran.
- Dokumen pendukung lain bila diperlukan.

Data di Google Sheets menyimpan fileId dan metadata, bukan mengandalkan URL publik sebagai identitas file.

Aturan akses:

- Bukti pembayaran hanya dapat dilihat admin.
- Foto aktual hanya ditampilkan kepada pelanggan terkait setelah token order/request divalidasi.
- Jangan mengubah semua file menjadi “anyone with the link” hanya agar gambar tampil.
- React tidak boleh menganggap URL Drive yang tersimpan otomatis dapat dibuka oleh pelanggan.
- Mekanisme preview foto pelanggan harus diuji; pilihan awal adalah endpoint GAS yang mengembalikan preview berukuran kecil setelah memvalidasi token pelanggan, atau mekanisme akses file terbatas lain yang disetujui.
- Ukuran file, tipe MIME, dan jumlah upload harus divalidasi sebelum menyimpan ke Drive. Foto dapat dikompresi di browser sebelum dikirim ke GAS.

---

## 5. Model data terpadu

### 5.1 Relasi konseptual

~~~text
Pembeli
  |---< Request Group
  |       |---< Request (satu baris per produk/varian yang diminta)
  |       |---< Pembayaran (deposit awal dapat terkait request)
  |
  |---< Pesanan (order final)
          |---< Item_Pesanan
          |       |--- 0..1 Unit aktual yang dialokasikan
          |---< Pembayaran (pelunasan, penyesuaian, refund)
          |--- 0..1 data pengiriman (kolom di Pesanan untuk MVP)

Katalog
  |---< Varian
          |---< Request
          |---< Item_Pesanan
          |---< Unit
~~~

### 5.2 Tabel dan tanggung jawab

| Sheet | Satu baris merepresentasikan | Field inti yang perlu dikelola |
|---|---|---|
| Katalog | Satu model produk dari katalog resmi | product_id, nama_produk, kategori, gambar_katalog, url_katalog, harga_referensi, terakhir_diperiksa, status_tampil, catatan |
| Varian | Satu varian/warna katalog | variant_id, product_id, nama_varian, gambar_varian, url_varian, status_varian, terakhir_diperiksa, catatan |
| Request | Satu produk/varian yang diminta pelanggan | request_id, request_group_id, tgl_request, buyer_id, order_id (opsional), product_id, variant_id, nama_produk, nama_varian, jumlah, catatan_pelanggan, status_cek, foto_aktual/fileId, catatan_admin |
| Unit | Satu unit fisik yang benar-benar ditemukan/dibeli | unit_id/kode_unit, tgl_didapat, product_id, variant_id, model, warna, foto_aktual/fileId, catatan_kondisi, no_struk, harga_beli, status, order_id atau order_item_id |
| Pembeli | Satu pelanggan | buyer_id, nama, no_hp, alamat, nama_akun_shopee, catatan, tgl_order_terakhir |
| Pesanan | Satu transaksi final pelanggan | order_id, tgl_order, buyer_id, nama, alamat, no_hp, jumlah_produk, subtotal_barang, fee_jastip, ongkir, diskon, total_tagihan, total_deposit, total_dibayar, sisa_tagihan, metode_order, nama_akun_shopee, link_checkout_shopee, status_order, status_pengiriman, kurir, resi, catatan_admin |
| Item_Pesanan | Satu baris unit produk dalam order final | order_item_id, order_id, request_id, product_id, variant_id, snapshot_model, snapshot_varian, unit_id, jumlah (atau satu baris per unit), harga_barang, status_item |
| Pembayaran | Satu transaksi uang terkait request atau order | payment_id, tgl, request_group_id/request_id (opsional), order_id (opsional), jenis_transaksi, jumlah, metode, bukti_file_id/link, status_verifikasi, catatan |
| Pengeluaran | Satu biaya operasional | expense_id, tgl, kategori, keterangan, jumlah, order_id, event |
| Rekap | Ringkasan turunan dari transaksi | bukan sumber input transaksi; dihitung dari record yang lolos aturan verifikasi |
| Pengaturan | Satu konfigurasi non-rahasia | key, value, updated_at, updated_by |

**Penyesuaian skema yang perlu dicatat:**

- Brief v0.2.1 menempatkan Pembayaran terutama di bawah order. Namun deposit dilakukan sebelum barang ditemukan dan sebelum order final siap; karena itu pembayaran awal perlu dapat dikaitkan dengan request_group_id/request_id, sementara order_id dapat kosong sampai order dibuat.
- Saat request diubah menjadi order final, deposit terverifikasi harus dipindahkan relasinya atau dialokasikan ke order tepat satu kali tanpa menggandakan transaksi. Simpan jejak asal request.
- Request awal dan Item_Pesanan final tidak boleh dianggap entitas yang sama.
- Jika satu produk diminta dalam jumlah lebih dari satu, jumlah unit fisik tetap menjadi dasar perhitungan fee. Saat order final, sistem perlu menghitung total unit, bukan jumlah nama model yang unik.
- Kolom file foto menyimpan fileId Drive dan metadata. URL publik permanen bukan kunci record.
- ID record dibuat oleh server. Nomor baris spreadsheet hanya detail penyimpanan internal dan tidak pernah menjadi ID API.

---

## 6. Alur bisnis end-to-end

### 6.1 Jalur pelanggan

1. Pelanggan membuka halaman JastipNisa dan membaca disclaimer bahwa JastipNisa adalah layanan independen, bukan toko resmi Flicka.
2. Pelanggan menelusuri katalog referensi Flicka. Status katalog aktif tidak berarti stok tersedia.
3. Pelanggan memilih model/varian yang tersedia pada data referensi, menambahkan jumlah produk, dan melihat estimasi fee jastip.
4. Pelanggan membuat request/wishlist. Sistem menyimpan request group beserta item yang diminta dan mengembalikan kode request serta token akses pelanggan.
5. Pelanggan menyimpan kode/token dan melanjutkan komunikasi ke WhatsApp admin untuk bukti transfer serta instruksi pembayaran sesuai kebijakan admin.
6. Admin memverifikasi pembayaran secara manual dan mulai memeriksa/mencari produk.
7. Jika produk ditemukan, admin mencatat unit aktual, foto aktual, dan kondisi/cacat yang terlihat.
8. Pelanggan melihat hasil pencarian dan foto aktual melalui portal token atau menerima foto melalui WhatsApp sesuai mekanisme MVP.
9. Pelanggan menyetujui barang yang ditemukan dan melengkapi nama, alamat, nomor HP, serta daftar final.
10. Sistem membuat order final setelah syarat alur yang ditetapkan terpenuhi. Fee dihitung ulang dari jumlah produk final.
11. Jika jalur Shopee digunakan, admin memberikan link checkout. Pelanggan checkout dan wajib mengonfirmasi nama akun Shopee.
12. Admin memproses packing dan pengiriman. Estimasi proses admin adalah 2–3 hari kerja; ini bukan jaminan waktu tiba kurir.
13. Pelanggan menerima informasi kurir/resi dan status order sampai selesai.

### 6.2 Jalur admin

1. Admin login melalui halaman admin.
2. Dashboard menampilkan request, pembayaran perlu diverifikasi, item sedang dicari, unit tersedia, order aktif, pembayaran tersisa, packing dan pengiriman.
3. Admin mengelola katalog dan varian berdasarkan sumber resmi; perubahan harga/model harus diperiksa ulang.
4. Admin memeriksa request dan mengelompokkan daftar buru berdasarkan model/varian.
5. Admin mencatat bukti pembayaran dan memutuskan status verifikasinya.
6. Admin menambahkan unit aktual dengan foto, kondisi, nomor struk, harga beli dan status.
7. Admin menghubungkan unit yang sesuai ke request/item final tanpa memperbolehkan satu unit aktif dialokasikan ke dua order.
8. Admin mengirim/membuka foto aktual bagi pelanggan yang berhak melihatnya.
9. Admin mencatat persetujuan pelanggan, data pengiriman, harga final, kanal pembayaran dan status order.
10. Admin mencatat pembayaran tambahan/refund hanya bila benar-benar terjadi sesuai keputusan bisnis.
11. Admin mencatat Shopee link dan memeriksa nama akun Shopee pelanggan.
12. Admin mengisi pengiriman, kurir, resi, biaya dan pengeluaran.
13. Dashboard dan laporan dihitung dari ledger dan transaksi tervalidasi.

### 6.3 Kejadian khusus

- Produk tidak ditemukan: status request menjadi tidak tersedia. Pilihan pengembalian, substitusi, atau carry-forward mengikuti keputusan admin yang belum ditetapkan.
- Pelanggan menolak foto aktual: sistem mencatat penolakan dan menunggu keputusan penyelesaian; jangan otomatis mengembalikan atau memindahkan deposit.
- Jumlah item berubah: fee dihitung ulang dari jumlah final yang disetujui. Simpan nilai fee dan perubahan sebelumnya sebagai riwayat.
- Order dibatalkan sebelum dikirim: unit dapat dilepas untuk dialokasikan kembali hanya setelah aturan pembatalan ditetapkan dan riwayat unit tetap disimpan.
- Barang tidak dapat diretur ke toko: tampilkan secara jelas sebelum pelanggan menyetujui barang. Kebijakan komplain antara JastipNisa dan pelanggan tetap merupakan aturan terpisah yang perlu diputuskan.
- Shopee: pisahkan transaksi Shopee dari transfer langsung untuk menghindari hitung ganda.

---

## 7. Aturan bisnis yang wajib dipertahankan

### 7.1 Fee jastip

Jumlah dihitung dari total unit/produk di dalam satu order, bukan jumlah model unik.

~~~text
fee(0) = 0
fee(n) = Rp15.000 + (Rp10.000 x (n - 1)), untuk n >= 1
~~~

| Produk per order | Fee |
|---:|---:|
| 1 | Rp15.000 |
| 2 | Rp25.000 |
| 3 | Rp35.000 |
| 4 | Rp45.000 |
| 5 | Rp55.000 |
| 6 | Rp65.000 |

Tidak ada batas jumlah pembelian per pelanggan dari sisi JastipNisa. Jangan menyalin batas maksimum 50 item dari prototipe Code.gs sebagai aturan bisnis. Pembatasan teknis terhadap ukuran payload/kuota harus dipisahkan dari kebijakan jumlah order.

### 7.2 Katalog dan unit aktual

- Katalog resmi Flicka adalah referensi model, gambar katalog, varian, deskripsi dan harga referensi.
- Model katalog bukan stok yang sudah dimiliki.
- Ketersediaan wajib dikonfirmasi admin.
- Foto katalog dan foto aktual adalah dua aset berbeda.
- Harga referensi katalog bukan otomatis harga transaksi JastipNisa.
- Daftar 12 model dari snapshot Brief v0.2.1 harus diverifikasi ulang sebelum dijadikan katalog aktif; snapshot bukan bukti stok atau harga terkini.

### 7.3 Pembayaran

- Alur dimulai dari deposit/payment dan bukti pembayaran dikirim kepada admin.
- Nominal deposit/proporsinya belum diputuskan.
- Status bukti dan status verifikasi harus dibedakan dari transaksi uang yang sudah terverifikasi.
- Deposit, pelunasan, pembayaran Shopee, refund, dan penyesuaian dicatat sebagai tipe transaksi berbeda.
- Jangan menghitung pembayaran yang sama dua kali.
- Refund hanya dicatat jika transaksi refund benar-benar dilakukan.

### 7.4 Pengiriman dan Shopee

- Estimasi packing/proses pengiriman: 2–3 hari kerja.
- Titik awal estimasi masih perlu keputusan.
- Shopee merupakan jalur opsional yang diberikan admin melalui link checkout.
- Nama akun Shopee wajib dikonfirmasi setelah checkout jika jalur Shopee digunakan.
- Kurir, ongkir, dan struktur biaya Shopee masih perlu ditentukan.

---

## 8. State machine dan validasi alur

Status bukan dropdown bebas. Setiap perubahan harus melewati fungsi layanan di GAS yang memeriksa status asal, status tujuan, bukti/field wajib, dan hak akses pelaku.

### 8.1 Request

Status yang direncanakan:

~~~text
menunggu_cek
  -> sedang_dicari
  -> tersedia
  -> tidak_tersedia
  -> selesai / batal
~~~

Setiap request menyimpan jejak pencarian, catatan admin, foto aktual, dan relasi unit jika ditemukan.

### 8.2 Unit

Status yang direncanakan:

~~~text
dicari
  -> tersedia
  -> menunggu_persetujuan
  -> dialokasikan
  -> dikemas
  -> dikirim
  -> selesai
~~~

Unit tidak boleh dialokasikan aktif ke lebih dari satu item/order. Status unit harus mengikuti proses alokasi, pembatalan, packing dan pengiriman; bukan diubah bebas dari UI tanpa validasi.

### 8.3 Order

Alur utama dari Brief v0.2.1:

~~~text
menunggu_pembayaran_awal
  -> menunggu_bukti_pembayaran
  -> menunggu_pengecekan_produk
  -> sedang_dicari
  -> menunggu_konfirmasi_foto
  -> menunggu_data_order
  -> siap_diproses
  -> packing
  -> diproses_pengiriman
  -> dikirim
  -> selesai
~~~

Status alternatif:

- produk_tidak_tersedia
- menunggu_keputusan_pelanggan
- dibatalkan

Transisi final harus mempertimbangkan bahwa request dan deposit dapat tercatat sebelum order final dibuat. Status di atas adalah alur bisnis; detail transisi teknis perlu diselaraskan saat implementasi service dan diuji pada skenario request multi-item.

### 8.4 Pembayaran

~~~text
menunggu_bukti
  -> menunggu_verifikasi
  -> terverifikasi / ditolak
~~~

Tipe transaksi meliputi deposit, pelunasan, pembayaran Shopee, refund dan penyesuaian. Status pembayaran tidak menggantikan status order.

### 8.5 Shipment

Status pengiriman disimpan terpisah dari status order meskipun data pengiriman awal dapat berada dalam sheet Pesanan. Order tidak boleh berubah menjadi dikirim tanpa informasi pengiriman yang diwajibkan sistem. Perubahan status harus mencegah transisi mundur yang tidak valid dan menyimpan timestamp/aktor perubahan.

---

## 9. Kontrak API React ↔ Apps Script

Nama di bawah adalah kontrak konseptual. Bentuk payload, tipe, dan nama fungsi final ditetapkan ketika backend service dibuat. Semua fungsi publik wajib melakukan validasi server-side.

### 9.1 Public API

| Operasi | Tujuan | Respons minimal |
|---|---|---|
| publicGetCatalog | Mengambil katalog/varian yang boleh ditampilkan | Katalog referensi + label harga referensi |
| publicGetConfig | Mengambil konfigurasi publik yang telah di-allow-list | Fee, teks kebijakan, CTA WhatsApp, event aktif jika dikonfigurasi |
| publicCreateRequest | Membuat request group dan item request | requestGroupId, kode referensi, access token satu kali, estimasi fee |
| customerGetPortal | Membaca status request/order milik token tersebut | Status yang aman, item, foto aktual yang boleh dilihat, ringkasan pembayaran yang diizinkan |
| customerApproveItems | Mencatat keputusan pelanggan atas foto aktual | Keputusan tersimpan dan status berikutnya |
| customerSubmitOrderDetails | Menyimpan nama, alamat, no HP dan detail final | Konfirmasi penerimaan data |
| customerConfirmShopee | Mencatat nama akun Shopee pelanggan | Status konfirmasi |

Public API tidak boleh menyediakan operasi untuk membaca seluruh pembeli, pembayaran, order, bukti transfer, Settings, atau data admin.

### 9.2 Admin API

| Operasi | Tujuan |
|---|---|
| adminLogin | Memverifikasi password admin dan memberi session token |
| adminLogout | Mengakhiri sesi |
| adminGetDashboard | Mengambil metrik operasional yang terhitung dari data |
| adminListCatalog / adminSaveCatalog | Mengelola katalog referensi |
| adminSaveVariant | Mengelola varian resmi/terverifikasi |
| adminListRequests | Meninjau request dan filter daftar buru |
| adminUpdateRequest | Menyimpan status pencarian/catatan admin |
| adminVerifyPayment | Verifikasi atau penolakan bukti pembayaran |
| adminAddUnit / adminUpdateUnit | Mencatat unit dan kondisi aktual |
| adminAssignUnit | Mengalokasikan unit ke request/item yang sesuai secara aman |
| adminCreateOrder | Membentuk order final setelah prasyarat terpenuhi |
| adminAddPayment | Mencatat transaksi pembayaran yang benar-benar terjadi |
| adminUpdateShipment | Menyimpan kurir, resi dan status kirim |
| adminAddExpense | Mencatat biaya operasional |
| adminGetReports | Mengambil rekap transaksi/operasional |
| adminUpdateSettings | Mengubah pengaturan non-rahasia yang diizinkan |

Tidak boleh ada API generik seperti readAnySheet(), updateAnyRow(), setStatusAnyValue(), atau fungsi yang menerima nama sheet dan nomor baris dari browser.

### 9.3 Bentuk respons

Gunakan pola respons yang konsisten, misalnya:

~~~json
{
  "ok": true,
  "data": {},
  "error": null,
  "requestId": "server-generated-id"
}
~~~

Pada kegagalan:

~~~json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Periksa kembali data yang dikirim."
  },
  "requestId": "server-generated-id"
}
~~~

Pesan internal, stack trace, spreadsheet ID, Drive ID sensitif, token hash, dan konfigurasi rahasia tidak boleh dikirim sebagai error ke browser.

---

## 10. Keamanan, privasi dan integritas data

### 10.1 Deployment dan otoritas script

Target awal adalah Apps Script Web App yang dieksekusi sebagai akun deployer agar akses Sheets/Drive dapat dikelola oleh akun pemilik aplikasi, sementara pelanggan tidak diminta memberikan otorisasi Google.

Karena aplikasi publik perlu dapat dibuka pelanggan, akses Web App dapat bersifat publik/anonymous sesuai opsi deployment yang tersedia. Artinya seluruh fungsi publik berpotensi dipanggil oleh pengunjung; pembatasan tidak boleh mengandalkan tombol yang disembunyikan di React.

Jangan menggunakan Session.getActiveUser().getEmail() sebagai satu-satunya identitas admin pada web app yang berjalan sebagai deployer. Dokumentasi Google menyatakan email active user dapat kosong dalam konteks tertentu, termasuk web app yang berjalan sebagai pemilik/deployer. Gunakan autentikasi aplikasi yang divalidasi server-side atau ubah deployment/auth model setelah uji izin yang nyata.

### 10.2 Autentikasi admin

- Password admin tidak boleh ditulis permanen di file .gs, .html, source React, GitHub, URL, maupun Script Properties dalam bentuk teks asli.
- Simpan salt/secret dan password hash di Script Properties; siapkan prosedur pengaturan awal yang tidak meninggalkan password sementara di source code.
- Buat token sesi acak berentropi tinggi di server; simpan validasi sesi di CacheService dengan expiry dan fail-closed jika cache hilang.
- Setiap fungsi admin memanggil helper requireAdmin_() dan memeriksa sesi di server.
- Tambahkan pembatasan percobaan login, jeda sementara, logout, expiry dan invalidasi sesi.
- Token admin tidak dikirim dalam query string dan tidak dicetak ke log.
- Jangan menyalin PIN demo 1126/nisa dari TSX.

CacheService hanya cache sementara, bukan database atau mekanisme audit permanen. Untuk audit login dan mutasi penting, simpan event log non-rahasia di sheet khusus atau log aktivitas yang ditentukan.

### 10.3 Token akses pelanggan

- Pelanggan tidak diwajibkan memiliki akun.
- Setelah request dibuat, server mengeluarkan token akses panjang/berentropi tinggi.
- Database hanya menyimpan hash token, bukan token plaintext.
- Token diberikan sekali kepada pelanggan dan dipakai untuk melihat request/order tertentu.
- Token tidak boleh diganti dengan kode order pendek + empat digit nomor telepon.
- Lookup token harus dibatasi pada request/order terkait; tidak boleh mengembalikan seluruh profil atau semua order pelanggan.
- Aksi token dibatasi sesuai kebutuhan: lihat status, menyetujui foto, mengirim format order, dan konfirmasi nama akun Shopee.
- Pertimbangkan expiry, rotasi/revoke dan rate limiting. Mekanisme pembatasan berbasis CacheService perlu diuji karena sifatnya sementara.

### 10.4 Perlindungan data pelanggan dan pembayaran

Data pribadi yang harus dibatasi:

- Nama, nomor WhatsApp, alamat lengkap dan kode pos.
- Nama akun Shopee.
- Bukti transfer dan detail transaksi.
- Foto/catatan unit yang terhubung ke order.
- Token akses pelanggan dan token admin.

Public API mengembalikan allow-list field saja. Jangan mengembalikan seluruh objek Settings atau seluruh row spreadsheet. Jangan menampilkan PII di URL, error log, analytics, atau source map.

### 10.5 Validasi dan operasi spreadsheet

- Validasi semua field di Apps Script: tipe, panjang, nominal positif, enum status, keterkaitan ID, dan konsistensi item/unit.
- Gunakan LockService untuk operasi read-modify-write yang dapat bersaing, terutama pembuatan ID, pencatatan pembayaran, konversi request ke order, alokasi unit dan mutasi status.
- Gunakan operasi batch getValues()/setValues() sejauh memungkinkan, bukan menulis sel satu per satu dalam loop panjang.
- Gunakan UUID/ID server yang stabil; jangan menggunakan nomor baris sebagai identifier.
- Simpan audit perubahan status/pembayaran dan jangan menimpa histori transaksi.
- Buat operasi penting idempotent agar retry dari browser tidak menggandakan request, pembayaran, unit, atau order.
- Batasi data yang dibaca; jangan memindai seluruh sheet berulang kali untuk setiap panggilan jika volume sudah meningkat.
- Terapkan backup Spreadsheet dan Drive secara rutin.

### 10.6 Upload dan render file

- Tolak file yang bukan tipe gambar yang diizinkan untuk foto unit dan format bukti pembayaran.
- Batasi ukuran dan kompres gambar di client sebelum upload.
- Server memvalidasi MIME, ukuran, tujuan folder, dan otorisasi.
- Simpan file di folder Drive yang aksesnya dibatasi.
- Jangan menyimpan public URL sebagai satu-satunya kontrol akses.
- Untuk preview customer, validasi token sebelum mengembalikan gambar/thumbnail.
- Untuk bukti pembayaran, hanya API admin yang boleh memberi akses.

### 10.7 Perlindungan dari input berbahaya

- Render data memakai React escaping normal; jangan menyusun HTML/inline handler dari string yang berasal dari pelanggan.
- Jangan menerima formula spreadsheet dari input publik.
- Normalisasi teks dan nomor telepon di server.
- Gunakan allow-list field untuk update, bukan menyalin object request langsung ke row sheet.
- Jangan mempercayai status, total, fee, user role, buyer ID, atau unit ID yang dikirim browser tanpa pemeriksaan ulang.

---

## 11. Peta UI dan pemetaan fitur dari TSX

TSX memberi referensi pengalaman pengguna yang perlu dipecah ke komponen React yang dapat diuji. Hindari mempertahankan App.tsx tunggal sekitar 2.970 baris sebagai bentuk akhir.

### 11.1 Front office pelanggan

| Area | Kemampuan |
|---|---|
| Landing / hero | Penjelasan jasa titip, event aktif yang dapat dikonfigurasi, CTA katalog/WhatsApp |
| Katalog | Kategori, pencarian, filter, detail model/varian, foto katalog, tautan sumber resmi |
| Cart / wishlist | Tambah produk/varian/jumlah, hapus item, fee preview dan catatan permintaan |
| Request confirmation | Nama/nomor kontak minimum, ringkasan request, kode dan token akses |
| Customer portal | Status request/order, item ditemukan/tidak, foto aktual, catatan kondisi, ringkasan pembayaran yang diizinkan |
| Format order | Nama, alamat, nomor HP dan daftar final setelah barang disetujui |
| Shopee | Tampilkan link checkout dari admin dan input nama akun Shopee setelah checkout |
| Tracking | Status proses, estimasi packing/proses 2–3 hari kerja, kurir dan resi |
| WhatsApp | Template instruksi pembayaran, konfirmasi foto, format order dan pengiriman |

### 11.2 Admin workspace

| Area | Kemampuan |
|---|---|
| Login | Admin-only gate yang diverifikasi server |
| Dashboard | Request aktif, pencarian, unit, order, pembayaran, saldo tersisa dan ringkasan keuangan |
| Katalog | Produk, varian, gambar katalog, harga referensi, sumber dan tanggal cek |
| Request / daftar buru | Filter status, grup model/varian, kebutuhan jumlah produk, pelanggan dan catatan |
| Unit aktual | Kode, foto aktual, kondisi, struk, harga beli, ketersediaan dan alokasi |
| Pesanan | Data customer, item final, fee, harga, status dan metode transaksi |
| Pembayaran | Bukti, verifikasi, deposit, pelunasan, pembayaran Shopee dan refund |
| Pengiriman | Packing, kurir, resi, status dan tanggal proses |
| Pembeli | Kontak, alamat, nama akun Shopee dan histori order dengan akses terbatas |
| Pengeluaran | Kategori biaya, nominal, tanggal, keterangan dan relasi order/event |
| Laporan | Kas terverifikasi, pembayaran Shopee terpisah, fee, HPP, biaya, laba sementara, piutang dan deposit belum dialokasikan |
| Pengaturan | Fee, rekening/instruksi pembayaran, WhatsApp, event aktif dan template pesan |

### 11.3 Temuan TSX dan keputusan implementasi GAS

- State katalog, order dan pengeluaran yang semula hardcoded telah diganti dengan API GAS pada entry khusus `src/gas`; jangan gunakan state mock TSX sebagai data produksi.
- Data order contoh mencakup nama, nomor HP, alamat dan bukti contoh; hapus semua fixture tersebut dari build produksi.
- Admin PIN demo 1126/nisa tidak disalin. GAS memakai password bootstrap dan token sesi yang diverifikasi server-side.
- Pencarian dengan order ID/nomor HP tidak disalin sebagai kontrol akses; portal memakai token acak dan hash token server-side.
- Dropdown status bebas diganti dengan service transition guard di Apps Script.
- Metrik laba simulasi tidak disalin. Workspace menampilkan ringkasan operasional dari ledger terverifikasi dan melabelinya bukan laporan laba bersih.
- Kontrak foto aktual dibangun ulang: upload admin ke Drive privat, preview pelanggan melalui token request, dan approval direset saat foto/kondisi berubah.
- Harga, tanggal, lokasi dan event di hero harus berasal dari pengaturan; bukan literal di komponen.
- Utility class Tailwind yang dipakai TSX harus diselaraskan dengan CSS/design system repository. Jangan menambah Tailwind tanpa keputusan tooling.
- Pecah menjadi page, feature, component, hooks, domain types, API adapter dan service; jangan menyalin seluruh monolit sebagai satu komponen.

---

## 12. Peta migrasi dari codebase Supabase saat ini

| Area saat ini di SOWAN | Target React + GAS | Tindakan |
|---|---|---|
| src/lib/supabase.ts | src/lib/gasClient.ts | Ganti client dan buat typed wrapper google.script.run |
| Supabase Auth + AdminGuard | GAS AuthService + token sesi admin | Implementasi ulang autentikasi dan otorisasi server-side |
| Supabase PostgreSQL tables | Google Sheets repositories | Migrasi model, ID stabil, validasi dan indeks sederhana |
| Supabase RPC functions | Apps Script service functions | Pindahkan fee, payment, order conversion, unit allocation dan shipment guards ke service server |
| Supabase Storage | DriveStorage.gs | Simpan fileId, metadata dan preview berdasarkan akses |
| VITE_SUPABASE_* | Script Properties / pengaturan GAS | Hapus env Supabase dari frontend setelah seluruh penggunaan dipindahkan |
| Vercel static hosting | Apps Script HTML Service | Build React sebagai single HTML dan deploy via clasp |
| supabase/migrations + seed | gas/setup & migration scripts | Pertahankan sementara sebagai histori; jangan dijalankan untuk target GAS |
| src/App.tsx | modular React features | Pertahankan UX, ganti semua sumber data dan aksi |
| docs/SUPABASE_SETUP.md | docs/GAS_SETUP.md | Ganti petunjuk setup, deployment dan izin |

### Urutan cutover

1. Bekukan baseline dan dokumentasikan commit SOWAN.
2. Konfirmasi apakah ada database Supabase aktif dan data produksi yang harus dipindah.
3. Buat backup/ekspor data yang benar-benar perlu dipertahankan.
4. Buat spreadsheet database dan Drive folder dev.
5. Bangun kontrak service GAS dan repository layer.
6. Bangun API adapter React dan local mock.
7. Migrasikan fitur satu per satu.
8. Jalankan test data/permission/workflow.
9. Uji pada deployment GAS staging dengan data uji.
10. Baru setelah acceptance terpenuhi, ubah entry point dan dokumentasi production.
11. Hapus dependency/schema Supabase hanya setelah cutover dan verifikasi selesai.

---

## 13. Roadmap implementasi

Urutan ini menyatukan fase di Brief v0.2.1 dengan kondisi codebase dan temuan dua prototype.

### Phase 0 — Data foundation dan keputusan operasional

**Tujuan:** memastikan spreadsheet dan aturan dasar stabil sebelum UI dipindahkan.

Deliverables:

- Spreadsheet database dengan header, ID, validasi data dan sheet master.
- Drive folder untuk foto aktual dan bukti pembayaran.
- Script Properties untuk Spreadsheet ID, Drive folder ID, secret dan password hash.
- Data catalog reference dari sumber resmi dengan tanggal pemeriksaan.
- Fee calculator dan unit test.
- Data dictionary dan status dictionary.
- Definisi ID dan hubungan Request → Unit → Item_Pesanan → Pesanan.
- Keputusan struktur pembayaran deposit yang terjadi sebelum order final.

Acceptance:

- Katalog/varian tidak tercampur dengan unit fisik.
- ID tidak bergantung pada nomor baris.
- Fee lulus test 1, 2, 3, 4 dan banyak unit.
- Sample data tidak dianggap data pelanggan nyata.
- Semua pertanyaan kebijakan bisnis tetap ditandai belum diputuskan.

### Phase 1 — Backend GAS dan back-office admin

**Tujuan:** membuat data operasional persisten dan service backend aman sebelum migrasi penuh UI pelanggan.

Deliverables:

- Apps Script project dan manifest.
- Spreadsheet repository (batch read/write).
- API facade publik/admin.
- Admin login, session token, rate limit dan logout.
- Admin CRUD Katalog/Varian, Request, Unit, Pembeli, Pesanan, Pembayaran dan Pengeluaran.
- Grouped daftar buru.
- Upload foto unit ke Drive.
- Record pembayaran dan verifikasi.
- Status transition guard.
- Dashboard dasar dari data tersimpan.

Acceptance:

- Semua operasi penting tervalidasi di server.
- Non-admin tidak dapat mengakses fungsi admin meskipun memanggil API secara manual.
- Public API tidak mengembalikan PII, seluruh data pembayaran, token hash atau konfigurasi rahasia.
- Mutasi tidak bergantung pada nomor baris.
- Concurrency test untuk ID, alokasi unit dan transaksi kritis selesai.

### Phase 1.5 — React shell di HTML Service

**Tujuan:** memindahkan frontend dari koneksi Supabase ke runtime GAS tanpa mengubah semua modul UI sekaligus.

Deliverables:

- Typed GAS bridge.
- Build Vite single-file.
- Hash routing yang cocok dengan HTML Service.
- Dev mock adapter.
- Migrasi halaman public dan admin shell.
- CI build output GAS.
- clasp configuration dan deployment staging.

Acceptance:

- Aplikasi React dapat dibuka dari Web App GAS.
- API call berhasil dan error tertangani.
- Tidak ada request browser langsung ke Supabase.
- Bundle tidak mengandung secret atau fixture customer.
- Preview lokal dan staging konsisten.

### Phase 1.6 — Admin workflow end-to-end

**Tujuan:** admin dapat menjalankan proses operasional dari satu dashboard.

Deliverables:

- Request queue dan daftar buru.
- Verifikasi deposit/bukti.
- Registrasi unit aktual dan foto kondisi.
- Alokasi unit.
- Pembuatan order final.
- Payment ledger.
- Pengiriman, kurir, resi.
- Pengeluaran dan dashboard.
- Audit log mutasi penting.

Acceptance:

- Request tidak otomatis dianggap order final.
- Deposit hanya dialokasikan satu kali.
- Unit tidak dapat dipakai dua order aktif.
- Order tidak dapat menjadi dikirim tanpa data shipment yang valid.
- Laporan membedakan kas masuk, pembayaran Shopee, deposit, sisa tagihan, HPP dan pengeluaran.

### Phase 2 — Customer front office

**Tujuan:** menghubungkan pelanggan ke workflow operasional tanpa akun website.

Deliverables:

- Katalog dan varian referensi.
- Cart/wishlist multi-item.
- Create request.
- Kode dan token akses pelanggan.
- Portal status request/order.
- Konfirmasi foto aktual.
- Form data order final.
- Shopee link dan konfirmasi username.
- WhatsApp templates/deep links.

Acceptance:

- Setiap pelanggan hanya dapat membaca request/order yang terkait token miliknya.
- Token tidak disimpan plaintext.
- Tidak ada pencarian hanya dengan empat digit telepon.
- Foto aktual ditampilkan melalui akses terkontrol.
- Data final hanya dapat disimpan pada status yang sesuai.

### Phase 2.5 — Keuangan dan laporan

**Tujuan:** laporan tidak sekadar total nominal, melainkan sesuai aliran uang nyata.

Deliverables:

- Rekap kas langsung terverifikasi.
- Rekap pembayaran Shopee terpisah.
- Deposit belum dialokasikan.
- Sisa tagihan order aktif.
- Fee jastip pada order yang valid.
- HPP unit yang terjual.
- Biaya operasional dan biaya platform.
- Laba bersih sementara dengan label yang tepat.
- Ekspor laporan.

Acceptance:

- Pembayaran yang menunggu verifikasi tidak dihitung sebagai kas terverifikasi.
- Pembayaran Shopee tidak dihitung ulang sebagai transfer.
- Refund dan penyesuaian punya record ledger.
- Laba tidak menganggap semua fee pada status order yang belum selesai sudah menjadi pendapatan terealisasi tanpa aturan akuntansi yang jelas.

### Phase 3 dan seterusnya — Di luar MVP saat ini

- Multi-jastiper/multi-tenant.
- Role dan pemisahan data tiap jastiper.
- Rekber/escrow.
- Payment gateway.
- WhatsApp API/chatbot otomatis.
- Integrasi otomatis Shopee atau kurir.

Fitur tersebut tidak boleh memperlambat rilis MVP operasional.

---

## 14. Keputusan bisnis yang masih terbuka

Sistem harus menyediakan pencatatan dan status untuk kondisi berikut tanpa menetapkan kebijakan otomatis.

| Keputusan | Status | Dampak implementasi |
|---|---|---|
| Nominal/proporsi deposit | Belum diputuskan | Jangan hard-code angka deposit |
| Waktu pelunasan | Belum diputuskan | Jangan paksa pelunasan di tahap tertentu tanpa kebijakan |
| Barang tidak tersedia setelah deposit | Belum diputuskan | Simpan status dan opsi tindak lanjut; jangan otomatis refund/carry-forward |
| Penolakan pelanggan atas foto aktual | Belum diputuskan | Butuh status menunggu keputusan pelanggan |
| Komplain salah barang/rusak/selisih kondisi | Belum diputuskan | Bedakan dari retur ke toko |
| Harga barang final | Belum diputuskan | Harga referensi katalog bukan otomatis harga tagihan |
| Komponen fee/ongkir pada checkout Shopee | Belum diputuskan | Pembayaran Shopee dicatat terpisah |
| Kurir dan formula ongkir | Belum diputuskan | Jangan mengunci provider/harga |
| Awal hitung estimasi 2–3 hari kerja | Belum diputuskan | Simpan timestamp dan tampilkan definisi setelah disetujui |
| Batas pembelian toko per transaksi | Perlu verifikasi ke toko | Tidak mengubah aturan tanpa batas dari JastipNisa |
| Harga paket event | Perlu verifikasi | Jangan jadikan seed price otomatis |

---

## 15. Quality gate dan pengujian

### 15.1 Business logic

- Fee 0, 1, 2, 3, 4, 5, 6 dan jumlah besar.
- Fee lintas beberapa model/varian.
- Jumlah produk dihitung dari unit, bukan model unik.
- Perubahan jumlah dan histori fee.
- Status request, unit, order, pembayaran dan shipment.
- Deposit request dipasangkan ke order tepat satu kali.
- Refund/penyesuaian tidak menghapus transaksi sebelumnya.

### 15.2 Security

- Public catalog hanya memuat field publik.
- Public caller tidak dapat membaca Sheet Pembeli, Pembayaran, Pengeluaran, atau data admin.
- Admin API menolak tanpa token sesi valid.
- Token sesi invalid/expired/cache-miss ditolak.
- Token pelanggan hanya mengakses request/order yang dipetakan.
- Tidak ada otorisasi berdasarkan tombol tersembunyi, query key, PIN demo, atau empat digit nomor telepon.
- Bukti pembayaran tidak dapat dilihat pelanggan lain.
- Foto aktual tidak dapat dibuka tanpa otorisasi yang sesuai.
- Semua endpoint memvalidasi input server-side.

### 15.3 Concurrency dan integritas

- Dua request serentak tidak membuat ID sama.
- Dua admin action tidak mengalokasikan satu unit ke dua order.
- Retry tidak mencatat pembayaran dua kali.
- Retry tidak mengubah order ke status yang tidak valid.
- Pembuatan order dan alokasi item menjaga relasi dan histori.
- Data Sheet tetap konsisten jika terjadi kegagalan di tengah proses multi-step.

### 15.4 UX dan regression

- Mobile/desktop responsive.
- Label, keyboard focus, error state dan empty state.
- Foto loading/fallback.
- WhatsApp CTA dengan pesan ter-encode.
- Tidak ada data demo di production build.
- Tidak ada event/location/date yang hard-coded.
- Browser console bersih pada alur utama.
- Manual test pelanggan dan admin dari awal sampai selesai.

### 15.5 Deployment

- Dev spreadsheet/Drive terpisah dari production.
- Script Properties dev dan production terpisah.
- Deployment GAS staging sebelum production.
- clasp push/deploy terdokumentasi dan dapat diulang.
- Backup Spreadsheet sebelum migrasi data.
- Checklist rollback dan catatan versi deployment tersedia.
- CI menjalankan typecheck, unit tests, production build dan pemeriksaan generated HTML.

---

## 16. Referensi teknis resmi

- Google Apps Script — HTML Service: Communicate with Server Functions  
  https://developers.google.com/apps-script/guides/html/communication
- Google Apps Script — google.script.run client-side API  
  https://developers.google.com/apps-script/guides/html/reference/run
- Google Apps Script — Web Apps deployment and execution identity  
  https://developers.google.com/apps-script/guides/web
- Google Apps Script — Session class and active-user email availability  
  https://developers.google.com/apps-script/reference/base/session

Catatan dokumentasi: google.script.run bersifat asinkron, memiliki callback success/failure, membatasi maksimal 10 panggilan paralel dan tidak menjamin urutan eksekusi. Fungsi server dengan akhiran underscore tidak dapat dipanggil dari google.script.run. Email active user dapat tidak tersedia untuk web app yang dijalankan sebagai deployer. Semua hal ini menjadi constraint desain, bukan detail opsional.

---

## 17. Status implementasi dan Definition of Done

### 17.1 Yang sudah tersedia di branch migrasi

Status source code pada branch \`architecture/react-google-apps-script\`:

- [x] Sheet schema: Settings, Catalog, Variants, Buyers, Request_Groups, Requests, Units, Orders, Order_Items, Payments, Shipments, Expenses, Events dan Audit_Log.
- [x] Setup function untuk membuat Spreadsheet, folder Drive privat, sheet/header dan Script Properties.
- [x] Repository Spreadsheet dengan ID stabil, batch read/write dasar, LockService dan audit log.
- [x] Bootstrap password admin, token sesi server, logout, dan customer access token yang disimpan sebagai hash.
- [x] API publik untuk katalog/config/request dan customer portal.
- [x] Request multi-item, token pelanggan, idempotency payload hash dan retry dengan key yang sama.
- [x] API admin katalog/varian, dashboard, daftar request, daftar unit, daftar order, pembayaran, shipment, pengeluaran dan ringkasan keuangan.
- [x] Foto aktual dan bukti pembayaran melalui Drive privat; pembacaan foto/bukti memerlukan token pelanggan atau sesi admin yang valid.
- [x] Workflow status request, approval foto, alokasi unit, create-order draft/recovery, payment ledger, shipment guard dan expense idempotency.
- [x] React GAS entry untuk katalog, cart/request, customer portal, approval foto, format order, Shopee dan workspace admin.
- [x] Workspace admin untuk catalog/variant CRUD, request/daftar buru, deposit + preview bukti + verifikasi, unit allocation, order, settlement/Shopee, shipment/resi, expenses dan ringkasan keuangan dasar.
- [x] Vite single-HTML build, clasp configuration example, deployment guide, validator HTML/manifest dan syntax check file \`.gs\`.
- [x] GitHub Actions pada beberapa head branch telah lulus dependency audit, typecheck, unit test, build standar, build GAS dan validator. Tetap gunakan status CI pada head PR terbaru sebagai release signal.

### 17.2 Belum selesai — wajib sebelum cutover

- [ ] Buat Apps Script project milik pemilik JastipNisa, isi \`.clasp.json\` lokal dengan Script ID, lalu lakukan \`clasp push\`.
- [ ] Jalankan \`setupJastipNisa_\` pada akun Google staging dan verifikasi Spreadsheet/Drive folder serta izin yang dihasilkan.
- [ ] Bootstrap password admin pada Script Properties. Jangan memasukkan password/secret ke GitHub.
- [ ] Deploy Web App staging, uji dengan data fiktif, dan pastikan deployment identity/access sesuai manifest.
- [ ] Uji permission runtime pada user anonim, admin valid, sesi expired/cache miss, dan token pelanggan invalid/expired.
- [ ] Jalankan end-to-end journey pelanggan dan admin pada Apps Script runtime nyata: request → deposit → pencarian → foto → approval → format order → order → settlement/Shopee → shipment.
- [ ] Jalankan failure-injection/retry test di setiap langkah multi-sheet, termasuk putus eksekusi saat order, payment dan reservation. Recovery pointer mengurangi duplikasi tetapi tidak membuat Google Sheets menjadi database transaksional.
- [ ] Verifikasi upload/download preview Drive, tipe MIME, ukuran, batas respons, folder sharing dan akses file.
- [ ] Uji performa/kuota dengan ukuran data yang mendekati pola operasional.
- [ ] Tambahkan backup/restore drill serta rekonsiliasi bila operasi multi-sheet terputus.
- [ ] Pastikan tidak ada data Supabase produksi yang perlu diekspor sebelum schema/dependency lama dihapus.
- [ ] Migrasikan default app/entry SOWAN sepenuhnya dari Supabase ke GAS setelah acceptance; jangan menghapus source lama sebelum cutover aman.
- [ ] Lengkapi fitur laporan/export dan event settings jika dibutuhkan untuk MVP final.
- [ ] Putuskan kebijakan bisnis yang masih terbuka sebelum otomatisasi kondisi terkait.
- [ ] Uji pada staging, review PR, lalu merge/cutover secara terpisah.

### 17.3 Definition of Done

Migrasi arsitektur dianggap selesai hanya bila semua kriteria berikut terpenuhi:

- [ ] React build benar-benar disajikan dari Web App Apps Script yang dikonfigurasi pemilik.
- [ ] Alur produksi tidak lagi bergantung pada Supabase.
- [ ] Data operasional tersimpan di Google Sheets yang dimiliki dan dibackup pemilik.
- [ ] Foto aktual dan bukti pembayaran memakai Drive privat dengan akses yang diuji.
- [ ] Admin auth dan customer access token teruji di runtime Apps Script.
- [ ] Fee, status, pembayaran dan alokasi unit diverifikasi server-side.
- [ ] Retry/failure recovery lolos test di Apps Script runtime.
- [ ] Alur pelanggan/admin lolos end-to-end test.
- [ ] Ringkasan keuangan cocok dengan ledger, refund, HPP dan pengeluaran.
- [ ] Staging GAS lulus sebelum production.
- [ ] Data Supabase yang diperlukan diekspor/dicadangkan atau pemilik menyatakan tidak ada yang perlu dipindah.
- [ ] Dokumentasi setup, deployment, backup dan rollback diperbarui.

**Status saat dokumen dibuat:** source foundation dan UI React GAS sudah ditambahkan pada branch migrasi dan CI build/syntax checks pernah lulus. Apps Script project, Spreadsheet, Drive folder, otorisasi Google dan deployment staging/production belum dibuat dari repository. Branch SOWAN masih menjadi baseline Supabase sampai PR migrasi ditinjau dan cutover dilakukan.
