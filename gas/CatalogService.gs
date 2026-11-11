function saveCatalogProductAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var name = cleanText_(payload && payload.name, 120, 'Nama produk')
  var slug = cleanText_(payload && payload.slug, 140, 'Slug')
  var category = cleanText_(payload && payload.category || '', 80, 'Kategori')
  var officialUrl = cleanText_(payload && payload.officialUrl, 500, 'URL katalog resmi')
  var imageUrl = cleanText_(payload && payload.imageUrl || '', 500, 'URL gambar')
  var price = Number(payload && payload.referencePrice || 0)
  if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !/^https:\/\/.+/i.test(officialUrl) ||
      (imageUrl && !/^https:\/\/.+/i.test(imageUrl)) ||
      !Number.isFinite(price) || price < 0) {
    throw publicError_('INVALID_CATALOG_PRODUCT', 'Periksa nama, slug, URL resmi, gambar, dan harga referensi.')
  }

  return withScriptLock_(function () {
    var records = readRecords_('Catalog')
    var productId = cleanText_(payload.productId || '', 100, 'ID produk') || newId_()
    var duplicateSlug = records.some(function (row) {
      return String(row.slug).toLowerCase() === slug.toLowerCase() &&
        String(row.product_id) !== productId
    })
    if (duplicateSlug) throw publicError_('DUPLICATE_SLUG', 'Slug produk sudah digunakan.')
    var existing = findRecord_('Catalog', 'product_id', productId)
    var now = isoNow_()
    var record = {
      product_id: productId,
      name: name,
      slug: slug,
      category: category,
      official_price: price,
      official_url: officialUrl,
      image_url: imageUrl,
      source_checked_at: cleanText_(payload.sourceCheckedAt || now.slice(0, 10), 30, 'Tanggal verifikasi sumber'),
      is_active: payload.isActive !== false,
      sort_order: Number(payload.sortOrder || 0),
      created_at: existing ? existing.created_at : now,
      updated_at: now
    }
    if (existing) updateRecord_('Catalog', 'product_id', productId, record)
    else appendRecords_('Catalog', [record])
    appendAudit_('admin', session.role, existing ? 'catalog_updated' : 'catalog_created', 'catalog_product', productId, {})
    return { productId: productId, saved: true }
  })
}

function saveVariantAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var productId = cleanText_(payload && payload.productId, 100, 'Produk')
  var name = cleanText_(payload && payload.name, 100, 'Nama varian')
  var imageUrl = cleanText_(payload && payload.imageUrl || '', 500, 'URL gambar varian')
  if (!productId || name.length < 1 || (imageUrl && !/^https:\/\/.+/i.test(imageUrl))) {
    throw publicError_('INVALID_VARIANT', 'Periksa produk, nama varian, dan URL gambar.')
  }

  return withScriptLock_(function () {
    if (!findRecord_('Catalog', 'product_id', productId)) {
      throw publicError_('PRODUCT_NOT_FOUND', 'Produk katalog tidak ditemukan.')
    }
    var records = readRecords_('Variants')
    var variantId = cleanText_(payload.variantId || '', 100, 'ID varian') || newId_()
    var duplicate = records.some(function (row) {
      return String(row.product_id) === productId &&
        String(row.name).toLowerCase() === name.toLowerCase() &&
        String(row.variant_id) !== variantId
    })
    if (duplicate) throw publicError_('DUPLICATE_VARIANT', 'Nama varian sudah tercatat pada produk ini.')
    var existing = findRecord_('Variants', 'variant_id', variantId)
    var now = isoNow_()
    var record = {
      variant_id: variantId,
      product_id: productId,
      name: name,
      image_url: imageUrl,
      is_active: payload.isActive !== false,
      created_at: existing ? existing.created_at : now,
      updated_at: now
    }
    if (existing) updateRecord_('Variants', 'variant_id', variantId, record)
    else appendRecords_('Variants', [record])
    appendAudit_('admin', session.role, existing ? 'variant_updated' : 'variant_created', 'catalog_variant', variantId, {})
    return { variantId: variantId, saved: true }
  })
}
