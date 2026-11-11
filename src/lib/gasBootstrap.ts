import { normalizeGasWebAppUrl } from './gasWebApp'

const CUSTOMER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,160}$/

export type GasBootstrap = {
  page: 'home' | 'portal' | 'admin'
  token: string
  webAppUrl: string
}

export function normalizeGasBootstrap(value: unknown): GasBootstrap {
  if (!value || typeof value !== 'object') {
    return { page: 'home', token: '', webAppUrl: '' }
  }

  const source = value as Record<string, unknown>
  const page = source.page === 'portal' || source.page === 'admin' ? source.page : 'home'
  const candidateToken = typeof source.token === 'string' ? source.token : ''
  const token = page === 'portal' && CUSTOMER_TOKEN_PATTERN.test(candidateToken) ? candidateToken : ''
  const webAppUrl = normalizeGasWebAppUrl(
    typeof source.webAppUrl === 'string' ? source.webAppUrl : '',
  ) || ''

  return { page, token, webAppUrl }
}

export function getGasInitialRoute(bootstrap: GasBootstrap): string {
  if (bootstrap.page === 'portal') return '/portal'
  if (bootstrap.page === 'admin') return '/admin/login'
  return '/'
}