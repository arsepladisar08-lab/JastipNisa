export type CatalogProduct = {
  id?: string
  name: string
  slug: string
  category: string
  officialPrice: number
  officialUrl: string
  imageUrl?: string | null
  sourceCheckedAt: string
  isActive?: boolean
}

export const OFFICIAL_CATALOG_URL =
  import.meta.env.VITE_OFFICIAL_CATALOG_URL || 'https://www.flickabags.com/products'

export const catalogSnapshotDate = '2026-11-11'

export const initialCatalog: CatalogProduct[] = [
  { name: 'Asha Bag', slug: 'asha-bag', category: 'Shoulder bag', officialPrice: 108000, officialUrl: 'https://www.flickabags.com/products/125505/flicka-asha-bag-', imageUrl: 'https://d2kchovjbwl1tk.cloudfront.net/vendor/185/product/Panjang_30_cm_1748077987873_resized128-png.webp', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Daria Bag', slug: 'daria-bag', category: 'Shoulder bag', officialPrice: 119000, officialUrl: 'https://www.flickabags.com/products/125560/flicka-daria-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Gumi Bag', slug: 'gumi-bag', category: 'Everyday bag', officialPrice: 139000, officialUrl: 'https://www.flickabags.com/products/125683/flicka-gumi-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Aspen Bag', slug: 'aspen-bag', category: 'Everyday bag', officialPrice: 189000, officialUrl: 'https://www.flickabags.com/products/900994/flicka-aspen-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'River Tote Bag', slug: 'river-tote-bag', category: 'Tote bag', officialPrice: 199000, officialUrl: 'https://www.flickabags.com/products/871613/flicka-river-tote-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Odelia Bag', slug: 'odelia-bag', category: 'Everyday bag', officialPrice: 139000, officialUrl: 'https://www.flickabags.com/products/856133/flicka-odelia-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Binar Bag', slug: 'binar-bag', category: 'Everyday bag', officialPrice: 169000, officialUrl: 'https://www.flickabags.com/products/856025/flicka-binar-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Talia Bag', slug: 'talia-bag', category: 'Everyday bag', officialPrice: 149000, officialUrl: 'https://www.flickabags.com/products/856021/flicka-talia-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Doha Bag', slug: 'doha-bag', category: 'Everyday bag', officialPrice: 149000, officialUrl: 'https://www.flickabags.com/products/856017/flicka-doha-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Fiji Bag', slug: 'fiji-bag', category: 'Everyday bag', officialPrice: 139000, officialUrl: 'https://www.flickabags.com/products/856016/flicka-fiji-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Capri Bag', slug: 'capri-bag', category: 'Tote bag', officialPrice: 189000, officialUrl: 'https://www.flickabags.com/products/837575/flicka-capri-bag', sourceCheckedAt: catalogSnapshotDate },
  { name: 'Porta Bag', slug: 'porta-bag', category: 'Everyday bag', officialPrice: 179000, officialUrl: 'https://www.flickabags.com/products/800887/flicka-porta-bag', sourceCheckedAt: catalogSnapshotDate },
]

export function mapCatalogRow(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    category: String(row.category || 'Flicka bag'),
    officialPrice: Number(row.official_price || 0),
    officialUrl: String(row.official_product_url),
    imageUrl: typeof row.image_url === 'string' ? row.image_url : null,
    sourceCheckedAt: String(row.source_checked_at || ''),
    isActive: Boolean(row.is_active),
  }
}
