import { describe, expect, it } from 'vitest'
import { getGasInitialRoute, normalizeGasBootstrap } from './gasBootstrap'

const webAppUrl = 'https://script.google.com/macros/s/deployment_123/exec'
const validToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('normalizeGasBootstrap', () => {
  it('accepts a valid customer portal bootstrap', () => {
    expect(normalizeGasBootstrap({ page: 'portal', token: validToken, webAppUrl })).toEqual({
      page: 'portal',
      token: validToken,
      webAppUrl,
    })
  })

  it('ignores an invalid token without changing the portal destination', () => {
    expect(normalizeGasBootstrap({ page: 'portal', token: 'invalid', webAppUrl })).toEqual({
      page: 'portal',
      token: '',
      webAppUrl,
    })
  })

  it('does not accept customer tokens for the admin destination', () => {
    expect(normalizeGasBootstrap({ page: 'admin', token: validToken, webAppUrl }).token).toBe('')
  })

  it('falls back to home for unrecognized pages and unsafe deployment URLs', () => {
    expect(normalizeGasBootstrap({ page: 'private', token: validToken, webAppUrl: 'https://evil.example' }))
      .toEqual({ page: 'home', token: '', webAppUrl: '' })
    expect(normalizeGasBootstrap(null)).toEqual({ page: 'home', token: '', webAppUrl: '' })
  })
})

describe('getGasInitialRoute', () => {
  it('maps portal and admin deep links to their app routes', () => {
    expect(getGasInitialRoute(normalizeGasBootstrap({ page: 'portal' }))).toBe('/portal')
    expect(getGasInitialRoute(normalizeGasBootstrap({ page: 'admin' }))).toBe('/admin/login')
    expect(getGasInitialRoute(normalizeGasBootstrap({ page: 'home' }))).toBe('/')
  })
})