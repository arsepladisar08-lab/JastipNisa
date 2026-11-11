import { describe, expect, it } from 'vitest'
import {
  estimateBase64EncodedLength,
  isImageUploadMimeType,
  isSupportedUploadMimeType,
  prepareUploadFile,
} from './uploadPreparation'

describe('upload preparation helpers', () => {
  it('accepts the image and PDF formats supported by the GAS upload endpoints', () => {
    expect(isSupportedUploadMimeType('image/jpeg')).toBe(true)
    expect(isSupportedUploadMimeType('image/png')).toBe(true)
    expect(isSupportedUploadMimeType('image/webp')).toBe(true)
    expect(isSupportedUploadMimeType('application/pdf')).toBe(true)
    expect(isSupportedUploadMimeType('image/heic')).toBe(false)
  })

  it('identifies image formats separately from PDF proofs', () => {
    expect(isImageUploadMimeType('image/jpeg')).toBe(true)
    expect(isImageUploadMimeType('image/png')).toBe(true)
    expect(isImageUploadMimeType('application/pdf')).toBe(false)
  })

  it('estimates the encoded Base64 payload length', () => {
    expect(estimateBase64EncodedLength(1)).toBe(4)
    expect(estimateBase64EncodedLength(2)).toBe(4)
    expect(estimateBase64EncodedLength(3)).toBe(4)
    expect(estimateBase64EncodedLength(4)).toBe(8)
    expect(estimateBase64EncodedLength(0)).toBe(0)
    expect(estimateBase64EncodedLength(-5)).toBe(0)
  })

  it('rejects an empty file before attempting browser file APIs', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' })
    await expect(prepareUploadFile(emptyFile)).rejects.toThrow('Pilih file yang tidak kosong.')
  })

  it('rejects unsupported formats with a clear message', async () => {
    const unsupportedFile = new File(['content'], 'photo.heic', { type: 'image/heic' })
    await expect(prepareUploadFile(unsupportedFile)).rejects.toThrow(
      'Format file harus JPG, PNG, WebP, atau PDF.',
    )
  })
})
