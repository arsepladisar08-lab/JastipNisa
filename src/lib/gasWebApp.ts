const CUSTOMER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,160}$/

export type GasDeepLinkPage = 'portal' | 'admin'

export function normalizeGasWebAppUrl(value: string | undefined | null): string | null {
  const candidate = value?.trim()
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    const isAllowedHost = url.protocol === 'https:' && url.hostname === 'script.google.com'
    const isAllowedPath = /^\/macros\/s\/[A-Za-z0-9_-]+\/(?:exec|dev)\/?$/.test(url.pathname)

    if (!isAllowedHost || !isAllowedPath || url.username || url.password || url.port || url.search || url.hash) {
      return null
    }

    url.pathname = url.pathname.replace(/\/$/, '')
    return url.toString()
  } catch {
    return null
  }
}

export function buildGasUrl(
  baseUrl: string | undefined | null,
  options: { page?: GasDeepLinkPage; token?: string } = {},
): string | null {
  const normalized = normalizeGasWebAppUrl(baseUrl)
  if (!normalized) return null

  const { page, token } = options
  if (page && page !== 'portal' && page !== 'admin') return null
  if (token && (page !== 'portal' || !CUSTOMER_TOKEN_PATTERN.test(token))) return null

  const url = new URL(normalized)
  if (page) url.searchParams.set('page', page)
  if (page === 'portal' && token) url.searchParams.set('t', token)
  return url.toString()
}

export const gasWebAppUrl = normalizeGasWebAppUrl(import.meta.env.VITE_GAS_WEBAPP_URL)
