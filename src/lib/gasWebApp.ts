/**
 * Returns a canonical Apps Script Web App URL or null when the value is not
 * a supported deployment URL. The URL is public configuration, not a secret.
 */
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

export const gasWebAppUrl = normalizeGasWebAppUrl(import.meta.env.VITE_GAS_WEBAPP_URL)
