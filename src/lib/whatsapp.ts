export function buildWhatsAppHref(phone: string | undefined | null, message: string): string {
  let number = String(phone || '').replace(/\D/g, '')
  if (number.startsWith('0')) number = '62' + number.slice(1)
  else if (number.startsWith('8')) number = '62' + number
  if (number.length < 9 || number.length > 15) return ''
  return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message)
}
