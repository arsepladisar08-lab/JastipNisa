function updateRequestItemAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var requestId = cleanText_(payload && payload.requestId, 100, 'Request')
  var nextStatus = String(payload && payload.status || '')
  var allowed = ['new', 'searching', 'found', 'not_found']
  if (allowed.indexOf(nextStatus) === -1) throw publicError_('INVALID_STATUS', 'Status pencarian tidak valid.')

  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var request = findRecord_('Requests', 'request_id', requestId)
    if (!request) throw publicError_('NOT_FOUND', 'Request item tidak ditemukan.')
    var current = String(request.status)
    var transitions = {
      new: ['new', 'searching'],
      searching: ['searching', 'found', 'not_found'],
      found: ['found', 'searching'],
      not_found: ['not_found', 'searching']
    }
    if (!transitions[current] || transitions[current].indexOf(nextStatus) === -1) {
      throw publicError_('INVALID_TRANSITION', 'Perubahan status tidak diizinkan dari status saat ini.')
    }

    var nextCondition = cleanText_(payload.actualCondition || '', 1000, 'Catatan kondisi')
    var patch = {
      status: nextStatus,
      actual_condition: nextCondition,
      updated_at: isoNow_()
    }
    if (current === 'found' && nextStatus === 'found' &&
        String(request.actual_condition || '') !== nextCondition) {
      patch.customer_decision = ''
    }
    if (current === 'found' && nextStatus === 'searching') {
      // A new search cycle invalidates the previous photo approval and releases
      // units that were only held for this request (never reserved by an order).
      var heldUnitIds = safeJsonParse_(request.unit_ids_json, [])
      heldUnitIds.forEach(function (unitId) {
        var unit = findRecord_('Units', 'unit_id', unitId)
        if (unit && String(unit.status) === 'held' &&
            String(unit.held_request_id) === requestId &&
            !String(unit.reserved_order_id || '')) {
          updateRecord_('Units', 'unit_id', unitId, {
            status: 'available',
            held_request_id: '',
            updated_at: isoNow_()
          })
        }
      })
      patch.customer_decision = ''
      patch.actual_photo_file_ids_json = '[]'
      patch.unit_ids_json = '[]'
    }
    updateRecord_('Requests', 'request_id', requestId, patch)

    var groupId = String(request.request_group_id)
    var groupItems = readRecords_('Requests').filter(function (row) {
      return String(row.request_group_id) === groupId
    })
    var groupStatus = 'searching'
    if (groupItems.every(function (row) { return ['found', 'not_found'].indexOf(String(row.request_id) === requestId ? nextStatus : String(row.status)) !== -1 })) {
      groupStatus = groupItems.some(function (row) {
        return String(row.request_id) === requestId ? nextStatus === 'not_found' : String(row.status) === 'not_found'
      }) ? 'partial_availability' : 'awaiting_customer_approval'
    }
    updateRecord_('Request_Groups', 'request_group_id', groupId, {
      status: groupStatus,
      updated_at: isoNow_()
    })
    appendAudit_('admin', session.role, 'request_status_' + nextStatus, 'request', requestId, {})
    return { saved: true, groupStatus: groupStatus }
  })
}

function reissueCustomerAccessTokenAsAdmin_(sessionToken, requestGroupId) {
  var session = requireAdmin_(sessionToken)
  var groupId = cleanText_(requestGroupId, 100, 'Request')

  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var group = findRecord_('Request_Groups', 'request_group_id', groupId)
    if (!group) throw publicError_('NOT_FOUND', 'Request pelanggan tidak ditemukan.')

    // The new high-entropy token replaces the old hash; the old token stops
    // working immediately. Only the new plaintext is returned to the admin.
    var accessToken = createSessionToken_()
    var now = isoNow_()
    updateRecord_('Request_Groups', 'request_group_id', groupId, {
      access_token_hash: customerTokenHash_(accessToken),
      access_token_created_at: now,
      access_token_revoked_at: '',
      updated_at: now
    })
    try {
      appendAudit_('admin', session.role, 'customer_access_token_reissued', 'request_group', groupId, {
        requestCode: String(group.request_code)
      })
    } catch (auditError) {
      console.error('Customer token reissue audit could not be written: ' + String(auditError))
    }
    return { accessToken: accessToken, requestCode: String(group.request_code) }
  })
}

function revokeCustomerAccessTokenAsAdmin_(sessionToken, requestGroupId) {
  var session = requireAdmin_(sessionToken)
  var groupId = cleanText_(requestGroupId, 100, 'Request')

  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var group = findRecord_('Request_Groups', 'request_group_id', groupId)
    if (!group) throw publicError_('NOT_FOUND', 'Request pelanggan tidak ditemukan.')
    if (group.access_token_revoked_at) {
      return { revoked: true, alreadyRevoked: true }
    }

    var now = isoNow_()
    updateRecord_('Request_Groups', 'request_group_id', groupId, {
      access_token_revoked_at: now,
      updated_at: now
    })
    try {
      appendAudit_('admin', session.role, 'customer_access_token_revoked', 'request_group', groupId, {
        requestCode: String(group.request_code)
      })
    } catch (auditError) {
      console.error('Customer token revoke audit could not be written: ' + String(auditError))
    }
    return { revoked: true, alreadyRevoked: false }
  })
}

function addUnitAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var unitCode = cleanText_(payload && payload.unitCode, 50, 'Kode unit')
  var productId = cleanText_(payload && payload.productId, 100, 'Produk')
  var variantId = cleanText_(payload && payload.variantId || '', 100, 'Varian')
  var purchasePrice = Number(payload && payload.purchasePrice || 0)
  var sellingPrice = Number(payload && payload.sellingPrice || 0)
  if (!unitCode || !productId || !Number.isFinite(purchasePrice) || purchasePrice < 0 ||
      !Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw publicError_('INVALID_UNIT', 'Periksa kode unit, produk, dan nominal harga.')
  }

  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    if (readRecords_('Units').some(function (row) { return String(row.unit_code).toLowerCase() === unitCode.toLowerCase() })) {
      throw publicError_('DUPLICATE_UNIT_CODE', 'Kode unit sudah digunakan.')
    }
    var product = findRecord_('Catalog', 'product_id', productId)
    if (!product) throw publicError_('PRODUCT_NOT_FOUND', 'Produk katalog tidak ditemukan.')
    if (variantId) {
      var variant = findRecord_('Variants', 'variant_id', variantId)
      if (!variant || String(variant.product_id) !== productId) {
        throw publicError_('INVALID_VARIANT', 'Varian tidak sesuai dengan produk.')
      }
    }

    var now = isoNow_()
    var unitId = newId_()
    appendRecords_('Units', [{
      unit_id: unitId,
      unit_code: unitCode,
      product_id: productId,
      variant_id: variantId,
      actual_photo_file_ids_json: '[]',
      condition_notes: cleanText_(payload.conditionNotes || '', 1000, 'Kondisi unit'),
      receipt_reference: cleanText_(payload.receiptReference || '', 120, 'Referensi struk'),
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      status: 'available',
      held_request_id: '',
      reserved_order_id: '',
      created_at: now,
      updated_at: now
    }])
    appendAudit_('admin', session.role, 'unit_created', 'unit', unitId, { unitCode: unitCode })
    return { unitId: unitId, unitCode: unitCode, status: 'available' }
  })
}

function assignUnitAsAdmin_(sessionToken, requestId, unitId) {
  var session = requireAdmin_(sessionToken)
  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var request = findRecord_('Requests', 'request_id', requestId)
    var unit = findRecord_('Units', 'unit_id', unitId)
    if (!request || !unit) throw publicError_('NOT_FOUND', 'Request atau unit fisik tidak ditemukan.')
    if (String(request.status) !== 'found') {
      throw publicError_('REQUEST_NOT_FOUND', 'Unit hanya dapat dialokasikan setelah request ditemukan.')
    }
    if (String(unit.status) !== 'available' || String(unit.held_request_id || '') ||
        String(unit.reserved_order_id || '')) {
      throw publicError_('UNIT_UNAVAILABLE', 'Unit sudah dialokasikan atau tidak tersedia.')
    }
    if (String(unit.product_id) !== String(request.product_id) ||
        (String(request.variant_id || '') && String(unit.variant_id || '') !== String(request.variant_id))) {
      throw publicError_('UNIT_MISMATCH', 'Model/varian unit fisik tidak cocok dengan request pelanggan.')
    }

    var assignedIds = safeJsonParse_(request.unit_ids_json, [])
    var quantity = Number(request.quantity)
    if (assignedIds.length >= quantity) {
      throw publicError_('REQUEST_FULLY_ALLOCATED', 'Jumlah unit yang dialokasikan sudah mencukupi request.')
    }
    assignedIds.push(String(unitId))
    updateRecord_('Requests', 'request_id', requestId, {
      unit_ids_json: JSON.stringify(assignedIds),
      updated_at: isoNow_()
    })
    updateRecord_('Units', 'unit_id', unitId, {
      status: 'held',
      held_request_id: requestId,
      updated_at: isoNow_()
    })
    appendAudit_('admin', session.role, 'unit_held_for_request', 'unit', unitId, { requestId: requestId })
    return { assigned: true, assignedCount: assignedIds.length, requiredCount: quantity }
  })
}

function createOrderAsAdmin_(sessionToken, requestGroupId) {
  var session = requireAdmin_(sessionToken)
  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var group = findRecord_('Request_Groups', 'request_group_id', requestGroupId)
    if (!group) throw publicError_('NOT_FOUND', 'Request pelanggan tidak ditemukan.')

    // Recover an interrupted multi-sheet write instead of creating a second order.
    var existingOrder = group.order_id
      ? findRecord_('Orders', 'order_id', group.order_id)
      : readRecords_('Orders').filter(function (row) {
          return String(row.request_group_id) === String(requestGroupId)
        })[0]
    if (existingOrder) {
      if (!group.order_id) {
        updateRecord_('Request_Groups', 'request_group_id', requestGroupId, {
          order_id: existingOrder.order_id,
          status: String(existingOrder.status) === 'creating' ? 'order_creating' : 'order_created',
          updated_at: isoNow_()
        })
      }
      if (String(existingOrder.status) === 'creating') {
        return recoverOrderCreation_(session, requestGroupId, existingOrder)
      }
      // Ensure verified request-stage deposits are attached when recovering an
      // order row whose last write completed just before a runtime interruption.
      readRecords_('Payments').filter(function (payment) {
        return String(payment.request_group_id) === String(requestGroupId) &&
          !payment.order_id && String(payment.verification_status) === 'verified'
      }).forEach(function (payment) {
        updateRecord_('Payments', 'payment_id', payment.payment_id, { order_id: existingOrder.order_id })
      })
      recalculateOrderPaymentStatus_(existingOrder.order_id)
      // Repair the parent status if a prior run finished the order row but
      // stopped before updating the request group pointer.
      if (String(group.status) !== 'order_created' || String(group.order_id || '') !== String(existingOrder.order_id)) {
        updateRecord_('Request_Groups', 'request_group_id', requestGroupId, {
          order_id: existingOrder.order_id,
          status: 'order_created',
          updated_at: isoNow_()
        })
      }
      return orderSummary_(existingOrder, true)
    }

    if (String(group.status) !== 'customer_details_received') {
      throw publicError_('INVALID_STATE', 'Pesanan hanya dapat dibuat setelah pelanggan mengirim format order.')
    }
    var buyer = findRecord_('Buyers', 'buyer_id', group.buyer_id)
    if (!buyer || !buyer.name || !buyer.phone || !buyer.address) {
      throw publicError_('CUSTOMER_DETAILS_INCOMPLETE', 'Data pelanggan belum lengkap.')
    }

    // Deposit policy amount is intentionally not fixed. At least one positive,
    // admin-verified deposit must exist before the final order can be created.
    var verifiedDeposit = readRecords_('Payments').filter(function (payment) {
      return String(payment.request_group_id) === String(requestGroupId) &&
        String(payment.type) === 'deposit' &&
        String(payment.verification_status) === 'verified'
    }).reduce(function (sum, payment) { return sum + Number(payment.amount || 0) }, 0)
    if (verifiedDeposit <= 0) {
      throw publicError_('VERIFIED_DEPOSIT_REQUIRED', 'Catat dan verifikasi deposit pelanggan terlebih dahulu. Nominal minimum deposit mengikuti kesepakatan admin dengan pelanggan.')
    }

    var requestItems = readRecords_('Requests').filter(function (row) {
      return String(row.request_group_id) === String(requestGroupId)
    })
    if (!requestItems.length || requestItems.some(function (row) {
      return String(row.status) !== 'found' || String(row.customer_decision) !== 'approved'
    })) {
      throw publicError_('ITEMS_NOT_APPROVED', 'Semua item pesanan harus ditemukan dan disetujui pelanggan.')
    }

    var allocated = []
    var subtotal = 0
    var productCount = 0
    requestItems.forEach(function (request) {
      var unitIds = safeJsonParse_(request.unit_ids_json, [])
      if (unitIds.length !== Number(request.quantity)) {
        throw publicError_('UNIT_ALLOCATION_INCOMPLETE', 'Jumlah unit fisik belum lengkap untuk ' + request.product_name_snapshot + '.')
      }
      unitIds.forEach(function (unitId) {
        var unit = findRecord_('Units', 'unit_id', unitId)
        if (!unit || String(unit.status) !== 'held' ||
            String(unit.held_request_id) !== String(request.request_id) ||
            String(unit.product_id) !== String(request.product_id) ||
            (String(request.variant_id || '') && String(unit.variant_id || '') !== String(request.variant_id))) {
          throw publicError_('UNIT_RESERVATION_INVALID', 'Ada unit yang tidak lagi cocok atau tidak lagi dialokasikan pada request ini.')
        }
        var price = Number(unit.selling_price)
        if (!Number.isFinite(price) || price <= 0) {
          throw publicError_('SELLING_PRICE_REQUIRED', 'Isi harga jual final seluruh unit sebelum membuat pesanan.')
        }
        subtotal += price
        productCount += 1
        allocated.push({ request: request, unit: unit, price: price })
      })
    })

    var now = isoNow_()
    var orderId = newId_()
    var orderCode = makeRequestCode_().replace('JN-', 'JNO-')
    var fee = calculateJastipFee_(productCount)
    var total = subtotal + fee

    // Google Sheets has no cross-sheet transaction. Persist a recoverable draft
    // pointer before writing child rows; retries resume the draft idempotently.
    var draftOrder = {
      order_id: orderId,
      order_code: orderCode,
      request_group_id: requestGroupId,
      buyer_id: group.buyer_id,
      customer_name: String(buyer.name),
      customer_phone: String(buyer.phone),
      shipping_address: String(buyer.address),
      shopee_username: '',
      shopee_checkout_url: '',
      product_count: productCount,
      product_subtotal: subtotal,
      jastip_fee: fee,
      shipping_fee: 0,
      discount: 0,
      total_amount: total,
      status: 'creating',
      payment_status: 'unpaid',
      courier: '',
      tracking_number: '',
      shipped_at: '',
      delivered_at: '',
      created_at: now,
      updated_at: now
    }
    appendRecords_('Orders', [draftOrder])
    updateRecord_('Request_Groups', 'request_group_id', requestGroupId, {
      order_id: orderId,
      status: 'order_creating',
      updated_at: now
    })
    appendAudit_('admin', session.role, 'order_creation_started', 'order', orderId, {
      requestGroupId: requestGroupId,
      productCount: productCount
    })
    return recoverOrderCreation_(session, requestGroupId, draftOrder)
  })
}

function orderSummary_(order, reused) {
  return {
    orderId: String(order.order_id),
    orderCode: String(order.order_code),
    productCount: Number(order.product_count || 0),
    subtotal: Number(order.product_subtotal || 0),
    fee: Number(order.jastip_fee || 0),
    total: Number(order.total_amount || 0),
    reused: Boolean(reused)
  }
}

function recoverOrderCreation_(session, requestGroupId, draftOrder) {
  var orderId = String(draftOrder.order_id)
  var requestItems = readRecords_('Requests').filter(function (row) {
    return String(row.request_group_id) === String(requestGroupId)
  })
  var existingItems = readRecords_('Order_Items').filter(function (row) {
    return String(row.order_id) === orderId
  })
  var newItems = []
  requestItems.forEach(function (request) {
    var unitIds = safeJsonParse_(request.unit_ids_json, [])
    if (unitIds.length !== Number(request.quantity)) {
      throw publicError_('ORDER_RECOVERY_REQUIRED', 'Jumlah unit request berubah saat pemulihan order. Periksa data order sebelum melanjutkan.')
    }
    unitIds.forEach(function (unitId) {
      var itemExists = existingItems.some(function (item) {
        return String(item.unit_id) === String(unitId)
      })
      var unit = findRecord_('Units', 'unit_id', unitId)
      if (!unit || String(unit.product_id) !== String(request.product_id) ||
          (String(request.variant_id || '') && String(unit.variant_id || '') !== String(request.variant_id))) {
        throw publicError_('ORDER_RECOVERY_REQUIRED', 'Unit tidak lagi cocok dengan request. Perlu rekonsiliasi admin.')
      }
      if (String(unit.reserved_order_id || '') !== orderId) {
        if (String(unit.status) !== 'held' || String(unit.held_request_id) !== String(request.request_id)) {
          throw publicError_('ORDER_RECOVERY_REQUIRED', 'Unit sudah berubah status. Perlu rekonsiliasi admin sebelum order dilanjutkan.')
        }
      }
      if (!itemExists) {
        newItems.push({
          order_item_id: newId_(),
          order_id: orderId,
          request_id: request.request_id,
          unit_id: unit.unit_id,
          product_id: request.product_id,
          variant_id: request.variant_id,
          product_name_snapshot: request.product_name_snapshot,
          variant_name_snapshot: request.variant_name_snapshot,
          quantity: 1,
          unit_price: Number(unit.selling_price),
          status: 'reserved',
          created_at: isoNow_()
        })
      }
    })
  })

  if (newItems.length) appendRecords_('Order_Items', newItems)

  requestItems.forEach(function (request) {
    safeJsonParse_(request.unit_ids_json, []).forEach(function (unitId) {
      var unit = findRecord_('Units', 'unit_id', unitId)
      if (String(unit.reserved_order_id || '') !== orderId) {
        updateRecord_('Units', 'unit_id', unitId, {
          status: 'reserved',
          held_request_id: '',
          reserved_order_id: orderId,
          updated_at: isoNow_()
        })
      }
    })
    updateRecord_('Requests', 'request_id', request.request_id, {
      status: 'ordered',
      updated_at: isoNow_()
    })
  })

  readRecords_('Payments').filter(function (payment) {
    return String(payment.request_group_id) === String(requestGroupId) &&
      !payment.order_id && String(payment.verification_status) === 'verified'
  }).forEach(function (payment) {
    updateRecord_('Payments', 'payment_id', payment.payment_id, { order_id: orderId })
  })

  updateRecord_('Orders', 'order_id', orderId, {
    status: 'confirmed',
    updated_at: isoNow_()
  })
  updateRecord_('Request_Groups', 'request_group_id', requestGroupId, {
    order_id: orderId,
    status: 'order_created',
    updated_at: isoNow_()
  })
  recalculateOrderPaymentStatus_(orderId)
  appendAudit_('admin', session.role, 'order_creation_recovered', 'order', orderId, {
    requestGroupId: requestGroupId
  })
  return orderSummary_(findRecord_('Orders', 'order_id', orderId), false)
}

function recalculateOrderPaymentStatus_(orderId) {
  var order = findRecord_('Orders', 'order_id', orderId)
  if (!order) return
  var payments = readRecords_('Payments').filter(function (row) {
    return String(row.order_id) === String(orderId) &&
      String(row.verification_status) === 'verified'
  })
  var balance = 0
  payments.forEach(function (row) {
    var amount = Number(row.amount || 0)
    balance += String(row.type) === 'refund' ? -amount : amount
  })
  var total = Number(order.total_amount || 0)
  var status = balance <= 0 ? 'unpaid' : balance >= total ? 'paid' : 'partially_paid'
  updateRecord_('Orders', 'order_id', orderId, {
    payment_status: status,
    updated_at: isoNow_()
  })
}

function addPaymentAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var type = String(payload && payload.type || '')
  var supported = ['deposit', 'settlement', 'shipping', 'refund', 'shopee']
  var amount = Number(payload && payload.amount)
  var orderId = cleanText_(payload && payload.orderId || '', 100, 'Order')
  var requestGroupId = cleanText_(payload && payload.requestGroupId || '', 100, 'Request')
  var idempotencyKey = cleanText_(payload && payload.idempotencyKey, 100, 'ID transaksi')
  if (supported.indexOf(type) === -1 || !Number.isFinite(amount) || amount <= 0 ||
      idempotencyKey.length < 16 || (!orderId && !requestGroupId)) {
    throw publicError_('INVALID_PAYMENT', 'Periksa tipe transaksi, nominal, dan referensi pembayaran.')
  }
  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var duplicate = readRecords_('Payments').filter(function (row) {
      return String(row.idempotency_key) === idempotencyKey
    })[0]
    if (duplicate) return { paymentId: duplicate.payment_id, reused: true }
    if (orderId && !findRecord_('Orders', 'order_id', orderId)) {
      throw publicError_('ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.')
    }
    if (requestGroupId && !findRecord_('Request_Groups', 'request_group_id', requestGroupId)) {
      throw publicError_('REQUEST_NOT_FOUND', 'Request pelanggan tidak ditemukan.')
    }
    var paymentId = newId_()
    appendRecords_('Payments', [{
      payment_id: paymentId,
      request_group_id: requestGroupId,
      request_id: '',
      order_id: orderId,
      type: type,
      amount: amount,
      method: cleanText_(payload.method || 'bank_transfer', 40, 'Metode pembayaran'),
      proof_file_id: cleanText_(payload.proofFileId || '', 150, 'Bukti pembayaran'),
      verification_status: 'awaiting_verification',
      verified_at: '',
      verified_by: '',
      idempotency_key: idempotencyKey,
      occurred_at: cleanText_(payload.occurredAt || isoNow_(), 40, 'Tanggal transaksi'),
      notes: cleanText_(payload.notes || '', 500, 'Catatan'),
      created_at: isoNow_()
    }])
    appendAudit_('admin', session.role, 'payment_recorded', 'payment', paymentId, { type: type, amount: amount })
    return { paymentId: paymentId, verificationStatus: 'awaiting_verification', reused: false }
  })
}

function verifyPaymentAsAdmin_(sessionToken, paymentId, decision) {
  var session = requireAdmin_(sessionToken)
  var nextStatus = String(decision || '')
  if (['verified', 'rejected'].indexOf(nextStatus) === -1) {
    throw publicError_('INVALID_DECISION', 'Keputusan verifikasi pembayaran tidak valid.')
  }
  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var payment = findRecord_('Payments', 'payment_id', paymentId)
    if (!payment) throw publicError_('NOT_FOUND', 'Catatan pembayaran tidak ditemukan.')
    if (String(payment.verification_status) !== 'awaiting_verification') {
      throw publicError_('INVALID_STATE', 'Pembayaran ini sudah pernah diverifikasi.')
    }
    updateRecord_('Payments', 'payment_id', paymentId, {
      verification_status: nextStatus,
      verified_at: nextStatus === 'verified' ? isoNow_() : '',
      verified_by: session.role,
    })
    if (payment.order_id && nextStatus === 'verified') {
      recalculateOrderPaymentStatus_(payment.order_id)
    }
    appendAudit_('admin', session.role, 'payment_' + nextStatus, 'payment', paymentId, {})
    return { saved: true, verificationStatus: nextStatus }
  })
}

function updateShipmentAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var orderId = cleanText_(payload && payload.orderId, 100, 'Order')
  var status = String(payload && payload.status || '')
  var allowed = ['preparing', 'shipped', 'delivered', 'issue']
  if (allowed.indexOf(status) === -1) throw publicError_('INVALID_SHIPMENT_STATUS', 'Status pengiriman tidak valid.')
  var courier = cleanText_(payload.courier || '', 80, 'Kurir')
  var tracking = cleanText_(payload.trackingNumber || '', 100, 'Nomor resi')
  if (['shipped', 'delivered'].indexOf(status) !== -1 && (!courier || !tracking)) {
    throw publicError_('SHIPMENT_DETAILS_REQUIRED', 'Kurir dan nomor resi wajib diisi sebelum status dikirim.')
  }

  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var order = findRecord_('Orders', 'order_id', orderId)
    if (!order) throw publicError_('ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.')
    if (String(order.status) === 'cancelled' || String(order.status) === 'completed') {
      throw publicError_('INVALID_STATE', 'Pesanan yang dibatalkan atau selesai tidak dapat diubah.')
    }
    var existing = readRecords_('Shipments').filter(function (row) {
      return String(row.order_id) === orderId
    })[0]
    if (existing && String(existing.status) === 'delivered' && status !== 'delivered') {
      throw publicError_('INVALID_TRANSITION', 'Status pengiriman yang sudah diterima tidak dapat dimundurkan.')
    }
    if (status === 'preparing' && existing && ['shipped', 'delivered'].indexOf(String(existing.status)) !== -1) {
      throw publicError_('INVALID_TRANSITION', 'Pengiriman yang sudah berangkat tidak dapat kembali ke packing.')
    }
    var now = isoNow_()
    var shipmentId = existing ? String(existing.shipment_id) : newId_()
    var record = {
      shipment_id: shipmentId,
      order_id: orderId,
      courier: courier,
      tracking_number: tracking,
      status: status,
      processed_at: existing && existing.processed_at ? existing.processed_at : now,
      shipped_at: ['shipped', 'delivered'].indexOf(status) !== -1 ? (existing && existing.shipped_at || now) : '',
      delivered_at: status === 'delivered' ? now : (existing && existing.delivered_at || ''),
      notes: cleanText_(payload.notes || '', 500, 'Catatan pengiriman'),
      created_at: existing ? existing.created_at : now,
      updated_at: now
    }
    if (existing) updateRecord_('Shipments', 'shipment_id', shipmentId, record)
    else appendRecords_('Shipments', [record])

    var orderStatus = status === 'preparing' ? 'packing' :
      status === 'shipped' ? 'shipped' :
      status === 'delivered' ? 'completed' : 'issue'
    updateRecord_('Orders', 'order_id', orderId, {
      status: orderStatus,
      courier: courier,
      tracking_number: tracking,
      shipped_at: record.shipped_at,
      delivered_at: record.delivered_at,
      updated_at: now
    })
    var items = readRecords_('Order_Items').filter(function (row) { return String(row.order_id) === orderId })
    items.forEach(function (item) {
      if (!item.unit_id) return
      updateRecord_('Units', 'unit_id', item.unit_id, {
        status: status === 'preparing' ? 'packed' : status === 'shipped' ? 'shipped' : status === 'delivered' ? 'completed' : 'issue',
        updated_at: now
      })
    })
    appendAudit_('admin', session.role, 'shipment_' + status, 'shipment', shipmentId, { orderId: orderId })
    return { saved: true, status: status, orderStatus: orderStatus }
  })
}

function addExpenseAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var amount = Number(payload && payload.amount)
  var category = cleanText_(payload && payload.category, 50, 'Kategori')
  var occurredAt = cleanText_(payload && payload.occurredAt, 30, 'Tanggal')
  if (!Number.isFinite(amount) || amount <= 0 || !category || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) {
    throw publicError_('INVALID_EXPENSE', 'Periksa kategori, nominal, dan tanggal pengeluaran.')
  }
  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var idempotencyKey = cleanText_(payload.idempotencyKey || '', 100, 'ID transaksi')
    if (idempotencyKey && idempotencyKey.length < 16) {
      throw publicError_('INVALID_IDEMPOTENCY_KEY', 'ID transaksi tidak valid.')
    }
    if (idempotencyKey) {
      var duplicate = readRecords_('Expenses').filter(function (row) {
        return String(row.idempotency_key || '') === idempotencyKey
      })[0]
      if (duplicate) return { expenseId: String(duplicate.expense_id), reused: true }
    }
    var expenseId = newId_()
    appendRecords_('Expenses', [{
      expense_id: expenseId,
      occurred_at: occurredAt,
      category: category,
      description: cleanText_(payload.description || '', 500, 'Keterangan'),
      amount: amount,
      order_id: cleanText_(payload.orderId || '', 100, 'Order'),
      event_id: '',
      created_by: session.role,
      created_at: isoNow_(),
      idempotency_key: idempotencyKey
    }])
    appendAudit_('admin', session.role, 'expense_created', 'expense', expenseId, { amount: amount, category: category })
    return { expenseId: expenseId, reused: false }
  })
}

function updateOrderOptionsAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var orderId = cleanText_(payload && payload.orderId, 100, 'Order')
  var checkoutUrl = cleanText_(payload && payload.shopeeCheckoutUrl || '', 800, 'Link Shopee')
  if (checkoutUrl && !/^https:\/\/.+/i.test(checkoutUrl)) {
    throw publicError_('INVALID_SHOPEE_URL', 'Link checkout Shopee harus menggunakan HTTPS.')
  }
  return withScriptLock_(function () {
    // Revalidate the session after acquiring the lock; logout/password rotation may race this mutation.
    session = requireAdmin_(sessionToken)
    var order = findRecord_('Orders', 'order_id', orderId)
    if (!order) throw publicError_('ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.')
    if (['cancelled', 'completed'].indexOf(String(order.status)) !== -1) {
      throw publicError_('INVALID_STATE', 'Pesanan selesai atau dibatalkan tidak dapat diubah.')
    }
    updateRecord_('Orders', 'order_id', orderId, {
      shopee_checkout_url: checkoutUrl,
      updated_at: isoNow_()
    })
    appendAudit_('admin', session.role, 'order_shopee_link_updated', 'order', orderId, {
      checkoutLinkSet: Boolean(checkoutUrl)
    })
    return { saved: true }
  })
}

