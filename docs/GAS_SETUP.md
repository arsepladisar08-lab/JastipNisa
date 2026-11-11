# Setup & Deployment — React + Google Apps Script

Panduan ini menyiapkan development/staging milik pemilik proyek. Credential Google, Script ID, Spreadsheet ID, dan deployment URL tidak disimpan di repository.

## 1. Prasyarat

- Node.js 22 LTS.
- Akun Google pemilik Apps Script, Spreadsheet, dan folder Drive.
- Git clone repository.
- Akses Apps Script API diaktifkan melalui https://script.google.com/home/usersettings.

Install clasp sebagai CLI global, terpisah dari dependency aplikasi:

~~~bash
npm install -g @google/clasp@3.4.1
clasp --version
clasp login
~~~

Versi CLI tidak dimasukkan sebagai dependency aplikasi karena dependency transitive versi yang diuji memunculkan advisory keamanan tingkat tinggi pada npm audit.

## 2. Buat Apps Script project

1. Buka https://script.google.com dan buat project standalone baru bernama JastipNisa.
2. Pada Project Settings, tampilkan file appsscript.json manifest bila belum tampil.
3. Salin Script ID dari Project Settings.
4. Di root repository, salin .clasp.json.example menjadi .clasp.json.
5. Isi scriptId dengan Script ID milikmu. Jangan commit .clasp.json; file itu sudah di-ignore Git.
6. Pertahankan rootDir bernilai gas.

Contoh konfigurasi lokal:

~~~json
{
  "scriptId": "SCRIPT_ID_MILIK_SENDIRI",
  "rootDir": "gas"
}
~~~

## 3. Build dan validasi lokal

~~~bash
npm install
npm run typecheck
npm test
npm run build
npm run build:gas
npm run gas:validate
~~~

Perintah build:gas membuat gas/Index.html dari entry khusus index.gas.html. File hasil build di-ignore Git. Perintah gas:validate memeriksa manifest, file server wajib, serta tidak adanya script dan stylesheet eksternal.

Jangan push jika build atau validasi gagal.

## 4. Setup Spreadsheet dan Drive

1. Jalankan npm run gas:push untuk mengunggah source .gs, manifest, dan HTML hasil build ke Apps Script.
2. Buka project dengan clasp open-script.
3. Pilih fungsi setupJastipNisa_ di editor Apps Script lalu klik Run.
4. Setujui izin Google Sheets dan Google Drive yang diminta.
5. Buka Execution log untuk melihat hasil setup. Fungsi membuat:
   - Spreadsheet JastipNisa Database.
   - Folder Drive JastipNisa Private Files.
   - Subfolder Foto Unit Aktual dan Bukti Pembayaran.
   - Sheet dan header database sesuai gas/Schema.gs.
   - Script Properties berisi ID database/folder dan pepper keamanan.
6. Jangan mengubah sharing folder Drive menjadi Anyone with the link. Bukti pembayaran dan foto operasional tetap privat.

Fungsi setup idempotent terhadap sheet/folder yang sudah direkam dalam Script Properties. Jangan mengganti Spreadsheet ID tanpa backup dan pemeriksaan relasi.

## 5. Bootstrap password admin

Setelah setupJastipNisa_ berhasil:

1. Apps Script → Project Settings → Script Properties.
2. Tambahkan JN_INITIAL_ADMIN_PASSWORD dengan passphrase unik minimal 16 karakter.
3. Jangan gunakan password contoh, PIN pendek, atau password yang dipakai akun lain.
4. Kembali ke editor, pilih bootstrapAdminPassword_, lalu klik Run.
5. Fungsi menghasilkan salt + HMAC SHA-256 hash dan menghapus property password awal.
6. Simpan passphrase di password manager. Jangan menuliskannya di README, source, issue, atau log.

Sesi admin berada di CacheService selama 30 menit dan dapat berakhir lebih cepat bila cache dihapus. Jika cache hilang, login kembali. Setelah delapan percobaan gagal dari browser key yang sama, login dari browser tersebut ditahan 15 menit. Ini best-effort friction, bukan perlindungan brute-force tingkat jaringan: Apps Script Web App publik tidak memberikan client IP tepercaya ke aplikasi ini, sehingga deployment publik tetap perlu dipantau dan kredensial admin harus unik serta kuat.

## 6. Isi katalog awal

Sheet Catalog dan Variants dibuat kosong. Ini disengaja: harga/ketersediaan snapshot lama tidak boleh diperlakukan sebagai harga atau stok terkini.

Workspace admin pada entry React GAS menyediakan pengelolaan Catalog dan Variants. Masukkan model setelah memeriksa sumber resmi; simpan URL resmi, harga referensi, tanggal pemeriksaan, dan status aktif. Jangan memasukkan stok fisik ke Catalog; unit aktual dicatat di sheet Units. Seed produk sengaja tidak disertakan karena snapshot lama belum tentu merupakan referensi harga/varian terkini.

## 7. Deployment Web App

Untuk staging pertama, deploy melalui Apps Script UI agar identitas eksekusi dan akses diperiksa eksplisit:

1. Deploy → New deployment → Select type → Web app.
2. Execute as: Me (akun pemilik project).
3. Who has access: Anyone / anonymous bila halaman katalog memang harus publik tanpa login Google.
4. Periksa ringkasan izin sebelum deploy.
5. Deploy dan salin URL /exec.
6. Buka URL di jendela incognito. Katalog publik hanya boleh mengembalikan field allow-list.
7. Coba /admin dan pastikan API admin menolak akses tanpa login.
8. Gunakan data fiktif saja selama pengujian staging.

Manifest mendeklarasikan USER_DEPLOYING dan ANYONE_ANONYMOUS. Pilihan deployment UI tetap harus diperiksa. Akses publik berarti setiap fungsi API yang diekspos dapat dipanggil pengunjung anonim; fungsi admin wajib memvalidasi session token di server. Menyembunyikan halaman admin bukan kontrol akses.

Aplikasi belum siap menerima data pelanggan nyata sampai test matriks akses, upload file, request→unit→order, pembayaran, dan pengiriman lulus pada deployment staging.

## 8. Update dan deployment versi

Setiap perubahan source:

~~~bash
npm run build:gas
npm run gas:validate
npm run gas:push
~~~

Untuk membuat deployment version baru:

~~~bash
npm run gas:deploy
~~~

Periksa Deploy → Manage deployments pada Apps Script untuk memastikan versi aktif yang dipakai. Jangan edit gas/Index.html secara manual; edit React source lalu build ulang.

## 9. Data, backup, dan rollback

- Gunakan Spreadsheet dan folder Drive development/staging terpisah dari production.
- Buat backup Spreadsheet dan folder Drive sebelum migrasi/import besar.
- Jangan menimpa header/kolom atau mengubah ID stabil secara manual.
- Simpan commit/versi yang diketahui baik.
- Jika deployment baru bermasalah, arahkan deployment kembali ke versi sebelumnya melalui Apps Script Manage deployments.
- Export data Supabase lama sebelum menghapus project/schema jika ternyata ada data riil di sana.

## 10. Batasan yang diketahui

- Google Sheets bukan database transaksional. LockService mencegah mutasi bersamaan pada script, tetapi tidak menyediakan rollback multi-sheet jika satu operasi gagal di tengah proses. Order, pembayaran, dan alokasi unit tetap memerlukan jurnal pemulihan dan rekonsiliasi sebelum dipakai untuk transaksi nyata.
- Apps Script memiliki kuota/limit eksekusi yang dapat berubah. Periksa halaman quotas sebelum memperbesar volume.
- google.script.run asinkron dan maksimal 10 panggilan aktif bersamaan. Frontend harus membatasi paralelisme dan tidak bergantung pada urutan request.
- Web App yang dijalankan sebagai pemilik tidak boleh mengandalkan email ActiveUser sebagai identitas admin. Aplikasi menggunakan login password dan token sesi.
- Data pelanggan sensitif. Batasi akses Spreadsheet dan Drive hanya kepada pengelola yang membutuhkan akses.

## 11. Status deployment

Source foundation dan panduan disediakan di branch migrasi. Tidak ada Apps Script project, Spreadsheet, Drive folder, atau deployment Google yang dibuat otomatis oleh GitHub. Pemilik proyek harus membuat dan mengotorisasi resource pada akun Google tujuan.
