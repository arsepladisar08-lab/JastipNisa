import { describe, expect, it } from 'vitest'
import { buildGasUrl, normalizeGasWebAppUrl } from './gasWebApp'

const deploymentUrl = 'https://script.google.com/macros/s/AKfycb123_abc-DEF/exec'
const validToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('normalizeGasWebAppUrl', () => {
  it('accepts an HTTPS Apps Script Web App deployment URL', () => {
    expect(normalizeGasWebAppUrl(deploymentUrl)).toBe(deploymentUrl)
  })

  it('accepts the development deployment and removes a trailing slash', () => {
    expect(normalizeGasWebAppUrl('https://script.google.com/macros/s/deployment_123/dev/'))
      .toBe('https://script.google.com/macros/s/deployment_123/dev')
  })

  it('returns null when the setting is empty', () => {
    expect(normalizeGasWebAppUrl('  ')).toBeNull()
    expect(normalizeGasWebAppUrl(undefined)).toBeNull()
  })

  it('rejects non-HTTPS URLs and untrusted hosts', () => {
    expect(normalizeGasWebAppUrl('http://script.google.com/macros/s/deployment/exec')).toBeNull()
    expect(normalizeGasWebAppUrl('https://example.com/macros/s/deployment/exec')).toBeNull()
    expect(normalizeGasWebAppUrl('https://script.google.com.evil.example/macros/s/deployment/exec')).toBeNull()
  })

  it('rejects arbitrary paths, credentials, query strings, and fragments', () => {
    expect(normalizeGasWebAppUrl('https://script.google.com/')).toBeNull()
    expect(normalizeGasWebAppUrl('https://user:pass@script.google.com/macros/s/deployment/exec')).toBeNull()
    expect(normalizeGasWebAppUrl('https://script.google.com/macros/s/deployment/exec?next=https://evil.example')).toBeNull()
    expect(normalizeGasWebAppUrl('https://script.google.com/macros/s/deployment/exec#/admin')).toBeNull()
  })
})

describe('buildGasUrl', () => {
  it('builds a portal deep link with a validated token', () => {
    expect(buildGasUrl(deploymentUrl, { page: 'portal', token: validToken }))
      .toBe(deploymentUrl + '?page=portal&t=' + validToken)
  })

  it('builds an admin deep link without adding a customer token', () => {
    expect(buildGasUrl(deploymentUrl, { page: 'admin' }))
      .toBe(deploymentUrl + '?page=admin')
  })

  it('keeps the homepage URL free from query parameters', () => {
    expect(buildGasUrl(deploymentUrl)).toBe(deploymentUrl)
  })

  it('rejects malformed tokens and tokens on admin links', () => {
    expect(buildGasUrl(deploymentUrl, { page: 'portal', token: 'not-a-token' })).toBeNull()
    expect(buildGasUrl(deploymentUrl, { page: 'admin', token: validToken })).toBeNull()
  })
})
