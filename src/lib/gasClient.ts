export type ApiErrorShape = {
  code: string
  message: string
}

export type ApiEnvelope<T> = {
  ok: boolean
  data: T | null
  error: ApiErrorShape | null
}

type GoogleScriptRun = {
  withSuccessHandler(handler: (result: unknown) => void): GoogleScriptRun
  withFailureHandler(handler: (error: unknown) => void): GoogleScriptRun
  [method: string]: unknown
}

declare global {
  interface Window {
    google?: {
      script?: {
        run: GoogleScriptRun
      }
    }
  }
}

const MAX_CONCURRENT_GAS_CALLS = 8
let activeGasCalls = 0
const gasCallQueue: Array<() => void> = []

function drainGasQueue() {
  while (activeGasCalls < MAX_CONCURRENT_GAS_CALLS && gasCallQueue.length > 0) {
    const next = gasCallQueue.shift()
    next?.()
  }
}

export class GasApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'GasApiError'
    this.code = code
  }
}

export function gasCall<T>(method: string, ...args: unknown[]): Promise<T> {
  const root = window.google?.script?.run
  if (!root) {
    return Promise.reject(new GasApiError(
      'GAS_BRIDGE_UNAVAILABLE',
      'Backend Apps Script belum terhubung. Buka aplikasi dari URL Web App GAS atau gunakan deployment staging.',
    ))
  }

  return new Promise<T>((resolve, reject) => {
    const execute = () => {
      activeGasCalls += 1
      let settled = false
      const finish = (callback: () => void) => {
        if (settled) return
        settled = true
        activeGasCalls = Math.max(0, activeGasCalls - 1)
        callback()
        drainGasQueue()
      }
      const runner = root
        .withSuccessHandler((rawResult) => {
          const result = rawResult as ApiEnvelope<T> | null
          finish(() => {
            if (!result || typeof result.ok !== 'boolean') {
              reject(new GasApiError('INVALID_RESPONSE', 'Respons server tidak dapat dibaca.'))
              return
            }
            if (!result.ok) {
              reject(new GasApiError(
                result.error?.code || 'REQUEST_FAILED',
                result.error?.message || 'Permintaan belum dapat diproses.',
              ))
              return
            }
            resolve(result.data as T)
          })
        })
        .withFailureHandler((error) => {
          const message = error instanceof Error ? error.message : 'Koneksi ke Apps Script gagal.'
          finish(() => reject(new GasApiError('GAS_EXECUTION_FAILED', message)))
        })

      const serverMethod = runner[method]
      if (typeof serverMethod !== 'function') {
        finish(() => reject(new GasApiError('API_NOT_FOUND', 'Fungsi backend tidak tersedia: ' + method)))
        return
      }

      try {
        ;(serverMethod as (...parameters: unknown[]) => void).apply(runner, args)
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error('Gagal memanggil Apps Script.')))
      }
    }
    gasCallQueue.push(execute)
    drainGasQueue()
  })
}

export type CatalogProduct = {
  productId: string
  name: string
  slug: string
  category: string
  referencePrice: number
  officialUrl: string
  imageUrl: string
  sourceCheckedAt: string
}

export type CatalogVariant = {
  variantId: string
  productId: string
  name: string
  imageUrl: string
}

export type RequestItemInput = {
  productId: string
  variantId?: string
  quantity: number
  notes?: string
}

export type CreatedRequest = {
  requestGroupId: string
  requestCode: string
  accessToken: string
  productCount: number
  estimatedJastipFee: number
  reusedSubmission: boolean
}

export type CustomerPortal = {
  requestCode: string
  status: string
  createdAt: string
  items: Array<{
    requestId: string
    productName: string
    variantName: string
    quantity: number
    status: string
    actualCondition: string
    customerDecision: string
    photoCount: number
  }>
  order: null | {
    orderCode: string
    status: string
    totalAmount: number
    paymentStatus: string
    shopeeCheckoutUrl: string
    trackingNumber: string
    courier: string
  }
}

export type AdminDashboard = {
  requestGroups: number
  itemsSearching: number
  itemsFound: number
  unitsAvailable: number
  activeOrders: number
  paymentsAwaitingVerification: number
}

export type AdminRequestPayment = {
  paymentId: string
  type: string
  amount: number
  method: string
  verificationStatus: string
  occurredAt: string
  notes: string
  hasProof: boolean
}

export type AdminRequestGroup = {
  requestGroupId: string
  orderId: string
  requestCode: string
  status: string
  createdAt: string
  customerName: string
  customerPhone: string
  customerAddress: string
  verifiedDepositAmount: number
  payments: AdminRequestPayment[]
  items: Array<{
    requestId: string
    productId: string
    variantId: string
    productName: string
    variantName: string
    quantity: number
    assignedUnitCount: number
    status: string
    actualCondition: string
    customerDecision: string
  }>
}

export function getPublicCatalog() {
  return gasCall<{ products: CatalogProduct[]; variants: CatalogVariant[] }>('apiPublicGetCatalog')
}

export function getPublicConfig() {
  return gasCall<Record<string, string>>('apiPublicGetConfig')
}

export function createRequest(payload: {
  customerName: string
  phone: string
  submissionId: string
  accessToken: string
  items: RequestItemInput[]
}) {
  return gasCall<CreatedRequest>('apiPublicCreateRequest', payload)
}

export function getCustomerPortal(token: string) {
  return gasCall<CustomerPortal>('apiCustomerGetPortal', token)
}

export function getCustomerPhoto(token: string, requestId: string, index: number) {
  return gasCall<{ mimeType: string; base64: string }>('apiCustomerGetPhoto', token, requestId, index)
}

export function respondToRequestItem(token: string, requestId: string, decision: 'approved' | 'rejected') {
  return gasCall<{ saved: boolean; decision: string }>('apiCustomerRespondToItem', token, requestId, decision)
}

export function submitOrderDetails(token: string, payload: { name: string; phone: string; address: string }) {
  return gasCall<{ saved: boolean; status: string }>('apiCustomerSubmitOrderDetails', token, payload)
}

export function adminLogin(password: string) {
  return gasCall<{ sessionToken: string; expiresInSeconds: number }>('apiAdminLogin', password)
}

export function getAdminDashboard(sessionToken: string) {
  return gasCall<AdminDashboard>('apiAdminGetDashboard', sessionToken)
}

export function listAdminRequests(sessionToken: string, status = 'all') {
  return gasCall<AdminRequestGroup[]>('apiAdminListRequests', sessionToken, status)
}

export function updateAdminRequestItem(
  sessionToken: string,
  payload: { requestId: string; status: 'new' | 'searching' | 'found' | 'not_found'; actualCondition: string },
) {
  return gasCall<{ saved: boolean; groupStatus: string }>('apiAdminUpdateRequestItem', sessionToken, payload)
}

export function uploadAdminRequestPhoto(
  sessionToken: string,
  payload: { requestId: string; fileName: string; mimeType: string; base64: string },
) {
  return gasCall<{ uploaded: boolean; photoCount: number }>('apiAdminUploadRequestPhoto', sessionToken, payload)
}

export function logoutAdmin(sessionToken: string) {
  return gasCall<{ signedOut: boolean }>('apiAdminLogout', sessionToken)
}

export function addAdminUnit(
  sessionToken: string,
  payload: {
    unitCode: string
    productId: string
    variantId?: string
    purchasePrice: number
    sellingPrice: number
    conditionNotes?: string
  },
) {
  return gasCall<{ unitId: string; unitCode: string; status: string }>('apiAdminAddUnit', sessionToken, payload)
}

export function assignAdminUnit(sessionToken: string, requestId: string, unitId: string) {
  return gasCall<{ assigned: boolean; assignedCount: number; requiredCount: number }>(
    'apiAdminAssignUnit',
    sessionToken,
    requestId,
    unitId,
  )
}

export function createAdminOrder(sessionToken: string, requestGroupId: string) {
  return gasCall<{
    orderId: string
    orderCode: string
    productCount: number
    subtotal: number
    fee: number
    total: number
  }>('apiAdminCreateOrder', sessionToken, requestGroupId)
}

export function confirmCustomerShopee(token: string, username: string) {
  return gasCall<{ saved: boolean }>('apiCustomerConfirmShopee', token, username)
}

export function uploadAdminPaymentProof(
  sessionToken: string,
  payload: { fileName: string; mimeType: string; base64: string },
) {
  return gasCall<{ fileId: string; fileName: string }>('apiAdminUploadPaymentProof', sessionToken, payload)
}

export function addAdminPayment(
  sessionToken: string,
  payload: {
    requestGroupId?: string
    orderId?: string
    type: 'deposit' | 'settlement' | 'shipping' | 'refund' | 'shopee'
    amount: number
    method: string
    proofFileId?: string
    idempotencyKey: string
    notes?: string
  },
) {
  return gasCall<{ paymentId: string; verificationStatus: string; reused: boolean }>(
    'apiAdminAddPayment',
    sessionToken,
    payload,
  )
}

export function verifyAdminPayment(
  sessionToken: string,
  paymentId: string,
  decision: 'verified' | 'rejected',
) {
  return gasCall<{ saved: boolean; verificationStatus: string }>(
    'apiAdminVerifyPayment',
    sessionToken,
    paymentId,
    decision,
  )
}

export function getAdminPaymentProof(sessionToken: string, paymentId: string) {
  return gasCall<{ fileName: string; mimeType: string; base64: string }>(
    'apiAdminGetPaymentProof',
    sessionToken,
    paymentId,
  )
}

export type AdminCatalogProduct = CatalogProduct & {
  isActive: boolean
  sortOrder: number
}

export type AdminCatalogVariant = CatalogVariant & {
  isActive: boolean
}

export type AdminOrder = {
  orderId: string
  orderCode: string
  requestGroupId: string
  customerName: string
  customerPhone: string
  shippingAddress: string
  productCount: number
  subtotal: number
  fee: number
  shippingFee: number
  totalAmount: number
  totalPaid: number
  balance: number
  paymentStatus: string
  status: string
  shopeeUsername: string
  shopeeCheckoutUrl: string
  courier: string
  trackingNumber: string
  shipmentStatus: string
  createdAt: string
  payments: AdminRequestPayment[]
}

export function listAdminCatalog(sessionToken: string) {
  return gasCall<{ products: AdminCatalogProduct[]; variants: AdminCatalogVariant[] }>(
    'apiAdminListCatalog',
    sessionToken,
  )
}

export function saveAdminCatalogProduct(
  sessionToken: string,
  payload: {
    productId?: string
    name: string
    slug: string
    category?: string
    referencePrice: number
    officialUrl: string
    imageUrl?: string
    sourceCheckedAt: string
    isActive: boolean
    sortOrder?: number
  },
) {
  return gasCall<{ productId: string; saved: boolean }>('apiAdminSaveCatalogProduct', sessionToken, payload)
}

export function saveAdminVariant(
  sessionToken: string,
  payload: {
    variantId?: string
    productId: string
    name: string
    imageUrl?: string
    isActive: boolean
  },
) {
  return gasCall<{ variantId: string; saved: boolean }>('apiAdminSaveVariant', sessionToken, payload)
}

export function listAdminOrders(sessionToken: string) {
  return gasCall<AdminOrder[]>('apiAdminListOrders', sessionToken)
}

export function updateAdminShipment(
  sessionToken: string,
  payload: {
    orderId: string
    courier: string
    trackingNumber: string
    status: 'preparing' | 'shipped' | 'delivered' | 'issue'
    notes?: string
  },
) {
  return gasCall<{ saved: boolean; status: string; orderStatus: string }>(
    'apiAdminUpdateShipment',
    sessionToken,
    payload,
  )
}

export function updateAdminOrderOptions(
  sessionToken: string,
  payload: { orderId: string; shopeeCheckoutUrl: string },
) {
  return gasCall<{ saved: boolean }>('apiAdminUpdateOrderOptions', sessionToken, payload)
}


export type AdminExpense = {
  expenseId: string
  occurredAt: string
  category: string
  description: string
  amount: number
  orderId: string
}

export type AdminFinancialSummary = {
  ordersCount: number
  feeBilled: number
  verifiedBankAndCash: number
  verifiedShopeePayments: number
  verifiedRefunds: number
  outstandingBalances: number
  recordedExpenses: number
  allocatedUnitPurchaseCost: number
}

export function listAdminExpenses(sessionToken: string) {
  return gasCall<AdminExpense[]>('apiAdminListExpenses', sessionToken)
}

export function getAdminFinancialSummary(sessionToken: string) {
  return gasCall<AdminFinancialSummary>('apiAdminGetFinancialSummary', sessionToken)
}

export function addAdminExpense(
  sessionToken: string,
  payload: {
    occurredAt: string
    category: string
    description: string
    amount: number
    orderId?: string
    idempotencyKey: string
  },
) {
  return gasCall<{ expenseId: string; reused: boolean }>('apiAdminAddExpense', sessionToken, payload)
}
