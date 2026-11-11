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
    let settled = false
    const runner = root
      .withSuccessHandler((rawResult) => {
        if (settled) return
        settled = true
        const result = rawResult as ApiEnvelope<T> | null
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
      .withFailureHandler((error) => {
        if (settled) return
        settled = true
        const message = error instanceof Error ? error.message : 'Koneksi ke Apps Script gagal.'
        reject(new GasApiError('GAS_EXECUTION_FAILED', message))
      })

    const serverMethod = runner[method]
    if (typeof serverMethod !== 'function') {
      settled = true
      reject(new GasApiError('API_NOT_FOUND', 'Fungsi backend tidak tersedia: ' + method))
      return
    }

    try {
      ;(serverMethod as (...parameters: unknown[]) => void)(...args)
    } catch (error) {
      settled = true
      reject(error instanceof Error ? error : new Error('Gagal memanggil Apps Script.'))
    }
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

export type AdminRequestGroup = {
  requestGroupId: string
  requestCode: string
  status: string
  createdAt: string
  customerName: string
  customerPhone: string
  items: Array<{
    requestId: string
    productName: string
    variantName: string
    quantity: number
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
