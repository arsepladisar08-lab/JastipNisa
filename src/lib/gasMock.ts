import { initialCatalog } from '../data/catalog'
import { calculateJastipFee } from './fees'

type MockEnvelope<T> = { ok: boolean; data: T | null; error: { code: string; message: string } | null }
type MockRecord = Record<string, any>

const now = () => new Date().toISOString()
const MOCK_ADMIN_PASSWORD = 'demo-admin'
const MOCK_ADMIN_SESSION = 'demo-admin-session-token'
const MOCK_CUSTOMER_TOKEN_1 = 'demo_customer_token_0000000000000000000000000000000000000000000000000000000000000000'
const MOCK_CUSTOMER_TOKEN_2 = 'demo_customer_token_1111111111111111111111111111111111111111111111111111111111111111'
const MOCK_PHOTO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6u8AAAAASUVORK5CYII='

let adminPassword = MOCK_ADMIN_PASSWORD
let adminSessions = new Set<string>([MOCK_ADMIN_SESSION])
let products: MockRecord[] = []
let variants: MockRecord[] = []
let groups: MockRecord[] = []
let requests: MockRecord[] = []
let orders: MockRecord[] = []
let payments: MockRecord[] = []
let units: MockRecord[] = []
let expenses: MockRecord[] = []
let shipments: MockRecord[] = []
let submissionResults: Record<string, MockRecord> = {}
let idCounter = 1

function id(prefix: string): string {
  idCounter += 1
  return prefix + '-' + idCounter
}

function success<T>(data: T): MockEnvelope<T> {
  return { ok: true, data, error: null }
}

function failure<T>(code: string, message: string): MockEnvelope<T> {
  return { ok: false, data: null, error: { code, message } }
}

function fail(code: string, message: string): never {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  throw error
}

function requireAdmin(token: unknown): void {
  if (typeof token !== 'string' || !adminSessions.has(token)) {
    fail('ADMIN_SESSION_EXPIRED', 'Sesi demo berakhir. Masuk kembali dengan password demo-admin.')
  }
}

function findGroupByToken(token: unknown): MockRecord {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,160}$/.test(token)) {
    fail('INVALID_ACCESS_TOKEN', 'Format token demo tidak valid.')
  }
  const group = groups.find((item) => item.token === token && !item.revokedAt)
  if (!group) fail('ACCESS_DENIED', 'Token demo tidak ditemukan atau sudah dicabut.')
  return group
}

function getPortal(group: MockRecord): MockRecord {
  return {
    requestCode: group.requestCode,
    status: group.status,
    createdAt: group.createdAt,
    items: requests.filter((item) => item.requestGroupId === group.requestGroupId).map((item) => ({
      requestId: item.requestId,
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      status: item.status,
      actualCondition: item.actualCondition || '',
      customerDecision: item.customerDecision || '',
      photoCount: item.photoCount || 0,
    })),
    order: orders.find((item) => item.requestGroupId === group.requestGroupId)
      ? (() => {
          const order = orders.find((item) => item.requestGroupId === group.requestGroupId)!
          return {
            orderCode: order.orderCode,
            status: order.status,
            totalAmount: order.totalAmount,
            paymentStatus: order.paymentStatus,
            shopeeCheckoutUrl: order.shopeeCheckoutUrl || '',
            trackingNumber: order.trackingNumber || '',
            courier: order.courier || '',
          }
        })()
      : null,
  }
}

function mapAdminGroup(group: MockRecord): MockRecord {
  const groupRequests = requests.filter((item) => item.requestGroupId === group.requestGroupId)
  const groupPayments = payments.filter((payment) => payment.requestGroupId === group.requestGroupId)
  return {
    requestGroupId: group.requestGroupId,
    orderId: group.orderId || '',
    requestCode: group.requestCode,
    status: group.status,
    createdAt: group.createdAt,
    customerName: group.customerName,
    customerPhone: group.customerPhone,
    customerAddress: group.customerAddress || '',
    hasActiveAccessToken: Boolean(group.token) && !group.revokedAt,
    verifiedDepositAmount: groupPayments
      .filter((payment) => payment.type === 'deposit' && payment.verificationStatus === 'verified')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    payments: groupPayments.map((payment) => ({ ...payment })),
    items: groupRequests.map((item) => ({
      requestId: item.requestId,
      productId: item.productId,
      variantId: item.variantId || '',
      productName: item.productName,
      variantName: item.variantName || '',
      quantity: item.quantity,
      assignedUnitCount: item.assignedUnitCount || 0,
      status: item.status,
      actualCondition: item.actualCondition || '',
      customerDecision: item.customerDecision || '',
    })),
  }
}

function createToken(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = (idCounter * 13 + i * 29) % 256
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function resetState(): void {
  const stamp = now()
  products = initialCatalog.map((product, index) => ({
    productId: 'demo-product-' + (index + 1),
    name: product.name,
    slug: product.slug,
    category: product.category,
    referencePrice: product.officialPrice,
    officialUrl: product.officialUrl,
    imageUrl: product.imageUrl || '',
    sourceCheckedAt: product.sourceCheckedAt,
    isActive: true,
    sortOrder: index + 1,
  }))
  variants = [
    { variantId: 'demo-variant-black', productId: 'demo-product-1', name: 'Black', imageUrl: '' },
    { variantId: 'demo-variant-cream', productId: 'demo-product-1', name: 'Cream', imageUrl: '' },
    { variantId: 'demo-variant-brown', productId: 'demo-product-2', name: 'Brown', imageUrl: '' },
  ]
  groups = [
    {
      requestGroupId: 'demo-group-approval',
      requestCode: 'JN-DEMO-001',
      customerName: 'Alya Demo',
      customerPhone: '081234567890',
      customerAddress: 'Surabaya (data contoh)',
      status: 'order_created',
      createdAt: stamp,
      token: MOCK_CUSTOMER_TOKEN_1,
      revokedAt: '',
      orderId: 'demo-order-001',
    },
    {
      requestGroupId: 'demo-group-search',
      requestCode: 'JN-DEMO-002',
      customerName: 'Nadia Demo',
      customerPhone: '081298765432',
      customerAddress: '',
      status: 'searching',
      createdAt: stamp,
      token: MOCK_CUSTOMER_TOKEN_2,
      revokedAt: '',
      orderId: '',
    },
  ]
  requests = [
    {
      requestId: 'demo-request-found',
      requestGroupId: 'demo-group-approval',
      productId: 'demo-product-1',
      variantId: 'demo-variant-black',
      productName: 'Asha Bag',
      variantName: 'Black',
      quantity: 1,
      status: 'found',
      actualCondition: 'Kondisi contoh: jahitan rapi, hardware sesuai foto.',
      customerDecision: 'approved',
      photoCount: 1,
      assignedUnitCount: 0,
    },
    {
      requestId: 'demo-request-searching',
      requestGroupId: 'demo-group-search',
      productId: 'demo-product-2',
      variantId: 'demo-variant-brown',
      productName: 'Daria Bag',
      variantName: 'Brown',
      quantity: 2,
      status: 'searching',
      actualCondition: '',
      customerDecision: '',
      photoCount: 0,
      assignedUnitCount: 0,
    },
  ]
  orders = [
    {
      orderId: 'demo-order-001',
      orderCode: 'JN-ORD-DEMO-001',
      requestGroupId: 'demo-group-approval',
      customerName: 'Alya Demo',
      customerPhone: '081234567890',
      shippingAddress: 'Surabaya (data contoh)',
      productCount: 1,
      subtotal: 108000,
      fee: 15000,
      shippingFee: 0,
      totalAmount: 123000,
      totalPaid: 0,
      balance: 123000,
      paymentStatus: 'unpaid',
      status: 'confirmed',
      shopeeUsername: '',
      shopeeCheckoutUrl: '',
      courier: '',
      trackingNumber: '',
      shipmentStatus: '',
      createdAt: stamp,
      payments: [],
    },
  ]
  payments = [
    {
      paymentId: 'demo-payment-pending',
      requestGroupId: 'demo-group-approval',
      orderId: 'demo-order-001',
      type: 'deposit',
      amount: 25000,
      method: 'bank_transfer',
      verificationStatus: 'awaiting_verification',
      occurredAt: stamp,
      notes: 'Bukti pembayaran sintetis untuk demo',
      hasProof: true,
    },
  ]
  units = [
    { unitId: 'demo-unit-001', unitCode: 'DEMO-UNIT-001', productId: 'demo-product-1', variantId: 'demo-variant-black', status: 'reserved', purchasePrice: 90000, sellingPrice: 108000, heldRequestId: '', reservedOrderId: '' },
    { unitId: 'demo-unit-002', unitCode: 'DEMO-UNIT-002', productId: 'demo-product-2', variantId: 'demo-variant-brown', status: 'available', purchasePrice: 95000, sellingPrice: 119000, heldRequestId: '', reservedOrderId: '' },
  ]
  expenses = []
  shipments = []
  submissionResults = {}
  adminPassword = MOCK_ADMIN_PASSWORD
  adminSessions = new Set([MOCK_ADMIN_SESSION])
  idCounter = 1
}

resetState()

async function dispatch(method: string, args: unknown[]): Promise<MockEnvelope<unknown>> {
  const a = args as any[]
  switch (method) {
    case 'apiPublicGetCatalog':
      return success({
        products: products.filter((item) => item.isActive).map(({ productId, name, slug, category, referencePrice, officialUrl, imageUrl, sourceCheckedAt }) => ({
          productId, name, slug, category, referencePrice, officialUrl, imageUrl, sourceCheckedAt,
        })),
        variants: variants.map(({ variantId, productId, name, imageUrl }) => ({ variantId, productId, name, imageUrl })),
      })
    case 'apiPublicGetConfig':
      return success({
        service_name: 'JastipNisa Demo',
        admin_whatsapp: '',
        public_notice: 'MODE DEMO — katalog sintetis, data tidak disimpan ke akun produksi.',
        packing_estimate: '2–3 hari kerja',
        currency: 'IDR',
      })
    case 'apiPublicCreateRequest': {
      const payload = a[0] || {}
      const nameValue = String(payload.customerName || '').trim()
      const phone = String(payload.phone || '').replace(/\D/g, '')
      const items = Array.isArray(payload.items) ? payload.items : []
      if (nameValue.length < 2 || phone.length < 8) return failure('INVALID_CUSTOMER', 'Nama dan nomor WhatsApp perlu diperiksa.')
      if (items.length === 0) return failure('INVALID_ITEMS', 'Tambahkan minimal satu produk.')
      const token = String(payload.accessToken || createToken())
      if (!/^[A-Za-z0-9_-]{40,160}$/.test(token)) return failure('INVALID_REQUEST', 'Token demo tidak valid.')
      const submissionId = String(payload.submissionId || '')
      const duplicate = submissionResults[submissionId]
      if (submissionId && duplicate) {
        return success({ ...duplicate, reusedSubmission: true })
      }
      const preparedItems: Array<{
        item: MockRecord
        product: MockRecord | undefined
        variant: MockRecord | undefined
        quantity: number
      }> = items.map((item: MockRecord) => {
        const product = products.find((row) => row.productId === item.productId && row.isActive)
        const variant = product && item.variantId
          ? variants.find((row) => row.variantId === item.variantId && row.productId === product.productId)
          : undefined
        return { item, product, variant, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) }
      })
      if (preparedItems.some((entry) => !entry.product)) return failure('PRODUCT_NOT_AVAILABLE', 'Produk contoh tidak tersedia.')
      if (preparedItems.some((entry) => entry.item.variantId && !entry.variant)) return failure('VARIANT_NOT_AVAILABLE', 'Varian produk demo tidak tersedia.')
      const groupId = id('demo-group')
      const requestCode = 'JN-DEMO-' + String(idCounter).padStart(3, '0')
      const group = {
        requestGroupId: groupId, requestCode, customerName: nameValue,
        customerPhone: String(payload.phone), customerAddress: '', status: 'new',
        createdAt: now(), token, revokedAt: '', orderId: '',
        submissionId: String(payload.submissionId || ''),
      }
      groups.unshift(group)
      let productCount = 0
      preparedItems.forEach(({ item, product, variant, quantity }) => {
        productCount += quantity
        requests.push({
          requestId: id('demo-request'), requestGroupId: groupId,
          productId: product.productId, variantId: variant?.variantId || '',
          productName: product.name, variantName: variant?.name || '',
          quantity, status: 'new', actualCondition: '', customerDecision: '',
          photoCount: 0, assignedUnitCount: 0,
        })
      })
      const result = {
        requestGroupId: groupId, requestCode, accessToken: token, productCount,
        estimatedJastipFee: calculateJastipFee(productCount), reusedSubmission: false,
      }
      if (submissionId) submissionResults[submissionId] = result
      return success(result)
    }
    case 'apiCustomerGetPortal':
      try { return success(getPortal(findGroupByToken(a[0]))) } catch (error) { return failure((error as any).code || 'ACCESS_DENIED', (error as Error).message) }
    case 'apiCustomerGetPhoto': {
      const group = findGroupByToken(a[0])
      const request = requests.find((item) => item.requestId === a[1] && item.requestGroupId === group.requestGroupId)
      if (!request || Number(a[2]) < 0 || Number(a[2]) >= Number(request.photoCount || 0)) return failure('NOT_FOUND', 'Foto demo tidak ditemukan.')
      return success({ mimeType: 'image/png', base64: MOCK_PHOTO_BASE64 })
    }
    case 'apiCustomerRespondToItem': {
      const group = findGroupByToken(a[0])
      const request = requests.find((item) => item.requestId === a[1] && item.requestGroupId === group.requestGroupId)
      if (!request || request.status !== 'found') return failure('INVALID_STATE', 'Item demo belum siap diputuskan.')
      request.customerDecision = a[2] === 'approved' ? 'approved' : 'rejected'
      group.status = request.customerDecision === 'approved' ? 'customer_details_received' : 'awaiting_customer_approval'
      return success({ saved: true, decision: request.customerDecision })
    }
    case 'apiCustomerSubmitOrderDetails': {
      const group = findGroupByToken(a[0])
      const payload = a[1] || {}
      if (!String(payload.name || '').trim() || !String(payload.phone || '').trim() || !String(payload.address || '').trim()) return failure('INVALID_CUSTOMER_DETAILS', 'Lengkapi format order demo.')
      group.customerName = String(payload.name)
      group.customerPhone = String(payload.phone)
      group.customerAddress = String(payload.address)
      group.status = 'customer_details_received'
      return success({ saved: true, status: group.status })
    }
    case 'apiCustomerConfirmShopee':
      findGroupByToken(a[0])
      return success({ saved: true })
    case 'apiAdminLogin': {
      if (String(a[0] || '') !== adminPassword) return failure('LOGIN_FAILED', 'Password demo salah. Gunakan demo-admin.')
      const token = MOCK_ADMIN_SESSION
      adminSessions.add(token)
      return success({ sessionToken: token, expiresInSeconds: 1800 })
    }
    case 'apiAdminLogout':
      requireAdmin(a[0])
      adminSessions.delete(String(a[0]))
      return success({ signedOut: true })
    case 'apiAdminChangePassword':
      requireAdmin(a[0])
      if (String(a[1] || '') !== adminPassword) return failure('CURRENT_PASSWORD_INVALID', 'Password demo saat ini tidak sesuai.')
      if (String(a[2] || '').length < 16) return failure('WEAK_PASSWORD', 'Password baru minimal 16 karakter.')
      adminPassword = String(a[2])
      adminSessions.clear()
      return success({ changed: true, reauthenticationRequired: true })
    case 'apiAdminGetDashboard':
      requireAdmin(a[0])
      return success({
        requestGroups: groups.length,
        itemsSearching: requests.filter((item) => item.status === 'searching').length,
        itemsFound: requests.filter((item) => item.status === 'found').length,
        unitsAvailable: units.filter((item) => item.status === 'available').length,
        activeOrders: orders.filter((item) => !['cancelled', 'completed'].includes(item.status)).length,
        paymentsAwaitingVerification: payments.filter((item) => item.verificationStatus === 'awaiting_verification').length,
      })
    case 'apiAdminListRequests':
      requireAdmin(a[0])
      return success(groups.map(mapAdminGroup).filter((group) => {
        const wanted = String(a[1] || 'all')
        return wanted === 'all' || group.status === wanted || group.items.some((item: MockRecord) => item.status === wanted)
      }))
    case 'apiAdminReissueCustomerAccessToken': {
      requireAdmin(a[0])
      const group = groups.find((item) => item.requestGroupId === a[1])
      if (!group) return failure('REQUEST_NOT_FOUND', 'Request demo tidak ditemukan.')
      const token = createToken()
      group.token = token
      group.revokedAt = ''
      return success({ accessToken: token, requestCode: group.requestCode })
    }
    case 'apiAdminRevokeCustomerAccessToken': {
      requireAdmin(a[0])
      const group = groups.find((item) => item.requestGroupId === a[1])
      if (!group) return failure('REQUEST_NOT_FOUND', 'Request demo tidak ditemukan.')
      const alreadyRevoked = Boolean(group.revokedAt)
      group.revokedAt = now()
      return success({ revoked: true, alreadyRevoked })
    }
    case 'apiAdminUpdateRequestItem': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const item = requests.find((row) => row.requestId === payload.requestId)
      if (!item) return failure('REQUEST_NOT_FOUND', 'Item demo tidak ditemukan.')
      if (!['new', 'searching', 'found', 'not_found'].includes(payload.status)) return failure('INVALID_STATE', 'Status item demo tidak valid.')
      item.status = payload.status
      item.actualCondition = String(payload.actualCondition || '')
      const group = groups.find((row) => row.requestGroupId === item.requestGroupId)
      if (group) group.status = payload.status === 'found' ? 'awaiting_customer_approval' : payload.status
      return success({ saved: true, groupStatus: group?.status || payload.status })
    }
    case 'apiAdminUploadRequestPhoto': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const item = requests.find((row) => row.requestId === payload.requestId)
      if (!item) return failure('REQUEST_NOT_FOUND', 'Item demo tidak ditemukan.')
      item.photoCount = Number(item.photoCount || 0) + 1
      return success({ uploaded: true, photoCount: item.photoCount })
    }
    case 'apiAdminAddUnit': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const unit = {
        unitId: id('demo-unit'), unitCode: String(payload.unitCode || id('UNIT')),
        productId: String(payload.productId), variantId: String(payload.variantId || ''),
        status: 'available', purchasePrice: Number(payload.purchasePrice || 0),
        sellingPrice: Number(payload.sellingPrice || 0), conditionNotes: String(payload.conditionNotes || ''),
        heldRequestId: '', reservedOrderId: '',
      }
      units.push(unit)
      return success({ unitId: unit.unitId, unitCode: unit.unitCode, status: unit.status })
    }
    case 'apiAdminAssignUnit': {
      requireAdmin(a[0])
      const unit = units.find((row) => row.unitId === a[2])
      const item = requests.find((row) => row.requestId === a[1])
      if (!unit || !item || unit.status !== 'available') return failure('INVALID_STATE', 'Unit demo tidak tersedia untuk dialokasikan.')
      unit.status = 'held'
      unit.heldRequestId = item.requestId
      item.assignedUnitCount = Number(item.assignedUnitCount || 0) + 1
      return success({ assigned: true, assignedCount: item.assignedUnitCount, requiredCount: item.quantity })
    }
    case 'apiAdminCreateOrder': {
      requireAdmin(a[0])
      const group = groups.find((row) => row.requestGroupId === a[1])
      if (!group) return failure('REQUEST_NOT_FOUND', 'Request demo tidak ditemukan.')
      const existing = orders.find((row) => row.requestGroupId === group.requestGroupId)
      if (existing) return success({
        orderId: existing.orderId, orderCode: existing.orderCode, productCount: existing.productCount,
        subtotal: existing.subtotal, fee: existing.fee, total: existing.totalAmount,
      })
      const groupItems = requests.filter((row) => row.requestGroupId === group.requestGroupId)
      if (!groupItems.length || !groupItems.every((row) => row.status === 'found' && row.customerDecision === 'approved')) return failure('ITEMS_NOT_APPROVED', 'Semua item demo harus ditemukan dan disetujui pelanggan.')
      const productCount = groupItems.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
      const subtotal = groupItems.reduce((sum, row) => sum + Number(products.find((p) => p.productId === row.productId)?.referencePrice || 0) * Number(row.quantity || 0), 0)
      const fee = calculateJastipFee(productCount)
      const order = {
        orderId: id('demo-order'), orderCode: 'JN-ORD-DEMO-' + String(idCounter).padStart(3, '0'),
        requestGroupId: group.requestGroupId, customerName: group.customerName, customerPhone: group.customerPhone,
        shippingAddress: group.customerAddress || '', productCount, subtotal, fee, shippingFee: 0,
        totalAmount: subtotal + fee, totalPaid: 0, balance: subtotal + fee, paymentStatus: 'unpaid',
        status: 'confirmed', shopeeUsername: '', shopeeCheckoutUrl: '', courier: '', trackingNumber: '',
        shipmentStatus: '', createdAt: now(), payments: [],
      }
      orders.push(order)
      group.orderId = order.orderId
      group.status = 'order_created'
      return success({ orderId: order.orderId, orderCode: order.orderCode, productCount, subtotal, fee, total: order.totalAmount })
    }
    case 'apiAdminUploadPaymentProof':
      requireAdmin(a[0])
      return success({ fileId: id('demo-proof'), fileName: String(a[1]?.fileName || 'demo-proof.png') })
    case 'apiAdminAddPayment': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const duplicate = payments.find((item) => item.idempotencyKey === payload.idempotencyKey)
      if (duplicate) return success({ paymentId: duplicate.paymentId, verificationStatus: duplicate.verificationStatus, reused: true })
      const payment = {
        paymentId: id('demo-payment'), requestGroupId: String(payload.requestGroupId || ''),
        orderId: String(payload.orderId || ''), type: String(payload.type || 'deposit'),
        amount: Number(payload.amount || 0), method: String(payload.method || ''),
        verificationStatus: 'awaiting_verification', occurredAt: now(),
        notes: String(payload.notes || ''), hasProof: Boolean(payload.proofFileId),
        idempotencyKey: String(payload.idempotencyKey || ''),
      }
      payments.push(payment)
      return success({ paymentId: payment.paymentId, verificationStatus: payment.verificationStatus, reused: false })
    }
    case 'apiAdminVerifyPayment': {
      requireAdmin(a[0])
      const payment = payments.find((item) => item.paymentId === a[1])
      if (!payment) return failure('PAYMENT_NOT_FOUND', 'Pembayaran demo tidak ditemukan.')
      if (!['verified', 'rejected'].includes(String(a[2]))) return failure('INVALID_STATE', 'Keputusan pembayaran tidak valid.')
      payment.verificationStatus = String(a[2])
      payment.verifiedAt = payment.verificationStatus === 'verified' ? now() : ''
      const order = orders.find((item) => item.orderId === payment.orderId)
      if (order && payment.verificationStatus === 'verified') {
        const paid = payments.filter((item) => item.orderId === order.orderId && item.verificationStatus === 'verified')
          .reduce((sum, item) => sum + (item.type === 'refund' ? -item.amount : item.amount), 0)
        order.totalPaid = paid
        order.balance = Math.max(0, order.totalAmount - paid)
        order.paymentStatus = paid <= 0 ? 'unpaid' : paid >= order.totalAmount ? 'paid' : 'partially_paid'
      }
      return success({ saved: true, verificationStatus: payment.verificationStatus })
    }
    case 'apiAdminGetPaymentProof':
      requireAdmin(a[0])
      return success({ fileName: 'demo-proof.png', mimeType: 'image/png', base64: MOCK_PHOTO_BASE64 })
    case 'apiAdminListCatalog':
      requireAdmin(a[0])
      return success({ products: products.map((item) => ({ ...item })), variants: variants.map((item) => ({ ...item })) })
    case 'apiAdminSaveCatalogProduct': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const productId = String(payload.productId || id('demo-product'))
      const existing = products.find((item) => item.productId === productId)
      const record = {
        ...existing, ...payload, productId, imageUrl: String(payload.imageUrl || ''),
      }
      if (existing) Object.assign(existing, record)
      else products.push(record)
      return success({ productId, saved: true })
    }
    case 'apiAdminSaveVariant': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const variantId = String(payload.variantId || id('demo-variant'))
      const existing = variants.find((item) => item.variantId === variantId)
      if (existing) Object.assign(existing, payload, { variantId })
      else variants.push({ ...payload, variantId })
      return success({ variantId, saved: true })
    }
    case 'apiAdminListOrders':
      requireAdmin(a[0])
      return success(orders.map((order) => ({
        ...order,
        payments: payments.filter((payment) => payment.orderId === order.orderId).map((payment) => ({ ...payment })),
      })))
    case 'apiAdminUpdateShipment': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const order = orders.find((item) => item.orderId === payload.orderId)
      if (!order || ['cancelled', 'completed'].includes(order.status)) return failure('INVALID_STATE', 'Order demo tidak dapat diubah.')
      order.courier = String(payload.courier || '')
      order.trackingNumber = String(payload.trackingNumber || '')
      order.shipmentStatus = String(payload.status || '')
      order.status = payload.status === 'preparing' ? 'packing' : payload.status === 'shipped' ? 'shipped' : payload.status === 'delivered' ? 'completed' : 'issue'
      shipments.push({ orderId: order.orderId, courier: order.courier, trackingNumber: order.trackingNumber, status: order.shipmentStatus })
      return success({ saved: true, status: order.shipmentStatus, orderStatus: order.status })
    }
    case 'apiAdminUpdateOrderOptions': {
      requireAdmin(a[0])
      const order = orders.find((item) => item.orderId === a[1]?.orderId)
      if (!order) return failure('ORDER_NOT_FOUND', 'Order demo tidak ditemukan.')
      order.shopeeCheckoutUrl = String(a[1]?.shopeeCheckoutUrl || '')
      return success({ saved: true })
    }
    case 'apiAdminListExpenses':
      requireAdmin(a[0])
      return success(expenses.map((item) => ({ ...item })))
    case 'apiAdminGetFinancialSummary': {
      requireAdmin(a[0])
      const verified = payments.filter((payment) => payment.verificationStatus === 'verified')
      const bank = verified.filter((payment) => !['shopee', 'refund'].includes(payment.type)).reduce((sum, payment) => sum + payment.amount, 0)
      const shopee = verified.filter((payment) => payment.type === 'shopee').reduce((sum, payment) => sum + payment.amount, 0)
      const refunds = verified.filter((payment) => payment.type === 'refund').reduce((sum, payment) => sum + payment.amount, 0)
      return success({
        ordersCount: orders.filter((item) => !['creating', 'cancelled'].includes(item.status)).length,
        feeBilled: orders.reduce((sum, item) => sum + Number(item.fee || 0), 0),
        verifiedBankAndCash: bank, verifiedShopeePayments: shopee, verifiedRefunds: refunds,
        outstandingBalances: orders.filter((item) => item.status !== 'cancelled').reduce((sum, item) => sum + Number(item.balance || 0), 0),
        recordedExpenses: expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        allocatedUnitPurchaseCost: units.filter((item) => ['held', 'reserved', 'packed', 'shipped', 'completed'].includes(item.status)).reduce((sum, item) => sum + Number(item.purchasePrice || 0), 0),
      })
    }
    case 'apiAdminAddExpense': {
      requireAdmin(a[0])
      const payload = a[1] || {}
      const duplicate = expenses.find((item) => item.idempotencyKey === payload.idempotencyKey)
      if (duplicate) return success({ expenseId: duplicate.expenseId, reused: true })
      const expense = {
        expenseId: id('demo-expense'), occurredAt: String(payload.occurredAt || now().slice(0, 10)),
        category: String(payload.category || 'Lainnya'), description: String(payload.description || ''),
        amount: Number(payload.amount || 0), orderId: String(payload.orderId || ''),
        idempotencyKey: String(payload.idempotencyKey || ''),
      }
      expenses.push(expense)
      return success({ expenseId: expense.expenseId, reused: false })
    }
    default:
      return failure('MOCK_METHOD_NOT_IMPLEMENTED', 'Method demo belum tersedia: ' + method)
  }
}

export async function handleGasMockCall<T>(method: string, args: unknown[] = []): Promise<T> {
  // Simulate the normal network delay without contacting GAS or changing real data.
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 401)))
  const envelope = await dispatch(method, args)
  if (!envelope.ok) {
    const error = new Error(envelope.error?.message || 'Permintaan demo gagal.') as Error & { code?: string }
    error.code = envelope.error?.code || 'REQUEST_FAILED'
    throw error
  }
  return envelope.data as T
}

export function resetGasMockForTests(): void {
  resetState()
}
