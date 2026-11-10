import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Box, Check,
  ChevronDown, CircleHelp, Clock3, LayoutDashboard, LockKeyhole,
  Menu, PackageCheck, Search, ShieldCheck, ShoppingBag, Sparkles, Truck,
  Wallet, X, Plus, Trash2,
} from 'lucide-react'
import { initialCatalog, mapCatalogRow, OFFICIAL_CATALOG_URL, type CatalogProduct } from './data/catalog'
import { calculateJastipFee, formatRupiah } from './lib/fees'
import { buildWhatsAppUrl, isSupabaseConfigured, supabase } from './lib/supabase'

function PublicHeader() {
  const [open, setOpen] = useState(false)
  const links = [
    { to: '/', label: 'Beranda', end: true },
    { to: '/katalog', label: 'Katalog' },
    { to: '/cara-kerja', label: 'Cara Kerja' },
    { to: '/kebijakan', label: 'Kebijakan' },
  ]
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand" aria-label="JastipNisa beranda">
          <span className="brand-mark"><ShoppingBag size={18} /></span>
          <span>jastip<span className="brand-script">nisa.</span></span>
        </Link>
        <button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Tutup menu' : 'Buka menu'}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Navigasi utama">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {link.label}
            </NavLink>
          ))}
          <a href={buildWhatsAppUrl('Halo Admin JastipNisa, saya ingin bertanya tentang jastip Flicka.') || '#kontak'} className="button button-dark nav-cta" onClick={() => setOpen(false)}>
            Tanya Admin <ArrowUpRight size={15} />
          </a>
        </nav>
      </div>
    </header>
  )
}

function PublicFooter() {
  return (
    <footer className="site-footer" id="kontak">
      <div className="container footer-main">
        <div>
          <Link to="/" className="brand footer-brand"><span className="brand-mark"><ShoppingBag size={17} /></span><span>jastip<span className="brand-script">nisa.</span></span></Link>
          <p className="footer-note">Titip cari, cek dulu, baru kamu putuskan.</p>
        </div>
        <div className="footer-links">
          <Link to="/katalog">Katalog Flicka</Link>
          <Link to="/cara-kerja">Cara Kerja</Link>
          <Link to="/kebijakan">Kebijakan</Link>
        </div>
        <div className="footer-disclaimer">JastipNisa adalah layanan jasa titip independen dan bukan toko resmi maupun mitra resmi Flicka.</div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} JastipNisa</span><span>Dibuat dengan perhatian untuk setiap pesanan.</span></div>
    </footer>
  )
}

function PublicLayout({ children }: { children: ReactNode }) {
  return <><PublicHeader /><main>{children}</main><PublicFooter /></>
}

function WhatsAppButton({ message, label = 'Mulai Pesanan' }: { message: string; label?: string }) {
  const url = buildWhatsAppUrl(message)
  if (!url) return <a className="button button-dark" href="#kontak" title="Nomor WhatsApp admin belum dikonfigurasi">{label} <ArrowUpRight size={16} /></a>
  return <a className="button button-dark" href={url} target="_blank" rel="noreferrer">{label} <ArrowUpRight size={16} /></a>
}

function ProductVisual({ product, large = false }: { product: CatalogProduct; large?: boolean }) {
  if (product.imageUrl) return <div className={large ? 'product-visual product-visual-large' : 'product-visual'}><img src={product.imageUrl} alt={product.name} loading="lazy" /></div>
  return (
    <div className={large ? 'product-visual product-visual-large product-placeholder' : 'product-visual product-placeholder'}>
      <span className="placeholder-orbit orbit-one" /><span className="placeholder-orbit orbit-two" />
      <span className="product-monogram">{product.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</span>
      <span className="placeholder-caption">FLICKA · {product.category.toUpperCase()}</span>
    </div>
  )
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const requestUrl = buildWhatsAppUrl(
    "Halo Admin JastipNisa, saya ingin request model " + product.name +
    ". Mohon bantu cek ketersediaan dan kirim foto unit aktual jika ditemukan. Saya akan sertakan bukti deposit/transfer di chat ini."
  )
  return (
    <article className="product-card">
      <a href={product.officialUrl} target="_blank" rel="noreferrer" className="product-link" aria-label={"Lihat " + product.name + " di katalog resmi Flicka"}>
        <ProductVisual product={product} />
        <span className="availability-tag"><span /> Perlu konfirmasi admin</span>
        <div className="product-info">
          <div><span className="eyebrow">{product.category}</span><h3>{product.name}</h3></div>
          <div className="product-price">{formatRupiah(product.officialPrice)}<small>Harga referensi</small></div>
        </div>
        <span className="product-arrow"><ArrowUpRight size={17} /></span>
      </a>
      {requestUrl
        ? <a className="product-request-link" href={requestUrl} target="_blank" rel="noreferrer">Request model ini <ArrowUpRight size={14} /></a>
        : <span className="product-request-hint">Nomor admin belum dikonfigurasi</span>}
    </article>
  )
}

function useCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>(initialCatalog)
  const [loading, setLoading] = useState(Boolean(supabase))
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setLoading(false); return }
      const { data, error } = await supabase
        .from('catalog_products')
        .select('id,name,slug,category,official_price,official_product_url,image_url,source_checked_at,is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (active && !error && data) setProducts(data.map(mapCatalogRow))
      if (active) setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])
  return { products, loading }
}

function SectionHeading({ kicker, title, copy, align = 'left' }: { kicker: string; title: string; copy?: string; align?: 'left' | 'center' }) {
  return <div className={`section-heading ${align === 'center' ? 'text-center' : ''}`}><span className="eyebrow">{kicker}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>
}

function HomePage() {
  const { products } = useCatalog()
  const [count, setCount] = useState(2)
  const fee = calculateJastipFee(count)
  const featured = products.slice(0, 4)
  return (
    <PublicLayout>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-kicker"><Sparkles size={14} /> YOUR PERSONAL SHOPPING HELPER</span>
            <h1>Tas yang kamu suka, <em>kami bantu carikan.</em></h1>
            <p className="hero-description">Temukan model Flicka dari katalog resmi. Admin bantu cek langsung ke toko, kirim foto unit aktual, lalu kamu putuskan pesananmu.</p>
            <div className="hero-actions"><Link to="/katalog" className="button button-dark">Jelajahi Katalog <ArrowRight size={16} /></Link><Link to="/cara-kerja" className="button button-light">Lihat cara kerja</Link></div>
            <div className="hero-trust"><span><BadgeCheck size={16} /> Foto aktual sebelum final order</span><span><ShieldCheck size={16} /> Alur jelas & personal</span></div>
          </div>
          <div className="hero-art">
            <div className="hero-art-label"><span>CURATED FINDS</span><span>01 / 12</span></div>
            <div className="hero-image-card">
              <img src="https://d2kchovjbwl1tk.cloudfront.net/vendor/185/product/Panjang_30_cm_1748077987873_resized128-png.webp" alt="Flicka Asha Bag berwarna hitam dari katalog resmi" />
              <div className="hero-image-caption"><span>THE FLICKA EDIT</span><strong>A little find, a lovely story.</strong></div>
            </div>
            <div className="hero-sticker"><span>made for</span><strong>your<br />everyday.</strong><Sparkles size={16} /></div>
            <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
          </div>
        </div>
        <div className="container hero-bottom"><span>INDEPENDENT PERSONAL SHOPPING SERVICE</span><span>SCROLL TO DISCOVER <ArrowDown size={13} /></span></div>
      </section>

      <section className="intro-strip"><div className="container intro-grid"><div className="intro-mark">N.</div><p><strong>JastipNisa</strong> menghubungkan wishlist kamu dengan proses pencarian langsung oleh admin. Katalog jadi referensi awal — <em>ketersediaan selalu dikonfirmasi secara aktual.</em></p><span className="intro-side">BROWSE · REQUEST · CONFIRM</span></div></section>

      <section className="section section-catalog">
        <div className="container">
          <div className="section-topline"><SectionHeading kicker="THE FLICKA CATALOG" title="Mulai dari model favoritmu." copy="Pilih model dari katalog resmi Flicka. Admin akan bantu cek ketersediaan dan mengirim foto aktual bila barang ditemukan." /><Link to="/katalog" className="text-link">Lihat semua produk <ArrowUpRight size={16} /></Link></div>
          <div className="product-grid">{featured.map(product => <ProductCard key={product.slug} product={product} />)}</div>
          <div className="catalog-footnote"><span className="dot" /> Katalog resmi sebagai referensi. Bukan informasi stok JastipNisa.</div>
        </div>
      </section>

      <section className="section process-section">
        <div className="container">
          <SectionHeading kicker="SIMPLE & PERSONAL" title="Enam langkah, satu pesanan yang jelas." copy="Kamu tahu apa yang perlu dilakukan di setiap tahap. Admin akan mengabari saat ada perkembangan." />
          <div className="process-grid">
            {[
              ['01', 'Deposit / payment', 'Mulai dengan deposit atau pembayaran sesuai instruksi admin.'],
              ['02', 'Kirim bukti & wishlist', 'Chat admin, sertakan bukti transfer dan model/warna yang kamu cari.'],
              ['03', 'Admin cek & foto', 'Admin mencari barang. Jika tersedia, foto unit aktual dikirim untuk kamu lihat.'],
              ['04', 'Konfirmasi data order', 'Kirim nama, alamat, nomor HP dan daftar pesanan final.'],
              ['05', 'Packing & pengiriman', 'Admin packing dan memproses pengiriman dalam estimasi 2–3 hari kerja.'],
              ['06', 'Opsi checkout Shopee', 'Bila menggunakan Shopee, checkout dari link admin lalu konfirmasi nama akun Shopee.'],
            ].map(([number, title, body]) => <div className="process-step" key={number}><span className="step-number">{number}</span><div><h3>{title}</h3><p>{body}</p></div><ArrowUpRight className="step-arrow" size={17} /></div>)}
          </div>
          <div className="process-cta"><span>Masih ada yang ingin ditanyakan?</span><WhatsAppButton message="Halo Admin JastipNisa, saya ingin bertanya tentang alur pemesanan." label="Chat Admin" /></div>
        </div>
      </section>

      <section className="section fee-section">
        <div className="container fee-layout">
          <div><span className="eyebrow">TRANSPARENT SERVICE FEE</span><h2>Fee jastip yang<br /><em>mudah dihitung.</em></h2><p>Semakin banyak produk dalam satu pesanan, fee bertambah sesuai rumus yang sudah ditentukan.</p><div className="fee-note"><Check size={16} /> Tidak ada batas jumlah pembelian per orang dari JastipNisa.</div></div>
          <div className="fee-calculator">
            <div className="calculator-top"><span>HITUNG FEE PESANAN</span><span className="calculator-live"><span /> LIVE CALCULATION</span></div>
            <label htmlFor="product-count">Jumlah produk dalam satu order</label>
            <div className="quantity-control"><button onClick={() => setCount(Math.max(1, count - 1))} aria-label="Kurangi jumlah produk">−</button><input id="product-count" type="number" min="1" max="99" value={count} onChange={event => setCount(Math.min(99, Math.max(1, Number(event.target.value) || 1)))} /><button onClick={() => setCount(Math.min(99, count + 1))} aria-label="Tambah jumlah produk">+</button><span>produk</span></div>
            <div className="fee-result"><span>Fee jastip</span><strong>{formatRupiah(fee)}</strong></div>
            <p className="calculator-footnote">Belum termasuk harga produk dan ongkos kirim. Fee dihitung per pesanan, bukan per orang.</p>
            <div className="fee-breakdown">{count === 1 ? '1 produk = Rp15.000' : count === 2 ? '2 produk = Rp25.000' : `Rp25.000 + (${count - 2} × Rp10.000)`}</div>
          </div>
        </div>
      </section>

      <section className="section closing-section"><div className="container closing-card"><div><span className="eyebrow">LET'S FIND YOUR NEXT FAVORITE</span><h2>Wishlist kamu dimulai<br />dari satu chat.</h2><p>Kirim model yang kamu inginkan. Admin bantu cek dan kabari dengan foto aktual bila tersedia.</p></div><WhatsAppButton message="Halo Admin JastipNisa, saya ingin mulai order. Boleh dibantu?" label="Mulai Chat Admin" /></div></section>
    </PublicLayout>
  )
}

function CatalogPage() {
  const { products, loading } = useCatalog()
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => products.filter(item => item.name.toLowerCase().includes(search.toLowerCase())), [products, search])
  return (
    <PublicLayout>
      <section className="page-hero"><div className="container"><span className="eyebrow">OFFICIAL FLICKA REFERENCE</span><h1>Temukan model<br /><em>yang kamu cari.</em></h1><p>Daftar model di bawah bersumber dari katalog resmi Flicka. Pilihan warna, harga, dan ketersediaan perlu dikonfirmasi kembali kepada admin.</p><a href={OFFICIAL_CATALOG_URL} target="_blank" rel="noreferrer" className="text-link">Buka katalog Flicka <ArrowUpRight size={16} /></a></div></section>
      <section className="section catalog-page-section"><div className="container"><div className="catalog-toolbar"><span>{filtered.length} model referensi</span><label className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama model..." aria-label="Cari produk" />{search && <button onClick={() => setSearch('')} aria-label="Hapus pencarian"><X size={15} /></button>}</label></div>{loading && <p className="inline-note">Memuat pembaruan katalog…</p>}{filtered.length ? <div className="product-grid product-grid-full">{filtered.map(product => <ProductCard key={product.slug} product={product} />)}</div> : <div className="empty-state"><Search size={24} /><strong>Model tidak ditemukan</strong><span>Coba kata kunci lain.</span></div>}<p className="catalog-source-note">Sumber: <a href={OFFICIAL_CATALOG_URL} target="_blank" rel="noreferrer">flickabags.com/products</a>. Harga yang ditampilkan adalah snapshot referensi katalog, bukan penawaran final JastipNisa. Ketersediaan unit hanya dapat dipastikan setelah admin melakukan pengecekan.</p></div></section>
    </PublicLayout>
  )
}

function ProcessPage() {
  const steps = [
    ['Deposit / payment', 'Lakukan deposit atau pembayaran awal sesuai nominal dan instruksi yang diberikan admin.'],
    ['Kirim bukti transfer dan wishlist', 'Chat admin melalui WhatsApp, lampirkan bukti transfer, nama model, serta pilihan warna atau detail barang yang diinginkan.'],
    ['Admin cari dan foto barang', 'Admin melakukan pencarian langsung. Jika barang ditemukan, admin akan mengirim foto unit aktual agar kamu dapat melihat barang yang tersedia.'],
    ['Kirim format order final', 'Setelah barang dikonfirmasi, kirim nama lengkap, alamat pengiriman, nomor HP, dan daftar order yang sudah disepakati.'],
    ['Packing dan pengiriman', 'Admin menyiapkan paket dan memproses pengiriman dengan estimasi 2–3 hari kerja.'],
  ]
  return <PublicLayout><section className="page-hero"><div className="container"><span className="eyebrow">HOW IT WORKS</span><h1>Alurnya jelas,<br /><em>pesanan lebih tenang.</em></h1><p>Ikuti tahapan berikut agar admin dapat membantu proses jastip dengan rapi.</p></div></section><section className="section"><div className="container process-detail">{steps.map(([title, body], i) => <div className="process-detail-row" key={title}><span className="detail-index">0{i + 1}</span><div><h2>{title}</h2><p>{body}</p></div></div>)}<div className="shopee-callout"><div className="shopee-icon">S</div><div><span className="eyebrow">ALTERNATIVE CHECKOUT</span><h2>Checkout melalui Shopee?</h2><p>Apabila pesanan diproses melalui Shopee, admin akan mengirimkan link checkout. Setelah berhasil checkout, kamu <strong>wajib mengonfirmasi nama akun Shopee</strong> kepada admin agar pesanan mudah dicocokkan.</p></div></div><div className="order-format"><span className="eyebrow">FORMAT DATA ORDER</span><h2>Siapkan data berikut.</h2><div className="format-chips"><span>Nama lengkap</span><span>Alamat lengkap</span><span>Nomor HP</span><span>Daftar order</span></div></div><WhatsAppButton message="Halo Admin JastipNisa, saya ingin bertanya tentang cara order." label="Tanya Admin" /></div></section></PublicLayout>
}

function PolicyPage() {
  return <PublicLayout><section className="page-hero"><div className="container"><span className="eyebrow">PLEASE READ BEFORE ORDERING</span><h1>Informasi penting<br /><em>sebelum titip.</em></h1><p>Mohon pahami poin-poin berikut sebelum melakukan deposit atau konfirmasi pesanan.</p></div></section><section className="section"><div className="container policy-list">
    <article><span>01</span><div><h2>Katalog adalah referensi</h2><p>Produk yang ditampilkan mengacu pada katalog resmi Flicka. Foto dan daftar model dari katalog tidak menjamin stok tersedia di toko atau di tangan admin JastipNisa.</p></div></article>
    <article><span>02</span><div><h2>Ketersediaan dikonfirmasi admin</h2><p>Admin akan mencari barang yang diminta. Jika ditemukan, admin mengirim foto unit aktual. Pastikan model, warna dan kondisi yang terlihat sudah sesuai sebelum data order final dikirim.</p></div></article>
    <article><span>03</span><div><h2>Fee jastip per order</h2><p>1 produk Rp15.000; 2 produk Rp25.000; 3 produk dan seterusnya Rp25.000 ditambah Rp10.000 untuk setiap produk setelah produk kedua. Tidak ada batas jumlah pembelian per orang dari JastipNisa.</p></div></article>
    <article><span>04</span><div><h2>Produk tidak dapat diretur ke toko</h2><p>Produk yang dibeli melalui jastip tidak dapat dikembalikan ke toko. Periksa foto aktual dan detail yang disampaikan admin sebelum mengonfirmasi order. Hubungi admin untuk menyepakati penanganan bila ada kendala pada barang atau pengiriman.</p></div></article>
    <article><span>05</span><div><h2>Estimasi proses pengiriman</h2><p>Setelah detail order dikonfirmasi, admin melakukan packing dan memproses pengiriman dengan estimasi 2–3 hari kerja. Estimasi ini adalah waktu proses admin, bukan jaminan waktu tiba kurir.</p></div></article>
    <article><span>06</span><div><h2>Checkout melalui Shopee</h2><p>Admin akan memberikan link checkout apabila jalur Shopee digunakan. Setelah checkout, pelanggan wajib mengonfirmasi nama akun Shopee kepada admin.</p></div></article>
    <div className="policy-warning"><ShieldCheck size={19} /><p>JastipNisa merupakan layanan jasa titip independen dan tidak mengklaim sebagai toko resmi, reseller resmi, atau mitra resmi Flicka.</p></div>
    <WhatsAppButton message="Halo Admin JastipNisa, saya sudah membaca kebijakan dan ingin bertanya lebih lanjut." label="Konfirmasi ke Admin" />
  </div></section></PublicLayout>
}

function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!supabase) { setError('Supabase belum dikonfigurasi. Isi environment variable terlebih dahulu.'); return }
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) { setError('Login gagal. Periksa email dan password admin.'); return }
    navigate('/admin')
  }
  return <div className="admin-login-screen"><div className="login-aside"><Link to="/" className="brand"><span className="brand-mark"><ShoppingBag size={18} /></span><span>jastip<span className="brand-script">nisa.</span></span></Link><div><span className="eyebrow">PRIVATE WORKSPACE</span><h1>Everything in<br /><em>one place.</em></h1><p>Ruang kerja admin untuk menjaga setiap request, unit dan pesanan tetap tertata.</p></div><span className="login-bottom">JASTIPNISA · ADMIN ACCESS</span></div><div className="login-form-side"><div className="login-form-wrap"><span className="login-lock"><LockKeyhole size={20} /></span><span className="eyebrow">ADMIN SIGN IN</span><h2>Selamat datang kembali.</h2><p>Masuk menggunakan akun admin yang sudah diaktifkan.</p><form onSubmit={handleSubmit} className="stack-form"><label>Email admin<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@email.com" /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Masukkan password" /></label>{error && <div className="form-alert">{error}</div>}<button className="button button-dark button-full" disabled={loading || !isSupabaseConfigured}>{loading ? 'Memeriksa akses…' : 'Masuk ke Dashboard'} <ArrowRight size={16} /></button></form>{!isSupabaseConfigured && <p className="setup-hint">Setup diperlukan: salin <code>.env.example</code> menjadi <code>.env.local</code>, isi kredensial Supabase, lalu buat akun admin melalui Supabase Auth.</p>}<Link to="/" className="back-link">← Kembali ke halaman publik</Link></div></div></div>
}

function AdminGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading')
  useEffect(() => {
    let alive = true
    if (!supabase) { setState('denied'); return }
    const verify = async () => {
      const { data: sessionData } = await supabase!.auth.getSession()
      const session = sessionData.session
      if (!session) { if (alive) setState('denied'); return }
      const { data: profile, error } = await supabase!.from('profiles').select('role,is_active').eq('id', session.user.id).maybeSingle()
      if (error || profile?.role !== 'admin' || profile?.is_active !== true) {
        await supabase!.auth.signOut()
        if (alive) setState('denied')
        return
      }
      if (alive) setState('allowed')
    }
    void verify()
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void verify() })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])
  if (state === 'loading') return <div className="admin-loading"><span className="spinner" /> Memeriksa akses admin…</div>
  if (state === 'denied') return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

type AdminTab = 'overview' | 'catalog' | 'units' | 'requests' | 'orders' | 'expenses'

function AdminShell() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [email, setEmail] = useState('')
  useEffect(() => { void supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email || 'Admin')) }, [])
  async function signOut() { await supabase?.auth.signOut(); navigate('/admin/login') }
  const navItems: { id: AdminTab; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
    { id: 'catalog', label: 'Katalog', icon: <ShoppingBag size={17} /> },
    { id: 'units', label: 'Unit Fisik', icon: <Box size={17} /> },
    { id: 'requests', label: 'Request', icon: <CircleHelp size={17} /> },
    { id: 'orders', label: 'Pesanan', icon: <PackageCheck size={17} /> },
    { id: 'expenses', label: 'Pengeluaran', icon: <Banknote size={17} /> },
  ]
  return <div className="admin-app">
    <aside className="admin-sidebar"><Link to="/" className="brand"><span className="brand-mark"><ShoppingBag size={18} /></span><span>jastip<span className="brand-script">nisa.</span></span></Link><span className="sidebar-label">WORKSPACE</span><nav>{navItems.map(item => <button key={item.id} className={tab === item.id ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="admin-avatar">N</div><div><strong>Admin</strong><small>{email}</small></div><button onClick={signOut} className="signout-button" aria-label="Keluar"><ArrowUpRight size={16} /></button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">JASTIPNISA / ADMIN</span><h1>{navItems.find(item => item.id === tab)?.label}</h1></div><Link to="/" target="_blank" className="view-public">Lihat halaman publik <ArrowUpRight size={15} /></Link></header><div className="admin-content">{tab === 'overview' && <Overview setTab={setTab} />}{tab === 'catalog' && <CatalogManager />}{tab === 'units' && <UnitsManager />}{tab === 'requests' && <RequestManager />}{tab === 'orders' && <OrdersManager />}{tab === 'expenses' && <ExpensesManager />}</div></main>
  </div>
}

function Overview({ setTab }: { setTab: (tab: AdminTab) => void }) {
  const [metrics, setMetrics] = useState({ products: 0, requests: 0, orders: 0, units: 0 })
  const [message, setMessage] = useState('')
  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) return
      const [products, requests, orders, units] = await Promise.all([
        supabase.from('catalog_products').select('*', { count: 'exact', head: true }),
        supabase.from('requests').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
      ])
      if (alive) {
        setMetrics({ products: products.count || 0, requests: requests.count || 0, orders: orders.count || 0, units: units.count || 0 })
        const error = products.error || requests.error || orders.error || units.error
        if (error) setMessage('Sebagian ringkasan belum dapat dimuat. Periksa migrasi dan kebijakan RLS Supabase.')
      }
    }
    void load()
    return () => { alive = false }
  }, [])
  const cards = [{ label: 'Model katalog', value: metrics.products, icon: <ShoppingBag size={18} />, tone: 'rose' }, { label: 'Request masuk', value: metrics.requests, icon: <CircleHelp size={18} />, tone: 'amber' }, { label: 'Total pesanan', value: metrics.orders, icon: <PackageCheck size={18} />, tone: 'sage' }, { label: 'Unit fisik', value: metrics.units, icon: <Box size={18} />, tone: 'blue' }]
  return <div className="admin-view"><div className="welcome-banner"><div><span className="eyebrow">YOUR DAILY OVERVIEW</span><h2>Halo, Admin Nisa <span>✦</span></h2><p>Ringkasan aktivitas JastipNisa akan muncul di sini.</p></div><div className="welcome-date">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>{message && <div className="form-alert">{message}</div>}<div className="metric-grid">{cards.map(card => <div className="metric-card" key={card.label}><span className={`metric-icon ${card.tone}`}>{card.icon}</span><span className="metric-label">{card.label}</span><strong>{card.value}</strong></div>)}</div><div className="admin-two-col"><div className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">QUICK ACCESS</span><h3>Kelola operasional</h3></div></div><div className="quick-actions"><button onClick={() => setTab('catalog')}><ShoppingBag size={19} /><span><strong>Kelola katalog</strong><small>Atur model referensi Flicka</small></span><ArrowRight size={16} /></button><button onClick={() => setTab('requests')}><CircleHelp size={19} /><span><strong>Lihat request</strong><small>Periksa wishlist pelanggan</small></span><ArrowRight size={16} /></button><button onClick={() => setTab('orders')}><PackageCheck size={19} /><span><strong>Kelola pesanan</strong><small>Pantau order yang masuk</small></span><ArrowRight size={16} /></button></div></div><div className="admin-panel admin-note-panel"><span className="note-icon"><ShieldCheck size={20} /></span><span className="eyebrow">REMINDER</span><h3>Catalog is not inventory.</h3><p>Model yang tampil di katalog Flicka bukan berarti unit tersedia. Selalu catat unit fisik dan foto aktual setelah admin berhasil mendapatkannya.</p></div></div></div>
}

function CatalogManager() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  async function refresh() {
    if (!supabase) return
    const { data, error } = await supabase.from('catalog_products').select('*').order('sort_order').order('name')
    if (error) setNotice('Gagal memuat katalog. Periksa koneksi dan kebijakan database.')
    else setProducts((data || []).map(mapCatalogRow))
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  async function addProduct(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true); setNotice('')
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { error } = await supabase.from('catalog_products').insert({
      name: name.trim(), slug, official_price: Number(price) || null,
      official_product_url: url.trim(), source_url: OFFICIAL_CATALOG_URL,
      source_checked_at: new Date().toISOString().slice(0, 10), category: 'Flicka bag',
    })
    setSaving(false)
    if (error) setNotice(error.message.includes('duplicate') ? 'Nama model/slug sudah digunakan.' : 'Produk belum tersimpan. Periksa input dan database.')
    else { setNotice('Model katalog berhasil ditambahkan.'); setName(''); setPrice(''); setUrl(''); await refresh() }
  }
  async function toggleProduct(product: CatalogProduct) {
    if (!supabase || !product.id) return
    const { error } = await supabase.from('catalog_products').update({ is_active: !product.isActive }).eq('id', product.id)
    if (error) setNotice('Status produk gagal diperbarui.')
    else { setNotice('Status katalog diperbarui.'); await refresh() }
  }
  return <div className="admin-view"><div className="admin-section-intro"><div><span className="eyebrow">PRODUCT REFERENCES</span><h2>Model katalog Flicka</h2><p>Data katalog resmi terpisah dari unit fisik yang berhasil dibeli.</p></div><a href={OFFICIAL_CATALOG_URL} target="_blank" rel="noreferrer" className="button button-light">Sumber resmi <ArrowUpRight size={15} /></a></div>{notice && <div className="inline-notice">{notice}</div>}<div className="admin-panel add-product-panel"><div className="panel-heading"><div><span className="eyebrow">ADD REFERENCE</span><h3>Tambah model katalog</h3></div></div><form className="admin-inline-form" onSubmit={addProduct}><label>Nama model<input required value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Asha Bag" /></label><label>Harga referensi (Rp)<input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="108000" /></label><label className="url-field">URL produk resmi<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.flickabags.com/products/..." /></label><button className="button button-dark" disabled={saving}>{saving ? 'Menyimpan…' : 'Tambah Model'}</button></form></div><div className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">CATALOG LIST</span><h3>{products.length} model tersimpan</h3></div></div>{loading ? <div className="admin-loading"><span className="spinner" /> Memuat katalog…</div> : <div className="table-wrap"><table><thead><tr><th>Model</th><th>Harga referensi</th><th>Sumber</th><th>Status</th><th></th></tr></thead><tbody>{products.map(product => <tr key={product.id || product.slug}><td><strong>{product.name}</strong><small>{product.category}</small></td><td>{formatRupiah(product.officialPrice)}</td><td><a className="table-link" href={product.officialUrl} target="_blank" rel="noreferrer">Flicka <ArrowUpRight size={12} /></a></td><td><span className={product.isActive ? 'status-pill status-active' : 'status-pill status-muted'}>{product.isActive ? 'Aktif' : 'Disembunyikan'}</span></td><td><button className="small-action" onClick={() => void toggleProduct(product)}>{product.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>)}</tbody></table>{!products.length && <div className="empty-state">Belum ada data katalog di database. Jalankan seed SQL untuk mengisi 12 model awal.</div>}</div>}</div></div>
}


function UnitsManager() {
  const [units, setUnits] = useState<Record<string, unknown>[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [productId, setProductId] = useState('')
  const [variant, setVariant] = useState('')
  const [unitCode, setUnitCode] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [conditionNotes, setConditionNotes] = useState('')

  async function refresh() {
    if (!supabase) { setLoading(false); return }
    const [unitResult, productResult] = await Promise.all([
      supabase.from('units').select('id,unit_code,product_id,purchase_price,selling_price,actual_photo_urls,condition_notes,status,purchased_at,catalog_products(name),catalog_variants(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('catalog_products').select('id,name').eq('is_active', true).order('name'),
    ])
    if (unitResult.error) setNotice('Gagal memuat unit fisik. Periksa migration dan kebijakan database.')
    else setUnits((unitResult.data || []) as Record<string, unknown>[])
    if (!productResult.error) setProducts(productResult.data || [])
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  async function createUnit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (!productId) { setNotice('Pilih model katalog terlebih dahulu.'); return }
    setSaving(true); setNotice('')
    const generatedCode = unitCode.trim() || (
      'JN-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') +
      '-' + crypto.randomUUID().slice(0, 6).toUpperCase()
    )
    let variantId: string | null = null
    if (variant.trim()) {
      const { data: existingVariant, error: variantLookupError } = await supabase
        .from('catalog_variants').select('id').eq('product_id', productId).eq('name', variant.trim()).maybeSingle()
      if (variantLookupError) {
        setSaving(false); setNotice('Varian unit gagal diperiksa.'); return
      }
      if (existingVariant) variantId = existingVariant.id
      else {
        const { data: newVariant, error: variantInsertError } = await supabase
          .from('catalog_variants').insert({ product_id: productId, name: variant.trim() }).select('id').single()
        if (variantInsertError || !newVariant) {
          setSaving(false); setNotice('Varian unit gagal disimpan.'); return
        }
        variantId = newVariant.id
      }
    }
    const { error } = await supabase.from('units').insert({
      unit_code: generatedCode,
      product_id: productId,
      variant_id: variantId,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      selling_price: sellingPrice ? Number(sellingPrice) : null,
      actual_photo_urls: photoUrl.trim() ? [photoUrl.trim()] : [],
      condition_notes: conditionNotes.trim() || null,
      status: 'available',
      purchased_at: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (error) setNotice(error.message.includes('duplicate') ? 'Kode unit sudah digunakan. Buat kode lain.' : 'Unit gagal disimpan. Periksa data dan koneksi database.')
    else {
      setNotice('Unit fisik berhasil dicatat dengan status tersedia.')
      setProductId(''); setVariant(''); setUnitCode(''); setPurchasePrice(''); setSellingPrice(''); setPhotoUrl(''); setConditionNotes('')
      await refresh()
    }
  }

  async function changeUnitStatus(id: string, status: string) {
    if (!supabase) return
    const { error } = await supabase.from('units').update({ status }).eq('id', id)
    if (error) setNotice('Status unit gagal diperbarui.')
    else { setNotice('Status unit diperbarui.'); await refresh() }
  }

  const statusLabels: Record<string,string> = {
    available: 'Tersedia', reserved: 'Direservasi', sold: 'Terjual', packed: 'Dikemas',
    shipped: 'Dikirim', completed: 'Selesai', cancelled: 'Dibatalkan',
  }

  return (
    <div className="admin-view">
      <div className="admin-section-intro"><div><span className="eyebrow">PHYSICAL INVENTORY</span><h2>Unit fisik</h2><p>Catat tas yang benar-benar ditemukan dan dibeli admin. Data ini berbeda dari katalog resmi.</p></div></div>
      {notice && <div className="inline-notice">{notice}</div>}
      <div className="admin-panel add-product-panel">
        <div className="panel-heading"><div><span className="eyebrow">REGISTER ACTUAL UNIT</span><h3>Catat unit yang ditemukan</h3></div></div>
        <form className="admin-inline-form unit-form" onSubmit={createUnit}>
          <label>Model katalog<select required value={productId} onChange={e => setProductId(e.target.value)}><option value="">Pilih model</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Kode unit (opsional)<input value={unitCode} onChange={e => setUnitCode(e.target.value)} placeholder="Otomatis jika kosong" /></label>
          <label>Varian / warna<input value={variant} onChange={e => setVariant(e.target.value)} placeholder="Contoh: Black, Ivory" /></label>
          <label>Harga beli (Rp)<input type="number" min="0" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="Modal aktual" /></label>
          <label>Harga jual disepakati (Rp)<input type="number" min="0" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="Harga ke customer" /></label>
          <label className="unit-photo-field">URL foto aktual<input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="Link foto unit dari Drive / storage" /></label>
          <label className="unit-condition-field">Catatan kondisi<textarea rows={2} value={conditionNotes} onChange={e => setConditionNotes(e.target.value)} placeholder="Kondisi, defect minor, detail yang perlu diketahui customer" /></label>
          <button className="button button-dark" disabled={saving || !products.length}>{saving ? 'Menyimpan…' : 'Simpan Unit'}</button>
        </form>
        <p className="order-helper unit-helper">Simpan URL foto yang dapat diakses admin/customer sesuai kebutuhan. Upload foto privat langsung dari perangkat belum diaktifkan pada slice ini.</p>
      </div>
      <div className="admin-panel">
        <div className="panel-heading"><div><span className="eyebrow">UNIT TRACKER</span><h3>{units.length} unit tercatat</h3></div></div>
        {loading ? <div className="admin-loading"><span className="spinner" /> Memuat unit…</div> : units.length ? (
          <div className="table-wrap"><table><thead><tr><th>Kode unit</th><th>Model</th><th>Harga beli</th><th>Harga jual</th><th>Foto / kondisi</th><th>Status</th></tr></thead><tbody>
            {units.map(unit => {
              const product = unit.catalog_products as { name?: string } | null
              const photo = Array.isArray(unit.actual_photo_urls) ? String(unit.actual_photo_urls[0] || '') : ''
              return <tr key={String(unit.id)}>
                <td><strong>{String(unit.unit_code)}</strong><small>{unit.purchased_at ? new Date(String(unit.purchased_at)).toLocaleDateString('id-ID') : 'Tanggal belum diisi'}</small></td>
                <td><strong>{product?.name || 'Model tidak tersedia'}</strong><small>{String((unit.catalog_variants as { name?: string } | null)?.name || 'Varian belum dicatat')}</small></td>
                <td>{unit.purchase_price == null ? '—' : formatRupiah(Number(unit.purchase_price))}</td>
                <td>{unit.selling_price == null ? '—' : formatRupiah(Number(unit.selling_price))}</td>
                <td>{photo ? <a className="table-link" href={photo} target="_blank" rel="noreferrer">Lihat foto <ArrowUpRight size={12} /></a> : 'Belum ada foto'}<small>{String(unit.condition_notes || 'Tanpa catatan kondisi')}</small></td>
                <td><select className="order-status-select" value={String(unit.status)} onChange={e => void changeUnitStatus(String(unit.id), e.target.value)}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td>
              </tr>
            })}
          </tbody></table></div>
        ) : <div className="empty-state"><Box size={24} /><strong>Belum ada unit fisik</strong><span>Tambahkan unit setelah admin berhasil menemukan dan membelinya.</span></div>}
      </div>
    </div>
  )
}

function RequestManager() {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [productId, setProductId] = useState('')
  const [variant, setVariant] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('bank_transfer')
  const [depositProofUrl, setDepositProofUrl] = useState('')

  async function refresh() {
    if (!supabase) { setLoading(false); return }
    const [requestResult, productResult] = await Promise.all([
      supabase.from('requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('catalog_products').select('id,name').eq('is_active', true).order('name'),
    ])
    if (requestResult.error) setNotice('Gagal memuat request. Pastikan migration database sudah diterapkan.')
    else setRequests((requestResult.data || []) as Record<string, unknown>[])
    setProducts(productResult.data || [])
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  async function createRequest(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const product = products.find(item => item.id === productId)
    if (!product) { setNotice('Pilih model produk yang valid.'); return }
    const amount = Number(depositAmount) || 0
    if (amount < 0) { setNotice('Nominal deposit tidak boleh negatif.'); return }
    if (amount > 0 && depositMethod !== 'cash' && !depositProofUrl.trim()) {
      setNotice('Masukkan URL bukti transfer untuk deposit non-tunai.')
      return
    }
    setSaving(true); setNotice('')
    const { error } = await supabase.from('requests').insert({
      customer_name: customerName.trim(),
      customer_phone: phone.trim(),
      product_id: product.id,
      requested_product_name: product.name,
      requested_variant: variant.trim() || null,
      deposit_amount: amount,
      deposit_method: depositMethod,
      deposit_proof_url: depositProofUrl.trim() || null,
      deposit_payment_status: amount > 0 ? 'awaiting_verification' : 'not_received',
      status: 'new',
    })
    setSaving(false)
    if (error) setNotice('Request gagal disimpan. Periksa data dan koneksi database.')
    else {
      setNotice('Request berhasil ditambahkan. Deposit menunggu verifikasi admin.')
      setCustomerName(''); setPhone(''); setProductId(''); setVariant('')
      setDepositAmount(''); setDepositMethod('bank_transfer'); setDepositProofUrl('')
      await refresh()
    }
  }

  async function updateStatus(id: string, status: string) {
    if (!supabase) return
    setUpdating(id); setNotice('')
    const { error } = await supabase.from('requests').update({ status }).eq('id', id)
    setUpdating(null)
    if (error) setNotice('Status request gagal diperbarui.')
    else { setNotice('Status request diperbarui.'); await refresh() }
  }

  async function verifyDeposit(request: Record<string, unknown>, nextStatus: 'verified' | 'rejected') {
    if (!supabase) return
    if (nextStatus === 'verified' && Number(request.deposit_amount) <= 0) {
      setNotice('Nominal deposit harus lebih dari nol sebelum diverifikasi.')
      return
    }
    setUpdating(String(request.id)); setNotice('')
    const update = nextStatus === 'verified'
      ? { deposit_payment_status: 'verified', deposit_received_at: new Date().toISOString(), status: 'deposit_received' }
      : { deposit_payment_status: 'rejected' }
    const { error } = await supabase.from('requests').update(update).eq('id', String(request.id))
    setUpdating(null)
    if (error) setNotice('Status verifikasi deposit gagal disimpan.')
    else { setNotice(nextStatus === 'verified' ? 'Deposit request telah diverifikasi.' : 'Deposit ditandai belum valid.'); await refresh() }
  }

  const depositLabels: Record<string,string> = {
    not_received: 'Belum ada deposit',
    awaiting_verification: 'Menunggu verifikasi',
    verified: 'Terverifikasi',
    applied_to_order: 'Masuk ke order',
    refunded: 'Direfund',
    rejected: 'Bukti ditolak',
  }

  return (
    <div className="admin-view">
      <div className="admin-section-intro">
        <div><span className="eyebrow">CUSTOMER WISHLIST</span><h2>Daftar request</h2><p>Catat wishlist dan bukti deposit sebelum admin mulai mencari barang.</p></div>
      </div>
      {notice && <div className="inline-notice">{notice}</div>}
      <div className="admin-panel add-product-panel">
        <div className="panel-heading"><div><span className="eyebrow">NEW REQUEST</span><h3>Catat request & deposit awal</h3></div></div>
        <form className="admin-inline-form request-form request-form-deposit" onSubmit={createRequest}>
          <label>Nama pelanggan<input required value={customerName} onChange={e => setCustomerName(e.target.value)} /></label>
          <label>Nomor WhatsApp<input required value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <label>Model produk<select required value={productId} onChange={e => setProductId(e.target.value)}><option value="">Pilih model</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Warna / catatan<input value={variant} onChange={e => setVariant(e.target.value)} placeholder="Warna atau detail lain" /></label>
          <label>Deposit diterima (Rp)<input type="number" min="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Opsional, sesuai bukti" /></label>
          <label>Metode deposit<select value={depositMethod} onChange={e => setDepositMethod(e.target.value)}><option value="bank_transfer">Transfer bank</option><option value="qris">QRIS</option><option value="cash">Tunai</option><option value="shopee">Shopee</option></select></label>
          <label className="request-proof-field">Link bukti transfer<input type="url" value={depositProofUrl} onChange={e => setDepositProofUrl(e.target.value)} placeholder="URL bukti (wajib untuk non-tunai)" /></label>
          <button className="button button-dark" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Request'}</button>
        </form>
      </div>
      <div className="admin-panel">
        <div className="panel-heading"><div><span className="eyebrow">REQUEST TRACKER</span><h3>{requests.length} request terbaru</h3></div></div>
        {loading ? <div className="admin-loading"><span className="spinner" /> Memuat request…</div> : requests.length ? (
          <div className="request-list">
            {requests.map(request => (
              <div className="request-row request-row-expanded" key={String(request.id)}>
                <div className="request-avatar">{String(request.customer_name || 'C').slice(0,1).toUpperCase()}</div>
                <div className="request-detail">
                  <strong>{String(request.requested_product_name)}</strong>
                  <span>{String(request.customer_name || 'Nama belum diisi')} · {String(request.customer_phone || 'No. HP belum diisi')}</span>
                  <small>{String(request.requested_variant || 'Varian belum ditentukan')} · {new Date(String(request.created_at)).toLocaleDateString('id-ID')}</small>
                  <div className="request-deposit-meta">
                    <span className="status-pill status-muted">{depositLabels[String(request.deposit_payment_status)] || 'Status deposit'}</span>
                    <strong>{Number(request.deposit_amount) > 0 ? formatRupiah(Number(request.deposit_amount)) : 'Tanpa deposit tercatat'}</strong>
                    {request.deposit_proof_url ? <a className="table-link" href={String(request.deposit_proof_url)} target="_blank" rel="noreferrer">Lihat bukti <ArrowUpRight size={12} /></a> : null}
                  </div>
                  {request.deposit_payment_status === 'awaiting_verification' ? (
                    <div className="request-review-actions">
                      <button type="button" disabled={updating === String(request.id)} onClick={() => void verifyDeposit(request, 'verified')}>Verifikasi deposit</button>
                      <button type="button" disabled={updating === String(request.id)} onClick={() => void verifyDeposit(request, 'rejected')}>Tolak bukti</button>
                    </div>
                  ) : null}
                </div>
                <select aria-label={`Status request ${String(request.requested_product_name)}`} disabled={updating === String(request.id)} value={String(request.status)} onChange={e => void updateStatus(String(request.id), e.target.value)}>
                  <option value="new">Baru</option><option value="deposit_received">Deposit diterima</option><option value="searching">Sedang dicari</option><option value="found">Ditemukan</option><option value="not_found">Tidak ditemukan</option><option value="cancelled">Dibatalkan</option>
                </select>
              </div>
            ))}
          </div>
        ) : <div className="empty-state"><CircleHelp size={24} /><strong>Belum ada request</strong><span>Request pelanggan yang dicatat akan tampil di sini.</span></div>}
      </div>
    </div>
  )
}

type OrderDraftItem = {
  key: string
  productId: string
  productName: string
  variant: string
  quantity: number
  unitPrice: string
  unitId: string
}

function OrdersManager() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; official_price: number | null }[]>([])
  const [availableUnits, setAvailableUnits] = useState<{ id: string; unit_code: string; product_id: string; condition_notes: string | null }[]>([])
  const [verifiedRequests, setVerifiedRequests] = useState<Record<string, unknown>[]>([])
  const [sourceRequestId, setSourceRequestId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingFee, setShippingFee] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [depositAmount, setDepositAmount] = useState('')
  const [checkoutMethod, setCheckoutMethod] = useState<'manual' | 'shopee'>('manual')
  const [shopeeLink, setShopeeLink] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [items, setItems] = useState<OrderDraftItem[]>([
    { key: 'item-1', productId: '', productName: '', variant: '', quantity: 1, unitPrice: '', unitId: '' },
  ])
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentType, setPaymentType] = useState<'deposit' | 'settlement' | 'shipping' | 'refund'>('settlement')
  const [paymentMethodEntry, setPaymentMethodEntry] = useState('bank_transfer')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentProofUrl, setPaymentProofUrl] = useState('')
  const [depositProofUrl, setDepositProofUrl] = useState('')
  const [shipmentOrderId, setShipmentOrderId] = useState<string | null>(null)
  const [shipmentCourier, setShipmentCourier] = useState('')
  const [shipmentTracking, setShipmentTracking] = useState('')
  const [shipmentStatus, setShipmentStatus] = useState<'preparing' | 'shipped' | 'delivered' | 'issue'>('preparing')
  const [shopeeUsernames, setShopeeUsernames] = useState<Record<string, string>>({})

  async function refresh() {
    if (!supabase) { setLoading(false); return }
    const [orderResult, productResult, unitResult, requestResult] = await Promise.all([
      supabase.from('orders').select('id,order_code,customer_name,customer_phone,total_amount,status,payment_status,created_at,checkout_method,shopee_username,customer_shopee_confirmed_at,shopee_checkout_url,product_count,jastip_fee,shipping_fee,source_request_id,payments(amount,payment_type),shipments(courier,tracking_number,status,processed_at,shipped_at)').order('created_at', { ascending: false }).limit(100),
      supabase.from('catalog_products').select('id,name,official_price').eq('is_active', true).order('name'),
      supabase.from('units').select('id,unit_code,product_id,condition_notes').eq('status', 'available').order('created_at', { ascending: false }).limit(300),
      supabase.from('requests').select('id,customer_name,customer_phone,product_id,requested_product_name,requested_variant,deposit_amount,deposit_method,deposit_proof_url').eq('status', 'found').eq('deposit_payment_status', 'verified').order('created_at', { ascending: false }).limit(100),
    ])
    if (orderResult.error) setNotice('Gagal memuat data pesanan. Periksa migrasi database dan RLS.')
    else setOrders((orderResult.data || []) as Record<string, unknown>[])
    if (!productResult.error) setProducts(productResult.data || [])
    if (!unitResult.error) setAvailableUnits(unitResult.data || [])
    if (!requestResult.error) setVerifiedRequests((requestResult.data || []) as Record<string, unknown>[])
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  const productCount = items.reduce((sum, item) => sum + Math.max(0, Math.floor(item.quantity || 0)), 0)
  const subtotal = items.reduce((sum, item) => sum + (Math.max(0, Math.floor(item.quantity || 0)) * Math.max(0, Number(item.unitPrice) || 0)), 0)
  const jastipFee = calculateJastipFee(productCount)
  const shipping = Math.max(0, Number(shippingFee) || 0)
  const discountValue = Math.max(0, Number(discount) || 0)
  const total = Math.max(0, subtotal + jastipFee + shipping - discountValue)

  function updateItem(key: string, patch: Partial<OrderDraftItem>) {
    setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item))
  }

  function addItem() {
    setItems(current => [...current, {
      key: 'item-' + Date.now() + '-' + current.length,
      productId: '', productName: '', variant: '', quantity: 1, unitPrice: '', unitId: '',
    }])
  }

  function selectSourceRequest(requestId: string) {
    setSourceRequestId(requestId)
    if (!requestId) {
      setDepositAmount('')
      setDepositProofUrl('')
      return
    }
    const request = verifiedRequests.find(item => String(item.id) === requestId)
    if (!request) return
    const product = products.find(item =>
      item.id === request.product_id || item.name === request.requested_product_name
    )
    setCustomerName(String(request.customer_name || ''))
    setCustomerPhone(String(request.customer_phone || ''))
    setDepositAmount(String(request.deposit_amount || ''))
    setDepositProofUrl(String(request.deposit_proof_url || ''))
    setPaymentMethod(String(request.deposit_method || 'bank_transfer'))
    setItems(current => {
      const first = current[0] || { key: 'item-' + Date.now(), productId: '', productName: '', variant: '', quantity: 1, unitPrice: '', unitId: '' }
      return [{
        ...first,
        productId: product?.id || '',
        productName: product?.name || String(request.requested_product_name || ''),
        variant: String(request.requested_variant || ''),
        unitId: '',
      }, ...current.slice(1)]
    })
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setNotice('')
    if (!items.length || items.some(item => !item.productName || !Number(item.unitPrice) || Number(item.unitPrice) <= 0)) {
      setNotice('Pilih model dan isi harga satuan yang sudah disepakati untuk setiap item.')
      return
    }
    if (checkoutMethod === 'shopee' && !shopeeLink.trim()) {
      setNotice('Masukkan link checkout Shopee yang diberikan admin.')
      return
    }
    const deposit = Number(depositAmount) || 0
    if (deposit < 0 || deposit > total) {
      setNotice('Nominal deposit tidak boleh negatif atau melebihi total order.')
      return
    }
    setSaving(true)
    const payload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      shipping_address: shippingAddress.trim(),
      source_request_id: sourceRequestId || null,
      checkout_method: checkoutMethod,
      shopee_checkout_url: checkoutMethod === 'shopee' ? shopeeLink.trim() : null,
      shipping_fee: shipping,
      discount: discountValue,
      deposit_amount: deposit,
      payment_method: paymentMethod,
      payment_proof_url: depositProofUrl.trim() || null,
      items: items.map(item => ({
        product_id: item.productId || null,
        product_name_snapshot: item.productName,
        variant_snapshot: item.variant.trim() || null,
        quantity: Math.max(1, Math.floor(item.quantity)),
        unit_price: Number(item.unitPrice),
        unit_id: item.unitId || null,
      })),
    }
    const { data, error } = await supabase.rpc('create_order', { p_payload: payload })
    setSaving(false)
    if (error) {
      setNotice('Order gagal dibuat. Pastikan migration terbaru sudah diterapkan dan data pesanan valid.')
      return
    }
    const created = Array.isArray(data) ? data[0] : data
    setNotice('Order ' + (created?.order_code || '') + ' berhasil dibuat. Fee dihitung ulang oleh database.')
    setCustomerName(''); setCustomerPhone(''); setShippingAddress('')
    setSourceRequestId('')
    setShippingFee('0'); setDiscount('0'); setDepositAmount(''); setDepositProofUrl('')
    setCheckoutMethod('manual'); setShopeeLink('')
    setItems([{ key: 'item-' + Date.now(), productId: '', productName: '', variant: '', quantity: 1, unitPrice: '', unitId: '' }])
    await refresh()
  }

  async function changeOrderStatus(orderId: string, status: string) {
    if (!supabase) return
    const currentOrder = orders.find(order => String(order.id) === orderId)
    if (
      currentOrder?.checkout_method === 'shopee'
      && ['packing', 'shipped', 'completed'].includes(status)
      && (!String(currentOrder.shopee_username || '').trim() || !currentOrder.customer_shopee_confirmed_at)
    ) {
      setNotice('Konfirmasi nama akun Shopee dari pelanggan terlebih dahulu sebelum order masuk tahap packing/pengiriman.')
      return
    }
    setUpdatingOrder(orderId); setNotice('')
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    setUpdatingOrder(null)
    if (error) setNotice('Status order gagal diperbarui.')
    else { setNotice('Status order berhasil diperbarui.'); await refresh() }
  }

  async function saveShopeeUsername(orderId: string, existingName: string) {
    if (!supabase) return
    const username = (shopeeUsernames[orderId] ?? existingName).trim()
    if (!username) { setNotice('Isi nama akun Shopee yang sudah dikonfirmasi customer.'); return }
    setUpdatingOrder(orderId); setNotice('')
    const { error } = await supabase.from('orders').update({
      shopee_username: username,
      customer_shopee_confirmed_at: new Date().toISOString(),
    }).eq('id', orderId)
    setUpdatingOrder(null)
    if (error) setNotice('Konfirmasi nama Shopee gagal disimpan.')
    else { setNotice('Nama akun Shopee berhasil dicatat.'); await refresh() }
  }

  async function recordPayment(orderId: string) {
    if (!supabase) return
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice('Masukkan nominal pembayaran atau refund yang valid.')
      return
    }
    setUpdatingOrder(orderId); setNotice('')
    const { error } = await supabase.rpc('record_order_payment', {
      p_order_id: orderId,
      p_amount: amount,
      p_payment_type: paymentType,
      p_method: paymentMethodEntry,
      p_notes: paymentNotes.trim() || null,
      p_proof_url: paymentProofUrl.trim() || null,
    })
    setUpdatingOrder(null)
    if (error) {
      setNotice('Pembayaran gagal dicatat. Periksa nominal, sisa tagihan, dan migration terbaru.')
      return
    }
    setNotice('Ledger pembayaran berhasil diperbarui.')
    setPaymentOrderId(null); setPaymentAmount(''); setPaymentNotes(''); setPaymentProofUrl('')
    setPaymentType('settlement')
    await refresh()
  }

  async function saveShipment(orderId: string) {
    if (!supabase) return
    const currentOrder = orders.find(order => String(order.id) === orderId)
    if (
      currentOrder?.checkout_method === 'shopee'
      && ['preparing', 'shipped', 'delivered'].includes(shipmentStatus)
      && (!String(currentOrder.shopee_username || '').trim() || !currentOrder.customer_shopee_confirmed_at)
    ) {
      setNotice('Sebelum packing/pengiriman Shopee, simpan dulu nama akun Shopee yang sudah dikonfirmasi pelanggan.')
      return
    }
    if (shipmentStatus === 'shipped' && !shipmentTracking.trim()) {
      setNotice('Isi nomor resi sebelum menandai paket sudah dikirim.')
      return
    }
    setUpdatingOrder(orderId); setNotice('')
    const now = new Date().toISOString()
    const { error } = await supabase.from('shipments').upsert({
      order_id: orderId,
      courier: shipmentCourier.trim() || null,
      tracking_number: shipmentTracking.trim() || null,
      status: shipmentStatus,
      processed_at: now,
      shipped_at: shipmentStatus === 'shipped' || shipmentStatus === 'delivered' ? now : null,
      estimated_processing_days: '2–3 hari kerja',
    }, { onConflict: 'order_id' })
    if (error) {
      setUpdatingOrder(null); setNotice('Data pengiriman gagal disimpan.'); return
    }
    const orderStatus = shipmentStatus === 'preparing' ? 'packing'
      : shipmentStatus === 'shipped' ? 'shipped'
      : shipmentStatus === 'delivered' ? 'completed' : 'issue'
    const { error: orderError } = await supabase.from('orders').update({ status: orderStatus }).eq('id', orderId)
    setUpdatingOrder(null)
    if (orderError) setNotice('Data pengiriman tersimpan, tetapi status order perlu diselaraskan secara manual.')
    else setNotice('Informasi pengiriman dan status order berhasil diperbarui.')
    setShipmentOrderId(null)
    await refresh()
  }

  const statuses = [
    ['awaiting_payment', 'Menunggu pembayaran'],
    ['deposit_received', 'Deposit diterima'],
    ['admin_searching', 'Admin mencari barang'],
    ['awaiting_customer_details', 'Menunggu data customer'],
    ['confirmed', 'Terkonfirmasi'],
    ['packing', 'Packing'],
    ['shipped', 'Dikirim'],
    ['completed', 'Selesai'],
    ['cancelled', 'Dibatalkan'],
    ['issue', 'Ada kendala'],
  ]

  return (
    <div className="admin-view">
      <div className="admin-section-intro">
        <div><span className="eyebrow">ORDER MANAGEMENT</span><h2>Pesanan pelanggan</h2><p>Buat order final setelah ketersediaan, foto aktual dan detail pelanggan dikonfirmasi.</p></div>
      </div>
      {notice && <div className="inline-notice">{notice}</div>}

      <div className="admin-panel order-create-panel">
        <div className="panel-heading"><div><span className="eyebrow">CREATE CONFIRMED ORDER</span><h3>Buat pesanan baru</h3></div></div>
        <form className="order-form" onSubmit={createOrder}>
          <div className="order-form-section">
            <span className="order-form-label">01 · DATA PELANGGAN</span>
            <div className="order-form-grid">
              <label className="field-full">Request sumber (deposit sudah diverifikasi)<select value={sourceRequestId} onChange={e => selectSourceRequest(e.target.value)}><option value="">Buat order tanpa request sumber</option>{verifiedRequests.map(request => <option key={String(request.id)} value={String(request.id)}>{String(request.customer_name)} · {String(request.requested_product_name)} · {formatRupiah(Number(request.deposit_amount || 0))}</option>)}</select></label>
              <label>Nama lengkap<input required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama penerima" /></label>
              <label>Nomor HP / WhatsApp<input required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="08xxxxxxxxxx" /></label>
              <label className="field-full">Alamat pengiriman<textarea required rows={2} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Alamat lengkap, kecamatan, kota, kode pos" /></label>
            </div>
          </div>

          <div className="order-form-section">
            <div className="order-form-title"><span className="order-form-label">02 · ITEM PESANAN</span><button type="button" className="subtle-action" onClick={addItem}><Plus size={14} /> Tambah item</button></div>
            <div className="order-items-editor">
              {items.map((item, index) => (
                <div className="order-item-editor" key={item.key}>
                  <div className="order-item-index">0{index + 1}</div>
                  <label className="order-product-select">Model katalog<select required value={item.productId} onChange={e => {
                    const product = products.find(p => p.id === e.target.value)
                    updateItem(item.key, { productId: e.target.value, productName: product?.name || '', unitId: '' })
                  }}><option value="">Pilih model</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                  <label className="order-unit-select">Unit fisik (opsional)<select value={item.unitId} disabled={!item.productId || item.quantity !== 1} onChange={e => updateItem(item.key, { unitId: e.target.value, quantity: 1 })}><option value="">Belum pilih unit tertentu</option>{availableUnits.filter(unit => unit.product_id === item.productId).map(unit => <option key={unit.id} value={unit.id}>{unit.unit_code}{unit.condition_notes ? ' · ' + unit.condition_notes : ''}</option>)}</select></label>
                  <label>Varian / warna<input value={item.variant} onChange={e => updateItem(item.key, { variant: e.target.value })} placeholder="Opsional" /></label>
                  <label>Jumlah<input type="number" min="1" max="50" value={item.quantity} onChange={e => { const quantity = Math.max(1, Math.min(50, Number(e.target.value) || 1)); updateItem(item.key, { quantity, unitId: quantity === 1 ? item.unitId : '' }) }} /></label>
                  <label>Harga satuan (Rp)<input type="number" min="1" required value={item.unitPrice} onChange={e => updateItem(item.key, { unitPrice: e.target.value })} placeholder="Harga disepakati" /></label>
                  <button type="button" className="remove-item" disabled={items.length === 1} onClick={() => setItems(current => current.filter(row => row.key !== item.key))} aria-label="Hapus item"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <p className="order-helper">Harga katalog Flicka tidak otomatis dijadikan harga jual. Isi harga satuan sesuai kesepakatan final dengan customer.</p>
          </div>

          <div className="order-form-section">
            <span className="order-form-label">03 · CHECKOUT & PEMBAYARAN</span>
            <div className="order-form-grid">
              <label>Jalur checkout<select value={checkoutMethod} onChange={e => setCheckoutMethod(e.target.value as 'manual' | 'shopee')}><option value="manual">Transfer langsung / manual</option><option value="shopee">Shopee</option></select></label>
              {checkoutMethod === 'shopee' && <label>Link checkout Shopee<input required type="url" value={shopeeLink} onChange={e => setShopeeLink(e.target.value)} placeholder="https://shopee.co.id/..." /></label>}
              <label>Ongkir (Rp)<input type="number" min="0" value={shippingFee} onChange={e => setShippingFee(e.target.value)} /></label>
              <label>Diskon (Rp)<input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
              <label>Deposit diterima (Rp)<input type="number" min="0" max={total} value={depositAmount} readOnly={Boolean(sourceRequestId)} onChange={e => setDepositAmount(e.target.value)} placeholder="Isi jika sudah diterima" /></label>
              <label>Link bukti deposit (opsional)<input type="url" value={depositProofUrl} readOnly={Boolean(sourceRequestId)} onChange={e => setDepositProofUrl(e.target.value)} placeholder="Link Drive / storage privat" /></label>
              <label>Metode pembayaran<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="bank_transfer">Transfer bank</option><option value="qris">QRIS</option><option value="cash">Tunai</option><option value="shopee">Shopee</option></select></label>
            </div>
            <p className="order-helper">Deposit dicatat sesuai nominal yang benar-benar diterima. Tidak ada nominal atau persentase deposit otomatis.</p>
          </div>

          <div className="order-total-panel">
            <div><span>Jumlah produk</span><strong>{productCount}</strong></div>
            <div><span>Subtotal barang</span><strong>{formatRupiah(subtotal)}</strong></div>
            <div><span>Fee jastip</span><strong>{formatRupiah(jastipFee)}</strong></div>
            <div><span>Ongkir − diskon</span><strong>{formatRupiah(shipping - discountValue)}</strong></div>
            <div className="order-grand-total"><span>Total tagihan</span><strong>{formatRupiah(total)}</strong></div>
          </div>
          <div className="order-form-actions"><span>Order akan tersimpan bersama item dan catatan deposit sebagai satu transaksi database.</span><button className="button button-dark" disabled={saving || !products.length}>{saving ? 'Menyimpan order…' : 'Buat Order'} <ArrowRight size={15} /></button></div>
        </form>
      </div>

      <div className="admin-panel">
        <div className="panel-heading"><div><span className="eyebrow">ALL ORDERS</span><h3>{orders.length} pesanan tersimpan</h3></div></div>
        {loading ? <div className="admin-loading"><span className="spinner" /> Memuat pesanan…</div> : orders.length ? (
          <div className="table-wrap"><table><thead><tr><th>Order</th><th>Pelanggan</th><th>Jumlah</th><th>Total</th><th>Masuk / Sisa</th><th>Pembayaran</th><th>Status</th></tr></thead><tbody>
            {orders.map(order => {
              const paymentRows = Array.isArray(order.payments) ? order.payments as Record<string, unknown>[] : []
              const paidAmount = paymentRows.reduce((sum, payment) => sum + (payment.payment_type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0)
              const balance = Math.max(0, Number(order.total_amount) - paidAmount)
              return (
              <tr key={String(order.id)}>
                <td><strong>{String(order.order_code)}</strong><small>{new Date(String(order.created_at)).toLocaleDateString('id-ID')} · {String(order.checkout_method)}</small></td>
                <td>
                  <strong>{String(order.customer_name)}</strong><small>{String(order.customer_phone)}</small>
                  {order.checkout_method === 'shopee' ? <div className="shopee-confirm-field"><input aria-label="Nama akun Shopee customer" value={shopeeUsernames[String(order.id)] ?? String(order.shopee_username || '')} onChange={e => setShopeeUsernames(current => ({ ...current, [String(order.id)]: e.target.value }))} placeholder="Nama akun Shopee" /><button type="button" disabled={updatingOrder === String(order.id)} onClick={() => void saveShopeeUsername(String(order.id), String(order.shopee_username || ''))}>Simpan</button></div> : null}
                </td>
                <td>{String(order.product_count || 0)} produk<small>Fee {formatRupiah(Number(order.jastip_fee || 0))}</small></td>
                <td>{formatRupiah(Number(order.total_amount))}</td>
                <td><strong>{formatRupiah(paidAmount)}</strong><small>Sisa {formatRupiah(balance)}</small></td>
                <td>
                  <span className="status-pill status-muted">{String(order.payment_status)}</span>
                  {paymentOrderId === String(order.id) ? <div className="payment-inline-form">
                    <input type="number" min="1" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Nominal Rp" aria-label="Nominal pembayaran" />
                    <select value={paymentType} onChange={e => setPaymentType(e.target.value as 'deposit' | 'settlement' | 'shipping' | 'refund')} aria-label="Jenis pembayaran"><option value="deposit">Deposit</option><option value="settlement">Pelunasan</option><option value="shipping">Ongkir</option><option value="refund">Refund</option></select>
                    <select value={paymentMethodEntry} onChange={e => setPaymentMethodEntry(e.target.value)} aria-label="Metode pembayaran"><option value="bank_transfer">Transfer bank</option><option value="qris">QRIS</option><option value="cash">Tunai</option><option value="shopee">Shopee</option></select>
                    <input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan pembayaran" />
                    <input type="url" value={paymentProofUrl} onChange={e => setPaymentProofUrl(e.target.value)} placeholder="Link bukti (opsional)" aria-label="Link bukti pembayaran" />
                    <button type="button" disabled={updatingOrder === String(order.id)} onClick={() => void recordPayment(String(order.id))}>Simpan</button>
                    <button type="button" onClick={() => setPaymentOrderId(null)}>Batal</button>
                  </div> : <button type="button" className="small-action" onClick={() => { setPaymentOrderId(String(order.id)); setPaymentAmount(''); setPaymentNotes('') }}>Catat pembayaran</button>}
                </td>
                <td>
                  <select className="order-status-select" aria-label={`Status order ${String(order.order_code)}`} disabled={updatingOrder === String(order.id)} value={String(order.status)} onChange={e => void changeOrderStatus(String(order.id), e.target.value)}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <button type="button" className="small-action" onClick={() => {
                    const shipment = order.shipments as Record<string, unknown> | null
                    setShipmentOrderId(shipmentOrderId === String(order.id) ? null : String(order.id))
                    setShipmentCourier(String(shipment?.courier || ''))
                    setShipmentTracking(String(shipment?.tracking_number || ''))
                    setShipmentStatus((shipment?.status as 'preparing' | 'shipped' | 'delivered' | 'issue') || 'preparing')
                  }}>Pengiriman</button>
                  {shipmentOrderId === String(order.id) ? <div className="payment-inline-form shipment-inline-form">
                    <input value={shipmentCourier} onChange={e => setShipmentCourier(e.target.value)} placeholder="Kurir" aria-label="Kurir" />
                    <input value={shipmentTracking} onChange={e => setShipmentTracking(e.target.value)} placeholder="Nomor resi" aria-label="Nomor resi" />
                    <select value={shipmentStatus} onChange={e => setShipmentStatus(e.target.value as 'preparing' | 'shipped' | 'delivered' | 'issue')} aria-label="Status pengiriman"><option value="preparing">Diproses / packing</option><option value="shipped">Dikirim</option><option value="delivered">Diterima</option><option value="issue">Kendala</option></select>
                    <small>Estimasi proses admin: 2–3 hari kerja</small>
                    <button type="button" disabled={updatingOrder === String(order.id)} onClick={() => void saveShipment(String(order.id))}>Simpan pengiriman</button>
                  </div> : null}
                </td>
              </tr>
              )
            })}
          </tbody></table></div>
        ) : <div className="empty-state"><PackageCheck size={24} /><strong>Belum ada pesanan</strong><span>Order final yang dibuat admin akan muncul di sini.</span></div>}
      </div>
      <div className="admin-inline-note"><Wallet size={17} /> Pembayaran deposit awal dapat dicatat saat membuat order. Pencatatan pelunasan/refund lanjutan dan pengelolaan resi akan ditambahkan pada slice berikutnya.</div>
    </div>
  )
}


function ExpensesManager() {
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [category, setCategory] = useState('transport')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10))

  async function refresh() {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase.from('expenses').select('id,category,description,amount,occurred_at,created_at').order('occurred_at', { ascending: false }).limit(300)
    if (error) setNotice('Gagal memuat pengeluaran. Periksa migration dan kebijakan database.')
    else setExpenses((data || []) as Record<string, unknown>[])
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  async function addExpense(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setNotice('Nominal pengeluaran harus lebih dari nol.')
      return
    }
    setSaving(true); setNotice('')
    const { error } = await supabase.from('expenses').insert({
      category, description: description.trim() || null,
      amount: numericAmount, occurred_at: occurredAt,
    })
    setSaving(false)
    if (error) setNotice('Pengeluaran gagal disimpan.')
    else {
      setNotice('Pengeluaran berhasil dicatat.')
      setDescription(''); setAmount(''); await refresh()
    }
  }

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const categories: Record<string,string> = {
    transport: 'Transportasi', parking: 'Parkir', food: 'Makan', packing: 'Packing',
    shipping: 'Ongkir dibayar', other: 'Lainnya',
  }

  return (
    <div className="admin-view">
      <div className="admin-section-intro"><div><span className="eyebrow">OPERATING COSTS</span><h2>Pengeluaran operasional</h2><p>Catat biaya transport, parkir, makan, packing, ongkir yang dibayar admin dan biaya lainnya.</p></div></div>
      {notice && <div className="inline-notice">{notice}</div>}
      <div className="expense-summary"><span className="eyebrow">TOTAL PENGELUARAN TERCATAT</span><strong>{formatRupiah(total)}</strong><small>{expenses.length} catatan pengeluaran</small></div>
      <div className="admin-panel add-product-panel">
        <div className="panel-heading"><div><span className="eyebrow">NEW EXPENSE</span><h3>Tambah pengeluaran</h3></div></div>
        <form className="admin-inline-form expense-form" onSubmit={addExpense}>
          <label>Kategori<select value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(categories).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Nominal (Rp)<input type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="Contoh: 25000" /></label>
          <label>Tanggal<input type="date" required value={occurredAt} onChange={e => setOccurredAt(e.target.value)} /></label>
          <label>Keterangan<input value={description} onChange={e => setDescription(e.target.value)} placeholder="Detail pengeluaran" /></label>
          <button className="button button-dark" disabled={saving}>{saving ? 'Menyimpan…' : 'Catat biaya'}</button>
        </form>
      </div>
      <div className="admin-panel">
        <div className="panel-heading"><div><span className="eyebrow">EXPENSE LEDGER</span><h3>Riwayat pengeluaran</h3></div></div>
        {loading ? <div className="admin-loading"><span className="spinner" /> Memuat pengeluaran…</div> : expenses.length ? (
          <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>
            {expenses.map(expense => <tr key={String(expense.id)}><td>{new Date(String(expense.occurred_at) + 'T00:00:00').toLocaleDateString('id-ID')}</td><td><span className="status-pill status-muted">{categories[String(expense.category)] || String(expense.category)}</span></td><td>{String(expense.description || '—')}</td><td><strong>{formatRupiah(Number(expense.amount))}</strong></td></tr>)}
          </tbody></table></div>
        ) : <div className="empty-state"><Banknote size={24} /><strong>Belum ada pengeluaran</strong><span>Biaya operasional yang dicatat akan muncul di sini.</span></div>}
      </div>
    </div>
  )
}

function NotFound() {
  return <PublicLayout><div className="not-found"><span className="eyebrow">404 · NOT FOUND</span><h1>Halaman tidak ditemukan.</h1><Link className="button button-dark" to="/">Kembali ke beranda <ArrowRight size={16} /></Link></div></PublicLayout>
}

export default function App() {
  useEffect(() => {
    const isAdminRoute = window.location.pathname.startsWith('/admin')
    if (isAdminRoute) {
      document.title = 'Admin Workspace — JastipNisa'
      const robots = document.querySelector('meta[name="robots"]') || document.createElement('meta')
      robots.setAttribute('name', 'robots'); robots.setAttribute('content', 'noindex,nofollow')
      document.head.appendChild(robots)
    }
  }, [])
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/katalog" element={<CatalogPage />} />
    <Route path="/cara-kerja" element={<ProcessPage />} />
    <Route path="/kebijakan" element={<PolicyPage />} />
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin" element={<AdminGuard><AdminShell /></AdminGuard>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
}
