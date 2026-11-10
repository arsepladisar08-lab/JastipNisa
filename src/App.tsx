import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Box, Check,
  ChevronDown, CircleHelp, Clock3, Instagram, LayoutDashboard, LockKeyhole,
  Menu, PackageCheck, Search, ShieldCheck, ShoppingBag, Sparkles, Truck,
  Wallet, X,
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
  return (
    <article className="product-card">
      <a href={product.officialUrl} target="_blank" rel="noreferrer" className="product-link" aria-label={`Lihat ${product.name} di katalog resmi Flicka`}>
        <ProductVisual product={product} />
        <span className="availability-tag"><span /> Perlu konfirmasi admin</span>
        <div className="product-info">
          <div><span className="eyebrow">{product.category}</span><h3>{product.name}</h3></div>
          <div className="product-price">{formatRupiah(product.officialPrice)}<small>Harga referensi</small></div>
        </div>
        <span className="product-arrow"><ArrowUpRight size={17} /></span>
      </a>
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
      if (active && !error && data && data.length) setProducts(data.map(mapCatalogRow))
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

type AdminTab = 'overview' | 'catalog' | 'requests' | 'orders'

function AdminShell() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [email, setEmail] = useState('')
  useEffect(() => { void supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email || 'Admin')) }, [])
  async function signOut() { await supabase?.auth.signOut(); navigate('/admin/login') }
  const navItems: { id: AdminTab; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
    { id: 'catalog', label: 'Katalog', icon: <ShoppingBag size={17} /> },
    { id: 'requests', label: 'Request', icon: <CircleHelp size={17} /> },
    { id: 'orders', label: 'Pesanan', icon: <PackageCheck size={17} /> },
  ]
  return <div className="admin-app">
    <aside className="admin-sidebar"><Link to="/" className="brand"><span className="brand-mark"><ShoppingBag size={18} /></span><span>jastip<span className="brand-script">nisa.</span></span></Link><span className="sidebar-label">WORKSPACE</span><nav>{navItems.map(item => <button key={item.id} className={tab === item.id ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="admin-avatar">N</div><div><strong>Admin</strong><small>{email}</small></div><button onClick={signOut} className="signout-button" aria-label="Keluar"><ArrowUpRight size={16} /></button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">JASTIPNISA / ADMIN</span><h1>{navItems.find(item => item.id === tab)?.label}</h1></div><Link to="/" target="_blank" className="view-public">Lihat halaman publik <ArrowUpRight size={15} /></Link></header><div className="admin-content">{tab === 'overview' && <Overview setTab={setTab} />}{tab === 'catalog' && <CatalogManager />}{tab === 'requests' && <RequestManager />}{tab === 'orders' && <OrdersManager />}</div></main>
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

function RequestManager() {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [productName, setProductName] = useState('')
  const [variant, setVariant] = useState('')
  const [saving, setSaving] = useState(false)
  async function refresh() {
    if (!supabase) return
    const [requestResult, productResult] = await Promise.all([
      supabase.from('requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('catalog_products').select('id,name').eq('is_active', true).order('name'),
    ])
    if (requestResult.error) setNotice('Gagal memuat request. Pastikan migrasi database sudah diterapkan.')
    else setRequests((requestResult.data || []) as Record<string, unknown>[])
    setProducts(productResult.data || [])
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  async function createRequest(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true); setNotice('')
    const { error } = await supabase.from('requests').insert({
      customer_name: customerName.trim(), customer_phone: phone.trim(),
      requested_product_name: productName, requested_variant: variant.trim() || null,
      status: 'new',
    })
    setSaving(false)
    if (error) setNotice('Request gagal disimpan. Periksa data dan koneksi database.')
    else { setNotice('Request berhasil ditambahkan.'); setCustomerName(''); setPhone(''); setProductName(''); setVariant(''); await refresh() }
  }
  async function updateStatus(id: string, status: string) {
    if (!supabase) return
    const { error } = await supabase.from('requests').update({ status }).eq('id', id)
    if (error) setNotice('Status request gagal diperbarui.')
    else { setNotice('Status request diperbarui.'); await refresh() }
  }
  return <div className="admin-view"><div className="admin-section-intro"><div><span className="eyebrow">CUSTOMER WISHLIST</span><h2>Daftar request</h2><p>Catat barang yang dicari dan pantau progres pengecekan admin.</p></div></div>{notice && <div className="inline-notice">{notice}</div>}<div className="admin-panel add-product-panel"><div className="panel-heading"><div><span className="eyebrow">NEW REQUEST</span><h3>Catat request pelanggan</h3></div></div><form className="admin-inline-form request-form" onSubmit={createRequest}><label>Nama pelanggan<input required value={customerName} onChange={e => setCustomerName(e.target.value)} /></label><label>Nomor WhatsApp<input required value={phone} onChange={e => setPhone(e.target.value)} /></label><label>Model produk<select required value={productName} onChange={e => setProductName(e.target.value)}><option value="">Pilih model</option>{products.map(product => <option key={product.id} value={product.name}>{product.name}</option>)}</select></label><label>Warna / catatan<input value={variant} onChange={e => setVariant(e.target.value)} placeholder="Warna atau detail lain" /></label><button className="button button-dark" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Request'}</button></form></div><div className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">REQUEST TRACKER</span><h3>{requests.length} request terbaru</h3></div></div>{loading ? <div className="admin-loading"><span className="spinner" /> Memuat request…</div> : requests.length ? <div className="request-list">{requests.map(request => <div className="request-row" key={String(request.id)}><div className="request-avatar">{String(request.customer_name || 'C').slice(0,1).toUpperCase()}</div><div className="request-detail"><strong>{String(request.requested_product_name)}</strong><span>{String(request.customer_name || 'Nama belum diisi')} · {String(request.customer_phone || 'No. HP belum diisi')}</span><small>{String(request.requested_variant || 'Varian belum ditentukan')} · {new Date(String(request.created_at)).toLocaleDateString('id-ID')}</small></div><select aria-label={`Status request ${String(request.requested_product_name)}`} value={String(request.status)} onChange={e => void updateStatus(String(request.id), e.target.value)}><option value="new">Baru</option><option value="deposit_received">Deposit diterima</option><option value="searching">Sedang dicari</option><option value="found">Ditemukan</option><option value="not_found">Tidak ditemukan</option><option value="converted">Menjadi order</option><option value="cancelled">Dibatalkan</option></select></div>)}</div> : <div className="empty-state"><CircleHelp size={24} /><strong>Belum ada request</strong><span>Request pelanggan yang dicatat akan tampil di sini.</span></div>}</div></div>
}

function OrdersManager() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) return
      const { data, error } = await supabase.from('orders').select('id,order_code,customer_name,customer_phone,total_amount,status,payment_status,created_at,checkout_method,shopee_username').order('created_at', { ascending: false }).limit(100)
      if (alive) {
        if (error) setNotice('Gagal memuat data pesanan. Periksa migrasi database.')
        else setOrders((data || []) as Record<string, unknown>[])
        setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [])
  return <div className="admin-view"><div className="admin-section-intro"><div><span className="eyebrow">ORDER MANAGEMENT</span><h2>Pesanan pelanggan</h2><p>Daftar pesanan yang sudah dibuat admin setelah ketersediaan dan detail order dikonfirmasi.</p></div></div>{notice && <div className="inline-notice">{notice}</div>}<div className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">ALL ORDERS</span><h3>{orders.length} pesanan</h3></div></div>{loading ? <div className="admin-loading"><span className="spinner" /> Memuat pesanan…</div> : orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Pelanggan</th><th>Total</th><th>Pembayaran</th><th>Status</th></tr></thead><tbody>{orders.map(order => <tr key={String(order.id)}><td><strong>{String(order.order_code)}</strong><small>{new Date(String(order.created_at)).toLocaleDateString('id-ID')}</small></td><td><strong>{String(order.customer_name)}</strong><small>{String(order.customer_phone)}</small></td><td>{formatRupiah(Number(order.total_amount))}</td><td><span className="status-pill status-muted">{String(order.payment_status)}</span></td><td><span className="status-pill status-active">{String(order.status)}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><PackageCheck size={24} /><strong>Belum ada pesanan</strong><span>Pesanan yang dicatat melalui alur admin akan muncul di sini.</span></div>}</div><div className="admin-inline-note"><Wallet size={17} /> Pencatatan pembayaran, deposit, refund dan pengiriman akan diaktifkan pada slice operasional berikutnya setelah aturan deposit final ditentukan.</div></div>
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
