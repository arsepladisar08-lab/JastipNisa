function createPublicRequest_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw publicError_('INVALID_REQUEST', 'Data request tidak valid.')
  }
  var customerName = cleanText_(payload.customerName, 100, 'Nama')
  var phone = cleanText_(payload.phone, 30, 'Nomor WhatsApp')
  var phoneNormalized = normalizePhone_(phone)
  if (customerName.length < 2 || phoneNormalized.length < 8 || phoneNormalized.length > 15) {
    throw publicError_('INVALID_CUSTOMER', 'Nama dan nomor WhatsApp perlu diperiksa kembali.')
  }

  var submissionId = cleanText_(payload.submissionId, 100, 'ID pengiriman')
  var accessToken = String(payload.accessToken || '')
  if (!/^[A-Za-z0-9_-]{40,160}$/.test(accessToken) || submissionId.length < 16) {
    throw publicError_('INVALID_REQUEST', 'Sesi pengajuan tidak valid. Muat ulang formulir dan coba kembali.')
  }
  var items = payload.items
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw publicError_('INVALID_ITEMS', 'Request harus berisi 1–100 baris produk.')
  }

  var prepared = []
  var catalog = readRecords_('Catalog')
  var variants = readRecords_('Variants')
  var totalQuantity = 0
  items.forEach(function (item) {
    var productId = cleanText_(item.productId, 100, 'Produk')
    var product = catalog.filter(function (row) {
      return String(row.product_id) === productId &&
        (row.is_active === true || String(row.is_active).toLowerCase() === 'true')
    })[0]
    if (!product) throw publicError_('PRODUCT_NOT_AVAILABLE', 'Salah satu produk sudah tidak tersedia di katalog.')

    var variantId = cleanText_(item.variantId || '', 100, 'Varian')
    var variant = null
    if (variantId) {
      variant = variants.filter(function (row) {
        return String(row.variant_id) === variantId &&
          String(row.product_id) === productId &&
          (row.is_active === true || String(row.is_active).toLowerCase() === 'true')
      })[0]
      if (!variant) throw publicError_('VARIANT_NOT_AVAILABLE', 'Varian produk tidak valid atau sudah tidak aktif.')
    }

    var quantity = assertPositiveInteger_(item.quantity, 'Jumlah produk')
    totalQuantity += quantity
    prepared.push({
      product_id: productId,
      variant_id: variantId,
      product_name_snapshot: String(product.name),
      variant_name_snapshot: variant ? String(variant.name) : '',
      quantity: quantity,
      notes: cleanText_(item.notes || '', 500, 'Catatan produk')
    })
  })

  var tokenHash = hmacHex_(accessToken, getCustomerTokenPepper_())
  var payloadHash = sha256Hex_(JSON.stringify({
    customerName: customerName,
    phoneNormalized: phoneNormalized,
    items: prepared.map(function (item) {
      return {
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity,
        notes: item.notes
      }
    })
  }))
  return withScriptLock_(function () {
    var previous = readRecords_('Request_Groups').filter(function (row) {
      return String(row.client_submission_id) === submissionId
    })[0]
    if (previous) {
      if (!constantTimeEqual_(previous.access_token_hash, tokenHash)) {
        throw publicError_('DUPLICATE_SUBMISSION', 'ID pengajuan sudah digunakan. Buat pengajuan baru.')
      }
      if (!previous.payload_hash || !constantTimeEqual_(previous.payload_hash, payloadHash)) {
        throw publicError_('IDEMPOTENCY_CONFLICT', 'Data pengajuan berbeda dari percobaan sebelumnya. Muat ulang formulir dan buat pengajuan baru sebelum mencoba kembali.')
      }
      return {
        requestGroupId: String(previous.request_group_id),
        requestCode: String(previous.request_code),
        accessToken: accessToken,
        productCount: totalQuantity,
        estimatedJastipFee: calculateJastipFee_(totalQuantity),
        reusedSubmission: true
      }
    }

    var now = isoNow_()
    var buyerId = newId_()
    var groupId = newId_()
    var requestCode = makeRequestCode_()
    appendRecords_('Buyers', [{
      buyer_id: buyerId,
      name: customerName,
      phone: phone,
      phone_normalized: phoneNormalized,
      address: '',
      shopee_username: '',
      notes: '',
      created_at: now,
      updated_at: now
    }])
    appendRecords_('Request_Groups', [{
      request_group_id: groupId,
      request_code: requestCode,
      client_submission_id: submissionId,
      buyer_id: buyerId,
      status: 'new',
      access_token_hash: tokenHash,
      access_token_created_at: now,
      access_token_revoked_at: '',
      order_id: '',
      payload_hash: payloadHash,
      created_at: now,
      updated_at: now
    }])
    appendRecords_('Requests', prepared.map(function (item) {
      return {
        request_id: newId_(),
        request_group_id: groupId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name_snapshot: item.product_name_snapshot,
        variant_name_snapshot: item.variant_name_snapshot,
        quantity: item.quantity,
        notes: item.notes,
        status: 'new',
        actual_photo_file_ids_json: '[]',
        actual_condition: '',
        customer_decision: '',
        unit_ids_json: '[]',
        created_at: now,
        updated_at: now
      }
    }))
    appendAudit_('customer', groupId, 'request_created', 'request_group', groupId, {
      itemLines: prepared.length,
      productCount: totalQuantity
    })
    return {
      requestGroupId: groupId,
      requestCode: requestCode,
      accessToken: accessToken,
      productCount: totalQuantity,
      estimatedJastipFee: calculateJastipFee_(totalQuantity),
      reusedSubmission: false
    }
  })
}

function customerRespondToItem_(accessToken, requestId, decision) {
  var nextDecision = String(decision || '')
  if (['approved', 'rejected'].indexOf(nextDecision) === -1) {
    throw publicError_('INVALID_DECISION', 'Pilihan persetujuan tidak valid.')
  }

  return withScriptLock_(function () {
    // Revalidate the bearer token and all mutable item state while serialized
    // with admin edits, token revocation, and unit allocation.
    var group = findRequestGroupByToken_(accessToken)
    var request = findRecord_('Requests', 'request_id', requestId)
    if (!request || String(request.request_group_id) !== String(group.request_group_id)) {
      throw publicError_('NOT_FOUND', 'Item request tidak ditemukan.')
    }
    if (String(request.status) !== 'found') {
      throw publicError_('INVALID_STATE', 'Persetujuan hanya dapat diberikan setelah admin menemukan barang.')
    }
    var photoIds = safeJsonParse_(request.actual_photo_file_ids_json, [])
    if (!photoIds.length) {
      throw publicError_('PHOTO_REQUIRED', 'Foto aktual belum tersedia untuk diperiksa.')
    }

    var currentDecision = String(request.customer_decision || '')
    if (currentDecision) {
      if (currentDecision === nextDecision) {
        return { saved: true, decision: nextDecision, reused: true }
      }
      throw publicError_('DECISION_ALREADY_RECORDED', 'Keputusan untuk item ini sudah tercatat. Hubungi admin bila perlu perubahan.')
    }

    if (nextDecision === 'rejected') {
      // Releasing held units here prevents a rejected item from blocking stock.
      // Reserved units cannot exist before the approved final-order workflow.
      var heldUnitIds = safeJsonParse_(request.unit_ids_json, [])
      heldUnitIds.forEach(function (unitId) {
        var unit = findRecord_('Units', 'unit_id', unitId)
        if (unit && String(unit.status) === 'held' &&
            String(unit.held_request_id) === String(requestId) &&
            !String(unit.reserved_order_id || '')) {
          updateRecord_('Units', 'unit_id', unitId, {
            status: 'available',
            held_request_id: '',
            updated_at: isoNow_()
          })
        }
      })
      updateRecord_('Requests', 'request_id', requestId, {
        customer_decision: nextDecision,
        unit_ids_json: '[]',
        updated_at: isoNow_()
      })
    } else {
      updateRecord_('Requests', 'request_id', requestId, {
        customer_decision: nextDecision,
        updated_at: isoNow_()
      })
    }

    appendAudit_('customer', group.request_group_id, 'item_' + nextDecision, 'request', requestId, {})
    return { saved: true, decision: nextDecision, reused: false }
  })
}
function submitCustomerOrderDetails_(accessToken, details) {
  var group = findRequestGroupByToken_(accessToken)
  var name = cleanText_(details && details.name, 100, 'Nama')
  var phone = cleanText_(details && details.phone, 30, 'Nomor WhatsApp')
  var address = cleanText_(details && details.address, 1000, 'Alamat')
  var phoneNormalized = normalizePhone_(phone)
  if (name.length < 2 || phoneNormalized.length < 8 || phoneNormalized.length > 15 || address.length < 8) {
    throw publicError_('INVALID_CUSTOMER_DETAILS', 'Nama, nomor WhatsApp, dan alamat perlu dilengkapi.')
  }

  return withScriptLock_(function () {
    var requests = readRecords_('Requests').filter(function (row) {
      return String(row.request_group_id) === String(group.request_group_id)
    })
    if (!requests.length || requests.some(function (row) {
      return String(row.status) !== 'found' || String(row.customer_decision) !== 'approved'
    })) {
      throw publicError_('ITEMS_NOT_APPROVED', 'Lengkapi persetujuan foto seluruh produk yang ditemukan sebelum mengirim format order.')
    }

    var buyer = findRecord_('Buyers', 'buyer_id', group.buyer_id)
    if (!buyer) throw publicError_('BUYER_NOT_FOUND', 'Data pelanggan tidak ditemukan.')
    updateRecord_('Buyers', 'buyer_id', group.buyer_id, {
      name: name,
      phone: phone,
      phone_normalized: phoneNormalized,
      address: address,
      updated_at: isoNow_()
    })
    updateRecord_('Request_Groups', 'request_group_id', group.request_group_id, {
      status: 'customer_details_received',
      updated_at: isoNow_()
    })
    appendAudit_('customer', group.request_group_id, 'order_details_submitted', 'request_group', group.request_group_id, {})
    return { saved: true, status: 'customer_details_received' }
  })
}

function confirmCustomerShopee_(accessToken, username) {
  var group = findRequestGroupByToken_(accessToken)
  var value = cleanText_(username, 80, 'Nama akun Shopee')
  if (value.length < 2) throw publicError_('INVALID_SHOPEE_USERNAME', 'Nama akun Shopee perlu diisi.')
  var orders = readRecords_('Orders').filter(function (row) {
    return String(row.request_group_id) === String(group.request_group_id)
  })
  if (!orders.length || !orders[0].shopee_checkout_url) {
    throw publicError_('SHOPEE_NOT_READY', 'Link checkout Shopee belum diberikan admin.')
  }
  withScriptLock_(function () {
    updateRecord_('Orders', 'order_id', orders[0].order_id, {
      shopee_username: value,
      updated_at: isoNow_()
    })
    updateRecord_('Buyers', 'buyer_id', group.buyer_id, {
      shopee_username: value,
      updated_at: isoNow_()
    })
    appendAudit_('customer', group.request_group_id, 'shopee_username_confirmed', 'order', orders[0].order_id, {})
  })
  return { saved: true }
}
