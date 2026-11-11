import { describe, expect, it } from 'vitest'
import { buildWhatsAppHref } from './whatsapp'

describe('buildWhatsAppHref', () => {
  it('normalizes Indonesian local numbers to country code 62', () => {
    expect(buildWhatsAppHref('081234567890', 'Halo admin'))
      .toBe('https://wa.me/6281234567890?text=Halo%20admin')
    expect(buildWhatsAppHref('81234567890', 'Halo admin'))
      .toBe('https://wa.me/6281234567890?text=Halo%20admin')
  })

  it('preserves an international number and encodes the message', () => {
    expect(buildWhatsAppHref('+6281234567890', 'Halo admin, order #1 & detail'))
      .toBe('https://wa.me/6281234567890?text=Halo%20admin%2C%20order%20%231%20%26%20detail')
  })

  it('returns an empty string for missing or implausible phone numbers', () => {
    expect(buildWhatsAppHref('', 'Halo')).toBe('')
    expect(buildWhatsAppHref(undefined, 'Halo')).toBe('')
    expect(buildWhatsAppHref('123', 'Halo')).toBe('')
    expect(buildWhatsAppHref('0'.repeat(20), 'Halo')).toBe('')
  })
})
