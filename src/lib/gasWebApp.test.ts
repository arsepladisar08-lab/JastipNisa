import { describe, expect, it } from 'vitest'
import { normalizeGasWebAppUrl } from './gasWebApp'

describe('normalizeGasWebAppUrl', () => {
  it('accepts an HTTPS Apps Script Web App deployment URL', () => {
    expect(normalizeGasWebAppUrl('https://script.google.com/macros/s/AKfycb123_abc-DEF/exec'))
      .toBe('https://script.google.com/macros/s/AKfycb123_abc-DEF/exec')
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
