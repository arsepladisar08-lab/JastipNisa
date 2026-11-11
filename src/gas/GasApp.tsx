import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  addAdminUnit,
  addAdminExpense,
  addAdminPayment,
  adminLogin,
  assignAdminUnit,
  confirmCustomerShopee,
  createAdminOrder,
  createRequest,
  getAdminDashboard,
  getAdminFinancialSummary,
  getAdminPaymentProof,
  getCustomerPhoto,
  getCustomerPortal,
  getPublicCatalog,
  getPublicConfig,
  listAdminCatalog,
  listAdminExpenses,
  listAdminOrders,
  listAdminRequests,
  logoutAdmin,
  respondToRequestItem,
  reissueCustomerAccessToken,
  revokeCustomerAccessToken,
  saveAdminCatalogProduct,
  saveAdminVariant,
  submitOrderDetails,
  updateAdminOrderOptions,
  updateAdminRequestItem,
  updateAdminShipment,
  uploadAdminPaymentProof,
  uploadAdminRequestPhoto,
  verifyAdminPayment,
  type AdminCatalogProduct,
  type AdminCatalogVariant,
  type AdminDashboard,
  type AdminExpense,
  type AdminFinancialSummary,
  type AdminOrder,
  type AdminRequestGroup,
  type CatalogProduct,
  type CatalogVariant,
  type CustomerPortal,
} from '../lib/gasClient'

const ACCESS_TOKEN_KEY = 'jn.customer.access-token'
const ADMIN_SESSION_KEY = 'jn.admin.session-token'
const ADMIN_LOGIN_CLIENT_KEY = 'jn.admin.login-client'

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function calculateFee(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 15000
  return 25000 + (count - 2) * 10000
}

function createSecureToken() {
  const bytes = new Uint8Array(32)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function displayStatus(status: string) {
  const labels: Record<string, string> = {
    new: 'Baru masuk',
    searching: 'Sedang dicari',
    found: 'Barang ditemukan',
    not_found: 'Belum ditemukan',
    partial_availability: 'Sebagian tersedia',
    awaiting_customer_approval: 'Menunggu persetujuan',
    customer_details_received: 'Format order diterima',
    order_created: 'Pesanan dibuat',
    confirmed: 'Pesanan dikonfirmasi',
    packing: 'Sedang packing',
    shipped: 'Dikirim',
    completed: 'Selesai',
    unpaid: 'Belum dibayar',
    partially_paid: 'Pembayaran sebagian',
    paid: 'Lunas',
  }
  return labels[status] || status.replaceAll('_', ' ')
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="jn-app">
      <header className="jn-header">
        <Link to="/" className="jn-brand"><span className="jn-brand-mark">JN</span><span>JastipNisa<small>Personal shopping assistant</small></span></Link>
        <nav>
          <Link to="/">Beranda</Link>
          <Link to="/portal">Lacak request</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main className="jn-main">{children}</main>
      <footer className="jn-footer">JastipNisa · Katalog adalah referensi produk, bukan konfirmasi stok fisik.</footer>
    </div>
  )
}

type CartLine = { productId: string; variantId: string; quantity: number }

function HomePage() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [variants, setVariants] = useState<CatalogVariant[]>([])
  const [config, setConfig] = useState<Record<string, string>>({})
  const [cart, setCart] = useState<CartLine[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ code: string; token: string } | null>(null)
  const [submissionAttempt, setSubmissionAttempt] = useState<{ submissionId: string; accessToken: string } | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getPublicCatalog(), getPublicConfig()])
      .then(([catalog, publicConfig]) => {
        if (!active) return
        setProducts(catalog.products)
        setVariants(catalog.variants)
        setConfig(publicConfig)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Katalog belum dapat dimuat.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const totalQuantity = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart])
  const fee = useMemo(() => calculateFee(totalQuantity), [totalQuantity])

  function updateCart(productId: string, variantId: string, quantity: number) {
    setSubmissionAttempt(null)
    setCreated(null)
    setCart((current) => {
      // One selected variant per product per request group keeps the selector and cart in sync.
      const next = current.filter((line) => line.productId !== productId)
      if (quantity > 0) next.push({ productId, variantId, quantity })
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!cart.length) {
      setError('Tambahkan minimal satu produk ke daftar request.')
      return
    }
    setSubmitting(true)
    const attempt = submissionAttempt || {
      accessToken: createSecureToken(),
      submissionId: window.crypto.randomUUID(),
    }
    if (!submissionAttempt) setSubmissionAttempt(attempt)
    try {
      const result = await createRequest({
        customerName: name.trim(),
        phone: phone.trim(),
        submissionId: attempt.submissionId,
        accessToken: attempt.accessToken,
        items: cart.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || undefined,
          quantity: line.quantity,
        })),
      })
      sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
      setCreated({ code: result.requestCode, token: result.accessToken })
      setSubmissionAttempt(null)
      setCart([])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request belum dapat dikirim.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <section className="jn-hero">
        <div className="jn-hero-copy">
          <span className="jn-eyebrow">PERSONAL SHOPPING · FLICKA REFERENCE CATALOG</span>
          <h1>Temukan yang kamu cari. <em>Biar kami bantu buru.</em></h1>
          <p>Ajukan model dan warna yang kamu inginkan. Admin akan memeriksa ketersediaan, mengirim foto aktual, lalu membantu proses pesanan dan pengiriman.</p>
          <div className="jn-hero-actions"><a href="#catalog" className="jn-button jn-button-primary">Lihat katalog</a><Link to="/portal" className="jn-button jn-button-quiet">Lacak request</Link></div>
          <div className="jn-hero-note">{config.public_notice || 'Katalog merupakan referensi model. Ketersediaan dan kondisi barang dikonfirmasi admin.'}</div>
        </div>
        <div className="jn-hero-stamp"><span>JASTIP</span><strong>NISA</strong><small>curated finds, personal help</small></div>
      </section>

      <section className="jn-benefits">
        <div><strong>01</strong><span>Ajukan wishlist</span><small>Pilih model, varian, dan jumlah.</small></div>
        <div><strong>02</strong><span>Admin cek barang</span><small>Ketersediaan dan foto aktual.</small></div>
        <div><strong>03</strong><span>Konfirmasi & proses</span><small>Isi detail dan pilih jalur checkout.</small></div>
      </section>

      <section className="jn-section" id="catalog">
        <div className="jn-section-heading"><div><span className="jn-eyebrow">REFERENCE CATALOG</span><h2>Pilih wishlist kamu</h2><p>Harga di katalog resmi adalah referensi, bukan harga final JastipNisa.</p></div><span className="jn-count">{products.length} model</span></div>
        {loading ? <div className="jn-state">Memuat katalog…</div> : error ? <div className="jn-alert jn-alert-error">{error}</div> : products.length === 0 ? <div className="jn-empty"><strong>Katalog belum tersedia.</strong><span>Admin perlu memasukkan model referensi yang sudah diperiksa ke database JastipNisa.</span></div> : (
          <div className="jn-product-grid">
            {products.map((product) => {
              const choices = variants.filter((variant) => variant.productId === product.productId)
              const selected = cart.find((line) => line.productId === product.productId)
              return (
                <article className="jn-product-card" key={product.productId}>
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <div className="jn-product-placeholder">JASTIPNISA</div>}
                  <div className="jn-product-body">
                    <span className="jn-category">{product.category || 'Flicka bag'}</span>
                    <h3>{product.name}</h3>
                    <p className="jn-reference-price">Harga referensi {formatRupiah(product.referencePrice)}</p>
                    {choices.length > 0 && <label className="jn-field">Varian
                      <select value={selected?.variantId || ''} onChange={(event) => updateCart(product.productId, event.target.value, selected?.quantity || 0)}>
                        <option value="">Pilih warna / varian</option>
                        {choices.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.name}</option>)}
                      </select>
                    </label>}
                    <div className="jn-product-actions">
                      <button type="button" className="jn-button jn-button-outline" disabled={choices.length > 0 && !selected?.variantId} onClick={() => updateCart(product.productId, selected?.variantId || '', (selected?.quantity || 0) + 1)}>
                        {selected ? 'Ditambahkan (' + selected.quantity + ')' : 'Tambah wishlist'}
                      </button>
                      {product.officialUrl && <a href={product.officialUrl} target="_blank" rel="noreferrer" className="jn-text-link">Sumber resmi ↗</a>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="jn-section jn-request-section">
        <div className="jn-section-heading"><div><span className="jn-eyebrow">REQUEST CART</span><h2>Daftar titipan</h2><p>Fee dihitung per jumlah unit dalam satu request group.</p></div></div>
        {cart.length === 0 ? <div className="jn-empty"><strong>Wishlist kamu masih kosong.</strong><span>Tambahkan produk dari katalog untuk memulai request.</span></div> : (
          <div className="jn-cart">
            {cart.map((line) => {
              const product = products.find((item) => item.productId === line.productId)
              const variant = variants.find((item) => item.variantId === line.variantId)
              return <div className="jn-cart-line" key={line.productId + line.variantId}>
                <div><strong>{product?.name || 'Produk'}</strong><small>{variant?.name || 'Varian belum dipilih'}</small></div>
                <div className="jn-quantity"><button type="button" onClick={() => updateCart(line.productId, line.variantId, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" onClick={() => updateCart(line.productId, line.variantId, line.quantity + 1)}>+</button></div>
                <button type="button" className="jn-remove" onClick={() => updateCart(line.productId, line.variantId, 0)}>Hapus</button>
              </div>
            })}
            <div className="jn-fee-preview"><span>{totalQuantity} produk</span><strong>Estimasi fee {formatRupiah(fee)}</strong></div>
          </div>
        )}
        <form className="jn-form jn-request-form" onSubmit={handleSubmit}>
          <div className="jn-form-grid">
            <label className="jn-field">Nama pemesan<input required minLength={2} maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setSubmissionAttempt(null); setCreated(null) }} placeholder="Nama lengkap" /></label>
            <label className="jn-field">Nomor WhatsApp<input required minLength={8} maxLength={30} value={phone} onChange={(event) => { setPhone(event.target.value); setSubmissionAttempt(null); setCreated(null) }} placeholder="08xxxxxxxxxx" /></label>
          </div>
          {error && <div className="jn-alert jn-alert-error">{error}</div>}
          {submissionAttempt && <p className="jn-muted">Pengiriman sebelumnya belum mendapat konfirmasi. Klik kirim lagi tanpa mengubah isi formulir untuk melanjutkan pengajuan yang sama, bukan membuat request baru.</p>}
          <button className="jn-button jn-button-primary" type="submit" disabled={submitting || cart.length === 0}>{submitting ? 'Mengirim request…' : submissionAttempt ? 'Coba kirim request lagi' : 'Kirim request wishlist'}</button>
        </form>
        {created && <div className="jn-created">
          <span className="jn-eyebrow">REQUEST TERCATAT</span><h3>{created.code}</h3>
          <p>Simpan token berikut. Token ini adalah kunci untuk membuka status request kamu dan tidak akan ditampilkan lagi setelah sesi browser berakhir.</p>
          <code>{created.token}</code>
          <button type="button" className="jn-button jn-button-outline" onClick={() => void navigator.clipboard?.writeText(created.token)}>Salin token akses</button>
          <Link className="jn-button jn-button-primary" to="/portal">Lihat status request</Link>
        </div>}
      </section>
    </AppShell>
  )
}

function PortalPage() {
  const [tokenInput, setTokenInput] = useState(() => sessionStorage.getItem(ACCESS_TOKEN_KEY) || '')
  const [activeToken, setActiveToken] = useState('')
  const [portal, setPortal] = useState<CustomerPortal | null>(null)
  const [photos, setPhotos] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [busyItem, setBusyItem] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [shopeeUsername, setShopeeUsername] = useState('')

  const refresh = useCallback(async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await getCustomerPortal(token)
      setPortal(data)
      const photoEntries = await Promise.all(data.items.filter((item) => item.photoCount > 0).map(async (item) => {
        const loaded = await Promise.all(Array.from({ length: item.photoCount }, async (_value, index) => {
          const photo = await getCustomerPhoto(token, item.requestId, index)
          return 'data:' + photo.mimeType + ';base64,' + photo.base64
        }))
        return [item.requestId, loaded] as const
      }))
      setPhotos(Object.fromEntries(photoEntries))
    } catch (reason) {
      setPortal(null)
      setPhotos({})
      setError(reason instanceof Error ? reason.message : 'Status request belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (saved) {
      setTokenInput(saved)
      setActiveToken(saved)
      void refresh(saved)
    }
  }, [refresh])

  function openPortal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = tokenInput.trim()
    if (!token) return
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
    setActiveToken(token)
    setNotice('')
    void refresh(token)
  }

  async function decide(requestId: string, decision: 'approved' | 'rejected') {
    setBusyItem(requestId)
    setError('')
    try {
      await respondToRequestItem(activeToken, requestId, decision)
      setNotice(decision === 'approved' ? 'Persetujuan foto berhasil dicatat.' : 'Penolakan foto berhasil dicatat. Admin akan meninjau tindak lanjutnya.')
      await refresh(activeToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Keputusan belum dapat disimpan.')
    } finally {
      setBusyItem('')
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await submitOrderDetails(activeToken, { name, phone, address })
      setNotice('Format order berhasil dikirim ke admin.')
      await refresh(activeToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Format order belum dapat disimpan.')
    }
  }

  async function submitShopee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await confirmCustomerShopee(activeToken, shopeeUsername)
      setNotice('Nama akun Shopee berhasil dikonfirmasi.')
      await refresh(activeToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Konfirmasi Shopee belum dapat disimpan.')
    }
  }

  const canSubmitDetails = Boolean(portal?.items.length) && portal!.items.every((item) =>
    item.status === 'found' && item.customerDecision === 'approved',
  )

  return (
    <AppShell>
      <section className="jn-page-heading"><span className="jn-eyebrow">CUSTOMER PORTAL</span><h1>Lacak request kamu</h1><p>Masukkan token akses yang diberikan setelah request berhasil dikirim. Jangan bagikan token ini kepada orang lain.</p></section>
      <form className="jn-form jn-token-form" onSubmit={openPortal}>
        <label className="jn-field">Token akses<input required value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="Tempel token akses di sini" /></label>
        <button className="jn-button jn-button-primary" disabled={loading}>{loading ? 'Memuat…' : 'Buka status request'}</button>
      </form>
      {error && <div className="jn-alert jn-alert-error">{error}</div>}
      {notice && <div className="jn-alert jn-alert-success">{notice}</div>}
      {portal && <section className="jn-panel jn-portal-card">
        <div className="jn-panel-heading"><div><span className="jn-eyebrow">REQUEST CODE</span><h2>{portal.requestCode}</h2></div><span className="jn-status">{displayStatus(portal.status)}</span></div>
        <p className="jn-muted">Dibuat {new Date(portal.createdAt).toLocaleString('id-ID')}</p>
        <div className="jn-portal-items">
          {portal.items.map((item) => <article className="jn-portal-item" key={item.requestId}>
            <div className="jn-portal-item-head"><div><strong>{item.productName}</strong><small>{item.variantName || 'Varian tidak ditentukan'} · {item.quantity} pcs</small></div><span className="jn-status">{displayStatus(item.status)}</span></div>
            {item.actualCondition && <p className="jn-condition">{item.actualCondition}</p>}
            {photos[item.requestId]?.length > 0 && <div className="jn-photo-grid">{photos[item.requestId].map((src, index) => <img key={index} src={src} alt={'Foto aktual ' + item.productName + ' ' + (index + 1)} />)}</div>}
            {item.status === 'found' && item.photoCount > 0 && !item.customerDecision && <div className="jn-inline-actions"><button type="button" disabled={busyItem === item.requestId} className="jn-button jn-button-primary" onClick={() => void decide(item.requestId, 'approved')}>Setujui barang</button><button type="button" disabled={busyItem === item.requestId} className="jn-button jn-button-outline" onClick={() => void decide(item.requestId, 'rejected')}>Belum setuju</button></div>}
            {item.customerDecision && <p className="jn-muted">Keputusan kamu: {item.customerDecision === 'approved' ? 'Disetujui' : 'Belum disetujui'}</p>}
          </article>)}
        </div>
        {canSubmitDetails && !portal.order && <form className="jn-form jn-customer-details" onSubmit={submitDetails}>
          <div><span className="jn-eyebrow">FINAL ORDER DETAILS</span><h3>Lengkapi format order</h3><p>Seluruh foto aktual telah disetujui. Isi data pengiriman agar admin dapat membuat pesanan final.</p></div>
          <label className="jn-field">Nama lengkap<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="jn-field">Nomor WhatsApp<input required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label className="jn-field">Alamat lengkap<textarea required rows={3} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <button className="jn-button jn-button-primary">Kirim format order</button>
        </form>}
        {portal.order && <div className="jn-order-summary"><span className="jn-eyebrow">FINAL ORDER</span><h3>{portal.order.orderCode}</h3><p>Status: {displayStatus(portal.order.status)} · Pembayaran: {displayStatus(portal.order.paymentStatus)}</p><strong>{formatRupiah(portal.order.totalAmount)}</strong>{portal.order.courier && <p>{portal.order.courier} · {portal.order.trackingNumber}</p>}
          {portal.order.shopeeCheckoutUrl && <form className="jn-form" onSubmit={submitShopee}><label className="jn-field">Nama akun Shopee<input required value={shopeeUsername} onChange={(event) => setShopeeUsername(event.target.value)} /></label><button className="jn-button jn-button-primary">Konfirmasi akun Shopee</button></form>}
        </div>}
      </section>}
    </AppShell>
  )
}

function AdminLoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      let clientId = sessionStorage.getItem(ADMIN_LOGIN_CLIENT_KEY)
      if (!clientId) {
        clientId = createSecureToken()
        sessionStorage.setItem(ADMIN_LOGIN_CLIENT_KEY, clientId)
      }
      const result = await adminLogin(password, clientId)
      sessionStorage.setItem(ADMIN_SESSION_KEY, result.sessionToken)
      navigate('/admin', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login gagal.')
    } finally {
      setBusy(false)
    }
  }
  return <AppShell><section className="jn-login-wrap"><div className="jn-login-card"><span className="jn-eyebrow">PRIVATE WORKSPACE</span><h1>Admin JastipNisa</h1><p>Masuk menggunakan password admin yang sudah diatur pada Apps Script.</p><form className="jn-form" onSubmit={submit}><label className="jn-field">Password admin<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="jn-alert jn-alert-error">{error}</div>}<button className="jn-button jn-button-primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk workspace'}</button></form></div></section></AppShell>
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const separator = result.indexOf(',')
      if (separator < 0) reject(new Error('File foto tidak dapat dibaca.'))
      else resolve(result.slice(separator + 1))
    }
    reader.onerror = () => reject(new Error('File foto gagal dibaca.'))
    reader.readAsDataURL(file)
  })
}

function AdminPage() {
  const navigate = useNavigate()
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) || '')
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [groups, setGroups] = useState<AdminRequestGroup[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [expenses, setExpenses] = useState<AdminExpense[]>([])
  const [financialSummary, setFinancialSummary] = useState<AdminFinancialSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({})
  const [tokenActionGroup, setTokenActionGroup] = useState('')

  const refresh = useCallback(async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const [stats, requests, orderList, expenseList, finance] = await Promise.all([
        getAdminDashboard(token),
        listAdminRequests(token, 'all'),
        listAdminOrders(token),
        listAdminExpenses(token),
        getAdminFinancialSummary(token),
      ])
      setDashboard(stats)
      setGroups(requests)
      setOrders(orderList)
      setExpenses(expenseList)
      setFinancialSummary(finance)
    } catch (reason) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY)
      setSessionToken('')
      setError(reason instanceof Error ? reason.message : 'Workspace belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionToken) void refresh(sessionToken)
  }, [sessionToken, refresh])

  async function signOut() {
    try { await logoutAdmin(sessionToken) } catch { /* clear the local token even if the server session already expired */ }
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setSessionToken('')
    navigate('/admin/login', { replace: true })
  }

  async function reissueCustomerToken(groupId: string) {
    setError('')
    setTokenActionGroup(groupId)
    try {
      const result = await reissueCustomerAccessToken(sessionToken, groupId)
      setIssuedTokens((current) => ({ ...current, [groupId]: result.accessToken }))
      setNotice('Token baru untuk ' + result.requestCode + ' berhasil diterbitkan. Token lama langsung tidak berlaku; salin dan kirim token baru melalui kanal privat.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Token akses baru belum dapat diterbitkan.')
    } finally {
      setTokenActionGroup('')
    }
  }

  async function revokeCustomerToken(groupId: string) {
    if (!window.confirm('Cabut akses portal pelanggan untuk request ini? Token yang sedang digunakan akan langsung tidak berlaku.')) return
    setError('')
    setTokenActionGroup(groupId)
    try {
      await revokeCustomerAccessToken(sessionToken, groupId)
      setIssuedTokens((current) => {
        const next = { ...current }
        delete next[groupId]
        return next
      })
      setNotice('Akses portal pelanggan berhasil dicabut.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Akses portal belum dapat dicabut.')
    } finally {
      setTokenActionGroup('')
    }
  }

  async function copyCustomerToken(groupId: string) {
    const token = issuedTokens[groupId]
    if (!token) return
    if (!navigator.clipboard?.writeText) {
      setNotice('Clipboard tidak tersedia. Salin token yang ditampilkan secara manual.')
      return
    }
    try {
      await navigator.clipboard.writeText(token)
      setNotice('Token akses berhasil disalin. Kirim kepada pelanggan melalui kanal privat.')
    } catch {
      setNotice('Token belum dapat disalin otomatis. Salin token yang ditampilkan secara manual.')
    }
  }

  if (!sessionToken) return <Navigate to="/admin/login" replace />

  async function updateItem(requestId: string, status: 'new' | 'searching' | 'found' | 'not_found', actualCondition: string) {
    setError('')
    try {
      await updateAdminRequestItem(sessionToken, { requestId, status, actualCondition })
      setNotice('Status request berhasil diperbarui.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Status tidak dapat disimpan.')
    }
  }

  async function uploadPhoto(requestId: string, file?: File) {
    if (!file) return
    setError('')
    if (file.size > 700000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Gunakan foto JPG, PNG, atau WebP maksimal 700 KB.')
      return
    }
    try {
      const base64 = await fileToBase64(file)
      await uploadAdminRequestPhoto(sessionToken, { requestId, fileName: file.name, mimeType: file.type, base64 })
      setNotice('Foto aktual berhasil diunggah ke Drive privat.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload foto gagal.')
    }
  }

  async function addAndAssignUnit(item: AdminRequestGroup['items'][number], form: HTMLFormElement) {
    const values = new FormData(form)
    const unitCode = String(values.get('unitCode') || '').trim()
    const purchasePrice = Number(values.get('purchasePrice') || 0)
    const sellingPrice = Number(values.get('sellingPrice') || 0)
    if (!unitCode || sellingPrice <= 0) {
      setError('Kode unit dan harga jual final harus diisi.')
      return
    }
    try {
      const created = await addAdminUnit(sessionToken, {
        unitCode,
        productId: item.productId,
        variantId: item.variantId || undefined,
        purchasePrice,
        sellingPrice,
      })
      const assigned = await assignAdminUnit(sessionToken, item.requestId, created.unitId)
      setNotice('Unit ditambahkan dan dialokasikan (' + assigned.assignedCount + '/' + assigned.requiredCount + ').')
      form.reset()
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unit belum dapat dialokasikan.')
    }
  }

  async function saveDeposit(groupId: string, form: HTMLFormElement) {
    const values = new FormData(form)
    const amount = Number(values.get('amount') || 0)
    const method = String(values.get('method') || 'bank_transfer')
    const notes = String(values.get('notes') || '')
    const proof = values.get('proof')
    if (!Number.isFinite(amount) || amount <= 0 || !(proof instanceof File) || proof.size === 0) {
      setError('Nominal deposit dan bukti pembayaran wajib diisi.')
      return
    }
    if (proof.size > 700000 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(proof.type)) {
      setError('Bukti pembayaran harus JPG, PNG, WebP, atau PDF maksimal 700 KB.')
      return
    }
    setError('')
    try {
      const base64 = await fileToBase64(proof)
      const uploaded = await uploadAdminPaymentProof(sessionToken, {
        fileName: proof.name,
        mimeType: proof.type,
        base64,
      })
      await addAdminPayment(sessionToken, {
        requestGroupId: groupId,
        type: 'deposit',
        amount,
        method,
        proofFileId: uploaded.fileId,
        idempotencyKey: window.crypto.randomUUID(),
        notes,
      })
      setNotice('Deposit dicatat. Lanjutkan dengan memeriksa bukti lalu klik verifikasi.')
      form.reset()
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Deposit belum dapat dicatat.')
    }
  }

  async function viewPaymentProof(paymentId: string) {
    setError('')
    try {
      return await getAdminPaymentProof(sessionToken, paymentId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Bukti pembayaran tidak dapat dibuka.')
      throw reason
    }
  }

  async function verifyDeposit(paymentId: string, decision: 'verified' | 'rejected') {
    setError('')
    try {
      await verifyAdminPayment(sessionToken, paymentId, decision)
      setNotice(decision === 'verified' ? 'Deposit berhasil diverifikasi.' : 'Bukti deposit ditolak.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Verifikasi deposit gagal.')
    }
  }

  async function makeFinalOrder(groupId: string) {
    try {
      const order = await createAdminOrder(sessionToken, groupId)
      setNotice('Pesanan ' + order.orderCode + ' berhasil dibuat. Fee ' + formatRupiah(order.fee) + '.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Order final belum dapat dibuat.')
    }
  }

  async function saveSettlement(orderId: string, form: HTMLFormElement) {
    const values = new FormData(form)
    const amount = Number(values.get('amount') || 0)
    const method = String(values.get('method') || 'bank_transfer')
    const type = String(values.get('type') || 'settlement')
    const notes = String(values.get('notes') || '')
    const proof = values.get('proof')
    if (!Number.isFinite(amount) || amount <= 0 || !(proof instanceof File) || proof.size === 0) {
      setError('Nominal pembayaran dan bukti wajib diisi.')
      return
    }
    if (proof.size > 700000 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(proof.type)) {
      setError('Bukti pembayaran harus JPG, PNG, WebP, atau PDF maksimal 700 KB.')
      return
    }
    if (type !== 'settlement' && type !== 'shopee') {
      setError('Tipe pembayaran tidak didukung.')
      return
    }
    try {
      const base64 = await fileToBase64(proof)
      const uploaded = await uploadAdminPaymentProof(sessionToken, {
        fileName: proof.name,
        mimeType: proof.type,
        base64,
      })
      await addAdminPayment(sessionToken, {
        orderId,
        type: type as 'settlement' | 'shopee',
        amount,
        method,
        proofFileId: uploaded.fileId,
        idempotencyKey: window.crypto.randomUUID(),
        notes,
      })
      setNotice('Pembayaran dicatat dan menunggu verifikasi admin.')
      form.reset()
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pembayaran belum dapat dicatat.')
    }
  }

  async function updateShipment(orderId: string, form: HTMLFormElement) {
    const values = new FormData(form)
    try {
      await updateAdminShipment(sessionToken, {
        orderId,
        courier: String(values.get('courier') || ''),
        trackingNumber: String(values.get('trackingNumber') || ''),
        status: String(values.get('status') || 'preparing') as 'preparing' | 'shipped' | 'delivered' | 'issue',
        notes: String(values.get('notes') || ''),
      })
      setNotice('Status dan detail pengiriman berhasil disimpan.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pengiriman belum dapat diperbarui.')
    }
  }

  async function saveShopeeLink(orderId: string, form: HTMLFormElement) {
    const values = new FormData(form)
    try {
      await updateAdminOrderOptions(sessionToken, {
        orderId,
        shopeeCheckoutUrl: String(values.get('shopeeCheckoutUrl') || '').trim(),
      })
      setNotice('Link checkout Shopee diperbarui.')
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Link checkout belum dapat disimpan.')
    }
  }

  async function saveExpense(form: HTMLFormElement) {
    const values = new FormData(form)
    const amount = Number(values.get('amount') || 0)
    const occurredAt = String(values.get('occurredAt') || '')
    const category = String(values.get('category') || '')
    const description = String(values.get('description') || '')
    if (!Number.isFinite(amount) || amount <= 0 || !category || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) {
      setError('Periksa kategori, nominal, dan tanggal pengeluaran.')
      return
    }
    try {
      await addAdminExpense(sessionToken, {
        amount,
        occurredAt,
        category,
        description,
        idempotencyKey: window.crypto.randomUUID(),
      })
      setNotice('Pengeluaran berhasil dicatat.')
      form.reset()
      await refresh(sessionToken)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pengeluaran gagal dicatat.')
    }
  }

  return <AppShell>
    <div className="jn-admin-top"><div><span className="jn-eyebrow">OPERATIONS</span><h1>Admin workspace</h1><p>Kelola request, pencarian barang, unit fisik dan pesanan.</p></div><button type="button" className="jn-button jn-button-outline" onClick={() => void signOut()}>Keluar</button></div>
    {error && <div className="jn-alert jn-alert-error">{error}</div>}
    {notice && <div className="jn-alert jn-alert-success">{notice}</div>}
    {dashboard && <div className="jn-stat-grid">
      <div><span>Request aktif</span><strong>{dashboard.requestGroups}</strong></div>
      <div><span>Sedang dicari</span><strong>{dashboard.itemsSearching}</strong></div>
      <div><span>Barang ditemukan</span><strong>{dashboard.itemsFound}</strong></div>
      <div><span>Unit tersedia</span><strong>{dashboard.unitsAvailable}</strong></div>
      <div><span>Order aktif</span><strong>{dashboard.activeOrders}</strong></div>
      <div><span>Pembayaran perlu dicek</span><strong>{dashboard.paymentsAwaitingVerification}</strong></div>
    </div>}
    <CatalogManager sessionToken={sessionToken} onNotice={setNotice} onError={setError} />
    <section className="jn-section jn-admin-requests"><div className="jn-section-heading"><div><span className="jn-eyebrow">CUSTOMER REQUESTS</span><h2>Daftar request</h2><p>Periksa item, perbarui status pencarian, dan catat unit aktual.</p></div><button className="jn-button jn-button-outline" onClick={() => void refresh(sessionToken)}>Refresh</button></div>
      {loading && <div className="jn-state">Memuat data operasional…</div>}
      {!loading && groups.length === 0 && <div className="jn-empty"><strong>Belum ada request.</strong><span>Request pelanggan yang masuk akan muncul di sini.</span></div>}
      <div className="jn-admin-list">
        {groups.map((group) => <article className="jn-admin-group" key={group.requestGroupId}>
          <div className="jn-admin-group-head"><div><span className="jn-eyebrow">{group.requestCode}</span><h3>{group.customerName}</h3><small>{group.customerPhone} · {group.customerAddress || 'Alamat belum diisi'} · {new Date(group.createdAt).toLocaleString('id-ID')}</small></div><span className="jn-status">{displayStatus(group.status)}</span></div>
          <div className="jn-token-management">
            <div className="jn-token-management-copy">
              <strong>Akses portal pelanggan: {group.hasActiveAccessToken ? 'Aktif' : 'Tidak aktif'}</strong>
              <p>Terbitkan ulang token ketika pelanggan kehilangan akses. Token lama otomatis tidak berlaku setelah token baru diterbitkan.</p>
              {issuedTokens[group.requestGroupId] && <div className="jn-issued-token">
                <small>Token baru untuk {group.requestCode} — kirim secara privat</small>
                <code>{issuedTokens[group.requestGroupId]}</code>
              </div>}
            </div>
            <div className="jn-inline-actions">
              <button type="button" className="jn-button jn-button-outline" disabled={tokenActionGroup === group.requestGroupId} onClick={() => void reissueCustomerToken(group.requestGroupId)}>
                {tokenActionGroup === group.requestGroupId ? 'Memproses…' : 'Terbitkan ulang token'}
              </button>
              {issuedTokens[group.requestGroupId] && <button type="button" className="jn-button jn-button-primary" onClick={() => void copyCustomerToken(group.requestGroupId)}>Salin token</button>}
              {group.hasActiveAccessToken && <button type="button" className="jn-button jn-button-outline" disabled={tokenActionGroup === group.requestGroupId} onClick={() => void revokeCustomerToken(group.requestGroupId)}>Cabut akses</button>}
            </div>
          </div>
          <RequestPayments group={group} onAddPayment={saveDeposit} onVerifyPayment={verifyDeposit} onViewProof={viewPaymentProof} />
          {group.items.map((item) => <RequestEditor key={item.requestId} item={item} onUpdate={updateItem} onUpload={uploadPhoto} onAddUnit={addAndAssignUnit} />)}
          {group.status === 'customer_details_received' && group.verifiedDepositAmount > 0 && <div className="jn-finalize"><p>Deposit terverifikasi {formatRupiah(group.verifiedDepositAmount)}. Pastikan seluruh unit teralokasi dan harga final telah terisi.</p><button className="jn-button jn-button-primary" onClick={() => void makeFinalOrder(group.requestGroupId)}>Buat pesanan final</button></div>}
          {group.status === 'customer_details_received' && group.verifiedDepositAmount <= 0 && <div className="jn-finalize"><p>Pesanan final belum dapat dibuat. Catat dan verifikasi deposit pelanggan terlebih dahulu. Nominal deposit mengikuti kesepakatan admin dengan pelanggan.</p></div>}
          {group.status === 'order_creating' && group.orderId && <div className="jn-finalize"><p>Pembuatan order sebelumnya terhenti. Gunakan pemulihan untuk melanjutkan tanpa membuat order duplikat.</p><button className="jn-button jn-button-primary" onClick={() => void makeFinalOrder(group.requestGroupId)}>Pulihkan pembuatan order</button></div>}
        </article>)}
      </div>
    </section>
    <OrdersManager
      orders={orders}
      onAddPayment={saveSettlement}
      onVerifyPayment={verifyDeposit}
      onViewProof={viewPaymentProof}
      onUpdateShipment={updateShipment}
      onSaveShopeeLink={saveShopeeLink}
    />
    <FinanceManager
      summary={financialSummary}
      expenses={expenses}
      onAddExpense={saveExpense}
    />
  </AppShell>
}

function CatalogManager({
  sessionToken,
  onNotice,
  onError,
}: {
  sessionToken: string
  onNotice: (message: string) => void
  onError: (message: string) => void
}) {
  const [products, setProducts] = useState<AdminCatalogProduct[]>([])
  const [variants, setVariants] = useState<AdminCatalogVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProductId, setEditingProductId] = useState('')
  const [editingVariantId, setEditingVariantId] = useState('')
  const [productForm, setProductForm] = useState({
    name: '', slug: '', category: 'Tas', referencePrice: '', officialUrl: 'https://www.flickabags.com/products',
    imageUrl: '', sourceCheckedAt: new Date().toISOString().slice(0, 10), sortOrder: '0', isActive: true,
  })
  const [variantForm, setVariantForm] = useState({ productId: '', name: '', imageUrl: '', isActive: true })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminCatalog(sessionToken)
      setProducts(data.products)
      setVariants(data.variants)
      setVariantForm((current) => ({
        ...current,
        productId: current.productId || data.products[0]?.productId || '',
      }))
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Katalog admin tidak dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }, [sessionToken, onError])

  useEffect(() => { void refresh() }, [refresh])

  function resetProduct() {
    setEditingProductId('')
    setProductForm({
      name: '', slug: '', category: 'Tas', referencePrice: '', officialUrl: 'https://www.flickabags.com/products',
      imageUrl: '', sourceCheckedAt: new Date().toISOString().slice(0, 10), sortOrder: '0', isActive: true,
    })
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onError('')
    try {
      await saveAdminCatalogProduct(sessionToken, {
        productId: editingProductId || undefined,
        name: productForm.name.trim(),
        slug: productForm.slug.trim(),
        category: productForm.category,
        referencePrice: Number(productForm.referencePrice || 0),
        officialUrl: productForm.officialUrl.trim(),
        imageUrl: productForm.imageUrl.trim(),
        sourceCheckedAt: productForm.sourceCheckedAt,
        sortOrder: Number(productForm.sortOrder || 0),
        isActive: productForm.isActive,
      })
      onNotice(editingProductId ? 'Produk katalog diperbarui.' : 'Produk katalog ditambahkan.')
      resetProduct()
      await refresh()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Produk katalog gagal disimpan.')
    }
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onError('')
    try {
      await saveAdminVariant(sessionToken, {
        variantId: editingVariantId || undefined,
        productId: variantForm.productId,
        name: variantForm.name.trim(),
        imageUrl: variantForm.imageUrl.trim(),
        isActive: variantForm.isActive,
      })
      onNotice(editingVariantId ? 'Varian diperbarui.' : 'Varian ditambahkan.')
      setEditingVariantId('')
      setVariantForm((current) => ({ ...current, name: '', imageUrl: '', isActive: true }))
      await refresh()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Varian gagal disimpan.')
    }
  }

  function editProduct(product: AdminCatalogProduct) {
    setEditingProductId(product.productId)
    setProductForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      referencePrice: String(product.referencePrice),
      officialUrl: product.officialUrl,
      imageUrl: product.imageUrl,
      sourceCheckedAt: product.sourceCheckedAt || '',
      sortOrder: String(product.sortOrder),
      isActive: product.isActive,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editVariant(variant: AdminCatalogVariant) {
    setEditingVariantId(variant.variantId)
    setVariantForm({
      productId: variant.productId,
      name: variant.name,
      imageUrl: variant.imageUrl,
      isActive: variant.isActive,
    })
  }

  return <section className="jn-section jn-catalog-manager">
    <div className="jn-section-heading"><div><span className="jn-eyebrow">REFERENCE CATALOG</span><h2>Kelola katalog & varian</h2><p>Masukkan model katalog yang sudah diperiksa. Data ini bukan stok fisik.</p></div><button type="button" className="jn-button jn-button-outline" onClick={() => void refresh()}>Refresh katalog</button></div>
    <div className="jn-catalog-admin-grid">
      <form className="jn-panel jn-catalog-form" onSubmit={saveProduct}>
        <div><span className="jn-eyebrow">{editingProductId ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</span><h3>{editingProductId ? 'Ubah produk katalog' : 'Tambah produk katalog'}</h3></div>
        <label className="jn-field">Nama produk<input required maxLength={120} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
        <label className="jn-field">Slug<input required maxLength={140} value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="nama-produk" /></label>
        <div className="jn-form-grid">
          <label className="jn-field">Kategori<input maxLength={80} value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} /></label>
          <label className="jn-field">Harga referensi (Rp)<input type="number" min="0" step="1" value={productForm.referencePrice} onChange={(event) => setProductForm({ ...productForm, referencePrice: event.target.value })} /></label>
        </div>
        <label className="jn-field">URL sumber resmi<input type="url" required value={productForm.officialUrl} onChange={(event) => setProductForm({ ...productForm, officialUrl: event.target.value })} /></label>
        <label className="jn-field">URL gambar katalog<input type="url" value={productForm.imageUrl} onChange={(event) => setProductForm({ ...productForm, imageUrl: event.target.value })} /></label>
        <div className="jn-form-grid">
          <label className="jn-field">Terakhir diperiksa<input type="date" required value={productForm.sourceCheckedAt} onChange={(event) => setProductForm({ ...productForm, sourceCheckedAt: event.target.value })} /></label>
          <label className="jn-field">Urutan tampil<input type="number" value={productForm.sortOrder} onChange={(event) => setProductForm({ ...productForm, sortOrder: event.target.value })} /></label>
        </div>
        <label className="jn-checkbox-field"><input type="checkbox" checked={productForm.isActive} onChange={(event) => setProductForm({ ...productForm, isActive: event.target.checked })} /> Tampilkan di katalog publik</label>
        <div className="jn-inline-actions"><button className="jn-button jn-button-primary">{editingProductId ? 'Simpan perubahan' : 'Tambah produk'}</button>{editingProductId && <button type="button" className="jn-button jn-button-outline" onClick={resetProduct}>Batal edit</button>}</div>
      </form>

      <div className="jn-panel jn-catalog-form">
        <div><span className="jn-eyebrow">{editingVariantId ? 'EDIT VARIANT' : 'NEW VARIANT'}</span><h3>{editingVariantId ? 'Ubah varian' : 'Tambah varian / warna'}</h3></div>
        <form className="jn-form" onSubmit={saveVariant}>
          <label className="jn-field">Produk induk<select required value={variantForm.productId} onChange={(event) => setVariantForm({ ...variantForm, productId: event.target.value })}><option value="">Pilih produk</option>{products.map((product) => <option key={product.productId} value={product.productId}>{product.name}</option>)}</select></label>
          <label className="jn-field">Nama varian / warna<input required maxLength={100} value={variantForm.name} onChange={(event) => setVariantForm({ ...variantForm, name: event.target.value })} placeholder="Contoh: Black" /></label>
          <label className="jn-field">URL gambar varian<input type="url" value={variantForm.imageUrl} onChange={(event) => setVariantForm({ ...variantForm, imageUrl: event.target.value })} /></label>
          <label className="jn-checkbox-field"><input type="checkbox" checked={variantForm.isActive} onChange={(event) => setVariantForm({ ...variantForm, isActive: event.target.checked })} /> Varian aktif</label>
          <div className="jn-inline-actions"><button className="jn-button jn-button-primary">{editingVariantId ? 'Simpan varian' : 'Tambah varian'}</button>{editingVariantId && <button type="button" className="jn-button jn-button-outline" onClick={() => { setEditingVariantId(''); setVariantForm({ ...variantForm, name: '', imageUrl: '', isActive: true }) }}>Batal</button>}</div>
        </form>
        <div className="jn-variant-list">
          {variants.map((variant) => <div key={variant.variantId}><span>{products.find((product) => product.productId === variant.productId)?.name || 'Produk'} · {variant.name}</span><button type="button" onClick={() => editVariant(variant)}>Edit</button><small>{variant.isActive ? 'Aktif' : 'Nonaktif'}</small></div>)}
          {variants.length === 0 && <small>Belum ada varian katalog.</small>}
        </div>
      </div>
    </div>
    <div className="jn-catalog-list">
      {loading ? <div className="jn-state">Memuat produk…</div> : products.length === 0 ? <div className="jn-empty"><strong>Katalog masih kosong.</strong><span>Tambahkan model yang sudah diverifikasi dari sumber resmi.</span></div> : products.map((product) => <article className="jn-catalog-row" key={product.productId}>
        <div><strong>{product.name}</strong><small>{product.category} · Referensi {formatRupiah(product.referencePrice)} · Diperiksa {product.sourceCheckedAt || 'belum diisi'}</small></div>
        <span className="jn-status">{product.isActive ? 'Tampil publik' : 'Nonaktif'}</span>
        <button type="button" className="jn-button jn-button-outline" onClick={() => editProduct(product)}>Edit</button>
      </article>)}
    </div>
  </section>
}

function OrdersManager({
  orders,
  onAddPayment,
  onVerifyPayment,
  onViewProof,
  onUpdateShipment,
  onSaveShopeeLink,
}: {
  orders: AdminOrder[]
  onAddPayment: (orderId: string, form: HTMLFormElement) => Promise<void>
  onVerifyPayment: (paymentId: string, decision: 'verified' | 'rejected') => Promise<void>
  onViewProof: (paymentId: string) => Promise<{ fileName: string; mimeType: string; base64: string }>
  onUpdateShipment: (orderId: string, form: HTMLFormElement) => Promise<void>
  onSaveShopeeLink: (orderId: string, form: HTMLFormElement) => Promise<void>
}) {
  const [proofPreviews, setProofPreviews] = useState<Record<string, { fileName: string; mimeType: string; dataUrl: string }>>({})
  async function openProof(paymentId: string) {
    try {
      const proof = await onViewProof(paymentId)
      setProofPreviews((current) => ({
        ...current,
        [paymentId]: {
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          dataUrl: 'data:' + proof.mimeType + ';base64,' + proof.base64,
        },
      }))
    } catch {
      // Parent surfaces the server error.
    }
  }

  return <section className="jn-section jn-order-manager">
    <div className="jn-section-heading"><div><span className="jn-eyebrow">FINAL ORDERS</span><h2>Pesanan & pengiriman</h2><p>Catat pelunasan, link checkout Shopee, kurir dan nomor resi.</p></div></div>
    {orders.length === 0 ? <div className="jn-empty"><strong>Belum ada pesanan final.</strong><span>Order akan muncul setelah pelanggan mengirim format, unit dialokasikan, dan deposit diverifikasi.</span></div> : <div className="jn-orders-grid">
      {orders.map((order) => <article className="jn-order-card" key={order.orderId}>
        <div className="jn-order-card-head"><div><span className="jn-eyebrow">{order.orderCode}</span><h3>{order.customerName}</h3><small>{order.customerPhone} · {new Date(order.createdAt).toLocaleString('id-ID')}</small></div><span className="jn-status">{displayStatus(order.status)}</span></div>
        <div className="jn-order-info"><div><small>Jumlah produk</small><strong>{order.productCount}</strong></div><div><small>Fee jastip</small><strong>{formatRupiah(order.fee)}</strong></div><div><small>Total order</small><strong>{formatRupiah(order.totalAmount)}</strong></div></div>
        <div className="jn-order-balance"><span>Terbayar {formatRupiah(order.totalPaid)}</span><strong>Sisa {formatRupiah(order.balance)}</strong><small>Status: {displayStatus(order.paymentStatus)}. Ongkir tidak termasuk total ini hingga biaya final ditetapkan.</small></div>
        <div className="jn-order-payments">
          <strong>Riwayat pembayaran</strong>
          {order.payments.map((payment) => <div className="jn-order-payment" key={payment.paymentId}>
            <div><span>{payment.type === 'shopee' ? 'Shopee' : payment.type === 'refund' ? 'Refund' : 'Pelunasan'} · {formatRupiah(payment.amount)}</span><small>{payment.method} · {displayStatus(payment.verificationStatus)}</small></div>
            {payment.hasProof && <button type="button" onClick={() => void openProof(payment.paymentId)}>Lihat bukti</button>}
            {payment.verificationStatus === 'awaiting_verification' && <div className="jn-inline-actions"><button type="button" className="jn-button jn-button-primary" onClick={() => void onVerifyPayment(payment.paymentId, 'verified')}>Verifikasi</button><button type="button" className="jn-button jn-button-outline" onClick={() => void onVerifyPayment(payment.paymentId, 'rejected')}>Tolak</button></div>}
            {proofPreviews[payment.paymentId] && <div className="jn-payment-proof-preview">
              {proofPreviews[payment.paymentId].mimeType.startsWith('image/') ? <img src={proofPreviews[payment.paymentId].dataUrl} alt="Bukti pembayaran" /> : <a href={proofPreviews[payment.paymentId].dataUrl} download={proofPreviews[payment.paymentId].fileName}>Unduh PDF</a>}
            </div>}
          </div>)}
        </div>
        <form className="jn-order-form" onSubmit={(event) => { event.preventDefault(); void onAddPayment(order.orderId, event.currentTarget) }}>
          <strong>Catat pembayaran baru</strong>
          <div className="jn-form-grid">
            <label className="jn-field">Jenis pembayaran<select name="type"><option value="settlement">Pelunasan / transfer</option><option value="shopee">Pembayaran Shopee</option></select></label>
            <label className="jn-field">Nominal (Rp)<input type="number" name="amount" min="1" required /></label>
          </div>
          <div className="jn-form-grid">
            <label className="jn-field">Metode<select name="method"><option value="bank_transfer">Transfer bank</option><option value="e_wallet">E-wallet</option><option value="cash">Tunai</option><option value="shopee">Shopee</option><option value="other">Lainnya</option></select></label>
            <label className="jn-field">Bukti pembayaran<input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label>
          </div>
          <button className="jn-button jn-button-outline">Simpan pembayaran</button>
        </form>
        <form className="jn-order-form" onSubmit={(event) => { event.preventDefault(); void onSaveShopeeLink(order.orderId, event.currentTarget) }}>
          <strong>Link checkout Shopee (opsional)</strong>
          <label className="jn-field">URL checkout<input type="url" name="shopeeCheckoutUrl" defaultValue={order.shopeeCheckoutUrl} placeholder="https://shopee.co.id/..." /></label>
          <small>Nama akun pelanggan: {order.shopeeUsername || 'Belum dikonfirmasi'}</small>
          <button className="jn-button jn-button-outline">Simpan link</button>
        </form>
        <form className="jn-order-form" onSubmit={(event) => { event.preventDefault(); void onUpdateShipment(order.orderId, event.currentTarget) }}>
          <strong>Pengiriman</strong>
          <div className="jn-form-grid">
            <label className="jn-field">Kurir<input name="courier" defaultValue={order.courier} placeholder="Kurir" /></label>
            <label className="jn-field">Nomor resi<input name="trackingNumber" defaultValue={order.trackingNumber} placeholder="Nomor resi" /></label>
          </div>
          <div className="jn-form-grid">
            <label className="jn-field">Status<select name="status" defaultValue={order.shipmentStatus || (order.status === 'shipped' ? 'shipped' : order.status === 'completed' ? 'delivered' : 'preparing')}><option value="preparing">Packing / diproses</option><option value="shipped">Dikirim</option><option value="delivered">Diterima</option><option value="issue">Kendala</option></select></label>
            <label className="jn-field">Catatan<input name="notes" placeholder="Opsional" /></label>
          </div>
          <button className="jn-button jn-button-primary">Simpan pengiriman</button>
        </form>
      </article>)}
    </div>}
  </section>
}

function FinanceManager({
  summary,
  expenses,
  onAddExpense,
}: {
  summary: AdminFinancialSummary | null
  expenses: AdminExpense[]
  onAddExpense: (form: HTMLFormElement) => Promise<void>
}) {
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10))
  return <section className="jn-section jn-finance-manager">
    <div className="jn-section-heading"><div><span className="jn-eyebrow">FINANCE & OPERATING COSTS</span><h2>Ringkasan keuangan</h2><p>Angka di bawah berasal dari catatan order, pembayaran terverifikasi, unit, dan pengeluaran.</p></div></div>
    {summary && <div className="jn-finance-grid">
      <div><small>Fee tercatat pada order</small><strong>{formatRupiah(summary.feeBilled)}</strong></div>
      <div><small>Transfer / tunai terverifikasi</small><strong>{formatRupiah(summary.verifiedBankAndCash)}</strong></div>
      <div><small>Pembayaran Shopee terverifikasi</small><strong>{formatRupiah(summary.verifiedShopeePayments)}</strong></div>
      <div><small>Refund terverifikasi</small><strong>{formatRupiah(summary.verifiedRefunds)}</strong></div>
      <div><small>Sisa tagihan order aktif</small><strong>{formatRupiah(summary.outstandingBalances)}</strong></div>
      <div><small>HPP unit yang dialokasikan</small><strong>{formatRupiah(summary.allocatedUnitPurchaseCost)}</strong></div>
      <div><small>Pengeluaran tercatat</small><strong>{formatRupiah(summary.recordedExpenses)}</strong></div>
      <div><small>Jumlah order</small><strong>{summary.ordersCount}</strong></div>
    </div>}
    <p className="jn-finance-disclaimer">Ini ringkasan operasional, bukan laporan laba bersih atau laporan akuntansi. Pembayaran Shopee dan transfer/tunai ditampilkan terpisah; biaya platform, ongkir, dan perlakuan akuntansi perlu disesuaikan dengan bukti aktual serta kebijakan yang disepakati.</p>
    <form className="jn-panel jn-expense-form" onSubmit={(event) => { event.preventDefault(); void onAddExpense(event.currentTarget) }}>
      <div><span className="jn-eyebrow">NEW EXPENSE</span><h3>Catat pengeluaran</h3></div>
      <label className="jn-field">Kategori<select name="category"><option value="transport">Transportasi</option><option value="parking">Parkir</option><option value="food">Makan</option><option value="packing">Packing</option><option value="shipping">Ongkir dibayar admin</option><option value="platform">Biaya platform</option><option value="other">Lainnya</option></select></label>
      <label className="jn-field">Nominal (Rp)<input type="number" name="amount" min="1" step="1" required placeholder="Nominal aktual" /></label>
      <label className="jn-field">Tanggal<input type="date" name="occurredAt" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
      <label className="jn-field">Keterangan<input type="text" name="description" maxLength={500} placeholder="Detail pengeluaran" /></label>
      <button className="jn-button jn-button-primary">Simpan pengeluaran</button>
    </form>
    <div className="jn-expense-history">
      <div className="jn-section-heading"><div><span className="jn-eyebrow">EXPENSE LEDGER</span><h3>Riwayat pengeluaran</h3></div></div>
      {expenses.length === 0 ? <div className="jn-empty"><strong>Belum ada pengeluaran.</strong><span>Biaya operasional yang dicatat akan muncul di sini.</span></div> : expenses.map((expense) => <div className="jn-expense-row" key={expense.expenseId}>
        <div><strong>{expense.category}</strong><small>{new Date(expense.occurredAt + 'T00:00:00').toLocaleDateString('id-ID')} · {expense.description || 'Tanpa keterangan'}</small></div>
        <strong>{formatRupiah(expense.amount)}</strong>
      </div>)}
    </div>
  </section>
}

function RequestPayments({
  group,
  onAddPayment,
  onVerifyPayment,
  onViewProof,
}: {
  group: AdminRequestGroup
  onAddPayment: (groupId: string, form: HTMLFormElement) => Promise<void>
  onVerifyPayment: (paymentId: string, decision: 'verified' | 'rejected') => Promise<void>
  onViewProof: (paymentId: string) => Promise<{ fileName: string; mimeType: string; base64: string }>
}) {
  const [proofPreviews, setProofPreviews] = useState<Record<string, { fileName: string; mimeType: string; dataUrl: string }>>({})
  async function openProof(paymentId: string) {
    try {
      const proof = await onViewProof(paymentId)
      setProofPreviews((current) => ({
        ...current,
        [paymentId]: {
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          dataUrl: 'data:' + proof.mimeType + ';base64,' + proof.base64,
        },
      }))
    } catch {
      // Parent surfaces the server error.
    }
  }
  return <section className="jn-payment-panel">
    <div className="jn-payment-heading">
      <div><strong>Deposit & bukti pembayaran</strong><small>Terverifikasi: {formatRupiah(group.verifiedDepositAmount)}</small></div>
    </div>
    {group.payments.length > 0 && <div className="jn-payment-list">
      {group.payments.map((payment) => <div className="jn-payment-row" key={payment.paymentId}>
        <div><strong>{formatRupiah(payment.amount)}</strong><small>{payment.method} · {new Date(payment.occurredAt).toLocaleString('id-ID')}</small></div>
        <span className="jn-status">{displayStatus(payment.verificationStatus)}</span>
        {payment.hasProof && <button type="button" className="jn-text-link" onClick={() => void openProof(payment.paymentId)}>Lihat bukti</button>}
        {proofPreviews[payment.paymentId] && <div className="jn-payment-proof-preview">
          {proofPreviews[payment.paymentId].mimeType.startsWith('image/')
            ? <img src={proofPreviews[payment.paymentId].dataUrl} alt={'Bukti pembayaran ' + proofPreviews[payment.paymentId].fileName} />
            : <a href={proofPreviews[payment.paymentId].dataUrl} download={proofPreviews[payment.paymentId].fileName}>Unduh bukti PDF</a>}
        </div>}
        {payment.verificationStatus === 'awaiting_verification' && <div className="jn-inline-actions">
          <button type="button" className="jn-button jn-button-primary" onClick={() => void onVerifyPayment(payment.paymentId, 'verified')}>Verifikasi</button>
          <button type="button" className="jn-button jn-button-outline" onClick={() => void onVerifyPayment(payment.paymentId, 'rejected')}>Tolak bukti</button>
        </div>}
      </div>)}
    </div>}
    <form className="jn-payment-form" onSubmit={(event) => {
      event.preventDefault()
      void onAddPayment(group.requestGroupId, event.currentTarget)
    }}>
      <strong>Catat deposit baru</strong>
      <label className="jn-field">Nominal diterima (Rp)<input name="amount" type="number" min="1" step="1" required placeholder="Nominal sesuai transfer yang diperiksa" /></label>
      <label className="jn-field">Metode<select name="method"><option value="bank_transfer">Transfer bank</option><option value="e_wallet">E-wallet</option><option value="cash">Tunai</option><option value="other">Lainnya</option></select></label>
      <label className="jn-field">Bukti transfer<input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label>
      <label className="jn-field">Catatan<input name="notes" maxLength={500} placeholder="Opsional" /></label>
      <button type="submit" className="jn-button jn-button-outline">Simpan deposit untuk diverifikasi</button>
      <small>Upload disimpan di Drive privat. Catatan deposit belum dianggap pembayaran terverifikasi sampai admin memeriksa bukti.</small>
    </form>
  </section>
}

function RequestEditor({
  item,
  onUpdate,
  onUpload,
  onAddUnit,
}: {
  item: AdminRequestGroup['items'][number]
  onUpdate: (requestId: string, status: 'new' | 'searching' | 'found' | 'not_found', condition: string) => Promise<void>
  onUpload: (requestId: string, file?: File) => Promise<void>
  onAddUnit: (item: AdminRequestGroup['items'][number], form: HTMLFormElement) => Promise<void>
}) {
  const [status, setStatus] = useState(item.status as 'new' | 'searching' | 'found' | 'not_found')
  const [condition, setCondition] = useState(item.actualCondition)
  useEffect(() => {
    setStatus(item.status as 'new' | 'searching' | 'found' | 'not_found')
    setCondition(item.actualCondition)
  }, [item.status, item.actualCondition])
  return <div className="jn-admin-item">
    <div className="jn-admin-item-title"><div><strong>{item.productName}</strong><small>{item.variantName || 'Varian bebas'} · {item.quantity} pcs</small></div><span className="jn-status">{displayStatus(item.status)}</span></div>
    <div className="jn-admin-fields">
      <label className="jn-field">Status pencarian<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="new">Baru</option><option value="searching">Sedang dicari</option><option value="found">Ditemukan</option><option value="not_found">Tidak ditemukan</option></select></label>
      <label className="jn-field">Kondisi / catatan admin<textarea rows={2} value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Catat kondisi aktual produk…" /></label>
      <button className="jn-button jn-button-outline" onClick={() => void onUpdate(item.requestId, status, condition)}>Simpan status</button>
    </div>
    {item.status === 'found' && <div className="jn-admin-fields">
      <label className="jn-field">Upload foto aktual<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void onUpload(item.requestId, event.currentTarget.files?.[0])} /></label>
      <small>File disimpan di folder Drive privat. Pelanggan yang memiliki token request ini dapat melihat foto.</small>
      <form className="jn-unit-form" onSubmit={(event) => { event.preventDefault(); void onAddUnit(item, event.currentTarget) }}>
        <strong>Daftarkan dan alokasikan unit fisik</strong>
        <input name="unitCode" required placeholder="Kode unit internal" />
        <input name="purchasePrice" type="number" min="0" placeholder="Harga beli aktual (Rp)" />
        <input name="sellingPrice" type="number" min="1" required placeholder="Harga final pelanggan (Rp)" />
        <button className="jn-button jn-button-primary">Tambah & alokasikan unit</button>
        <small>Unit {item.assignedUnitCount}/{item.quantity} sudah dialokasikan.</small>
      </form>
    </div>}
    {item.customerDecision && <small>Keputusan pelanggan: {item.customerDecision === 'approved' ? 'disetujui' : 'belum disetujui'}</small>}
  </div>
}

function AppRoutes() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/portal" element={<PortalPage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default function GasApp() {
  return <AppRoutes />
}
