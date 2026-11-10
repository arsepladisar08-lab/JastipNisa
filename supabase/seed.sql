-- Official Flicka catalog reference snapshot inspected on 2026-11-11.
-- Prices are references only and must be rechecked before quoting customers.
-- This seed does NOT create physical units or claim availability.

insert into public.catalog_products
  (name, slug, category, official_price, official_product_url, image_url, source_url, source_checked_at, is_active, sort_order)
values
  ('Asha Bag', 'asha-bag', 'Shoulder bag', 108000, 'https://www.flickabags.com/products/125505/flicka-asha-bag-', 'https://d2kchovjbwl1tk.cloudfront.net/vendor/185/product/Panjang_30_cm_1748077987873_resized128-png.webp', 'https://www.flickabags.com/products', '2026-11-11', true, 1),
  ('Daria Bag', 'daria-bag', 'Shoulder bag', 119000, 'https://www.flickabags.com/products/125560/flicka-daria-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 2),
  ('Gumi Bag', 'gumi-bag', 'Everyday bag', 139000, 'https://www.flickabags.com/products/125683/flicka-gumi-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 3),
  ('Aspen Bag', 'aspen-bag', 'Everyday bag', 189000, 'https://www.flickabags.com/products/900994/flicka-aspen-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 4),
  ('River Tote Bag', 'river-tote-bag', 'Tote bag', 199000, 'https://www.flickabags.com/products/871613/flicka-river-tote-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 5),
  ('Odelia Bag', 'odelia-bag', 'Everyday bag', 139000, 'https://www.flickabags.com/products/856133/flicka-odelia-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 6),
  ('Binar Bag', 'binar-bag', 'Everyday bag', 169000, 'https://www.flickabags.com/products/856025/flicka-binar-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 7),
  ('Talia Bag', 'talia-bag', 'Everyday bag', 149000, 'https://www.flickabags.com/products/856021/flicka-talia-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 8),
  ('Doha Bag', 'doha-bag', 'Everyday bag', 149000, 'https://www.flickabags.com/products/856017/flicka-doha-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 9),
  ('Fiji Bag', 'fiji-bag', 'Everyday bag', 139000, 'https://www.flickabags.com/products/856016/flicka-fiji-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 10),
  ('Capri Bag', 'capri-bag', 'Tote bag', 189000, 'https://www.flickabags.com/products/837575/flicka-capri-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 11),
  ('Porta Bag', 'porta-bag', 'Everyday bag', 179000, 'https://www.flickabags.com/products/800887/flicka-porta-bag', null, 'https://www.flickabags.com/products', '2026-11-11', true, 12)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  official_price = excluded.official_price,
  official_product_url = excluded.official_product_url,
  image_url = coalesce(excluded.image_url, public.catalog_products.image_url),
  source_url = excluded.source_url,
  source_checked_at = excluded.source_checked_at,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
