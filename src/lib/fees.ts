export function calculateJastipFee(productCount: number): number {
  const count = Math.max(0, Math.floor(Number.isFinite(productCount) ? productCount : 0))
  if (count === 0) return 0
  if (count === 1) return 15_000
  return 25_000 + (count - 2) * 10_000
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}
