export const MAX_UPLOAD_BYTES = 700_000

const MAX_IMAGE_DIMENSION = 1_920
const IMAGE_QUALITY_STEPS = [0.84, 0.76, 0.68, 0.6, 0.52] as const
const IMAGE_SCALE_STEPS = [1, 0.88, 0.76, 0.64, 0.52] as const

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_UPLOAD_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, 'application/pdf'])

export type PreparedUpload = {
  fileName: string
  mimeType: string
  base64: string
}

export function isImageUploadMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType.toLowerCase())
}

export function isSupportedUploadMimeType(mimeType: string): boolean {
  return SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType.toLowerCase())
}

export function estimateBase64EncodedLength(byteLength: number): number {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return 0
  return Math.ceil(Math.floor(byteLength) / 3) * 4
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const separator = result.indexOf(',')
      if (separator < 0) {
        reject(new Error('File tidak dapat dibaca. Pilih file lain lalu coba kembali.'))
      } else {
        resolve(result.slice(separator + 1))
      }
    }
    reader.onerror = () => reject(new Error('File gagal dibaca. Periksa file lalu coba kembali.'))
    reader.readAsDataURL(file)
  })
}

type DecodedImage = {
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall through to HTMLImageElement for browsers with partial bitmap support.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Foto tidak dapat dibuka oleh browser.'))
      image.src = objectUrl
    })
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('Resolusi foto tidak valid.')
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error instanceof Error
      ? error
      : new Error('Foto tidak dapat dibuka oleh browser.')
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Browser gagal memproses foto.'))
    }, 'image/jpeg', quality)
  })
}

async function compressImage(file: File): Promise<File> {
  const decoded = await decodeImage(file)
  try {
    const longestSide = Math.max(decoded.width, decoded.height)
    if (!longestSide) throw new Error('Resolusi foto tidak valid.')

    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / longestSide)
    const canvas = document.createElement('canvas')
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto-aktual'

    for (const scale of IMAGE_SCALE_STEPS) {
      const width = Math.max(1, Math.round(decoded.width * initialScale * scale))
      const height = Math.max(1, Math.round(decoded.height * initialScale * scale))
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (!context) throw new Error('Browser tidak mendukung kompresi foto.')

      // Flatten transparent PNGs onto white before converting them to JPEG.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(decoded.source, 0, 0, width, height)

      for (const quality of IMAGE_QUALITY_STEPS) {
        const blob = await canvasToJpeg(canvas, quality)
        if (blob.size <= MAX_UPLOAD_BYTES) {
          return new File([blob], baseName + '.jpg', {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
        }
      }
    }

    throw new Error('Foto masih terlalu besar setelah dikompres. Pilih foto dengan resolusi lebih rendah.')
  } finally {
    decoded.cleanup()
  }
}

export async function prepareUploadFile(file: File): Promise<PreparedUpload> {
  if (!file || file.size <= 0) {
    throw new Error('Pilih file yang tidak kosong.')
  }
  if (!isSupportedUploadMimeType(file.type)) {
    throw new Error('Format file harus JPG, PNG, WebP, atau PDF.')
  }

  let preparedFile = file
  if (isImageUploadMimeType(file.type) && file.size > MAX_UPLOAD_BYTES) {
    preparedFile = await compressImage(file)
  }

  if (preparedFile.size > MAX_UPLOAD_BYTES) {
    throw new Error('Ukuran file maksimal 700 KB. File PDF tidak dapat dikompres otomatis.')
  }

  const base64 = await readFileAsBase64(preparedFile)
  if (base64.length > 950_000) {
    throw new Error('Ukuran file setelah diproses masih melebihi batas unggah.')
  }

  return {
    fileName: preparedFile.name,
    mimeType: preparedFile.type,
    base64,
  }
}
