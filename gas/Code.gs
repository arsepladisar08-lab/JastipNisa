function doGet() {
  var output = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('JastipNisa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
  return output
}

function apiHealth() {
  return safeApi_(function () {
    var properties = getScriptProperties_()
    return {
      service: 'JastipNisa GAS API',
      configured: Boolean(properties.getProperty('JN_SPREADSHEET_ID')),
      timestamp: isoNow_()
    }
  })
}

function safeApi_(callback) {
  try {
    return { ok: true, data: callback(), error: null }
  } catch (error) {
    var code = error && error.code ? String(error.code) : 'REQUEST_FAILED'
    var message = error && error.publicMessage
      ? String(error.publicMessage)
      : 'Permintaan belum dapat diproses. Periksa data atau coba kembali.'
    console.error('JastipNisa API error [' + code + ']: ' + String(error && error.message || error))
    return { ok: false, data: null, error: { code: code, message: message } }
  }
}

function publicError_(code, message) {
  var error = new Error(message)
  error.code = code
  error.publicMessage = message
  return error
}

function apiPublicGetCatalog() {
  return safeApi_(function () {
    var products = readRecords_('Catalog').filter(function (row) {
      return row.is_active === true || String(row.is_active).toLowerCase() === 'true'
    })
    var variants = readRecords_('Variants').filter(function (row) {
      return row.is_active === true || String(row.is_active).toLowerCase() === 'true'
    })
    return {
      products: products.map(function (row) {
        return {
          productId: String(row.product_id),
          name: String(row.name),
          slug: String(row.slug),
          category: String(row.category || ''),
          referencePrice: Number(row.official_price || 0),
          officialUrl: String(row.official_url || ''),
          imageUrl: String(row.image_url || ''),
          sourceCheckedAt: String(row.source_checked_at || '')
        }
      }),
      variants: variants.map(function (row) {
        return {
          variantId: String(row.variant_id),
          productId: String(row.product_id),
          name: String(row.name),
          imageUrl: String(row.image_url || '')
        }
      })
    }
  })
}

function apiPublicGetConfig() {
  return safeApi_(function () {
    return getPublicSettings_()
  })
}

function apiPublicCreateRequest(payload) {
  return safeApi_(function () {
    return createPublicRequest_(payload)
  })
}

function apiCustomerGetPortal(accessToken) {
  return safeApi_(function () {
    var group = findRequestGroupByToken_(accessToken)
    var requests = readRecords_('Requests').filter(function (row) {
      return String(row.request_group_id) === String(group.request_group_id)
    })
    var order = readRecords_('Orders').filter(function (row) {
      return String(row.request_group_id) === String(group.request_group_id)
    })[0] || null
    return {
      requestCode: String(group.request_code),
      status: String(group.status),
      createdAt: String(group.created_at),
      items: requests.map(function (row) {
        return {
          requestId: String(row.request_id),
          productName: String(row.product_name_snapshot),
          variantName: String(row.variant_name_snapshot || ''),
          quantity: Number(row.quantity),
          status: String(row.status),
          actualCondition: String(row.actual_condition || ''),
          customerDecision: String(row.customer_decision || ''),
          photoCount: safeJsonParse_(row.actual_photo_file_ids_json, []).length
        }
      }),
      order: order ? {
        orderCode: String(order.order_code),
        status: String(order.status),
        totalAmount: Number(order.total_amount || 0),
        shopeeCheckoutUrl: String(order.shopee_checkout_url || ''),
        trackingNumber: String(order.tracking_number || ''),
        courier: String(order.courier || '')
      } : null
    }
  })
}

function apiCustomerGetPhoto(accessToken, requestId, photoIndex) {
  return safeApi_(function () {
    var group = findRequestGroupByToken_(accessToken)
    var request = findRecord_('Requests', 'request_id', requestId)
    if (!request || String(request.request_group_id) !== String(group.request_group_id)) {
      throw publicError_('NOT_FOUND', 'Foto tidak ditemukan atau tidak tersedia.')
    }
    var ids = safeJsonParse_(request.actual_photo_file_ids_json, [])
    var index = Number(photoIndex)
    if (!Number.isInteger(index) || index < 0 || index >= ids.length) {
      throw publicError_('NOT_FOUND', 'Foto tidak ditemukan atau tidak tersedia.')
    }
    var file = DriveApp.getFileById(String(ids[index]))
    var blob = file.getBlob()
    var bytes = blob.getBytes()
    if (bytes.length > 700000) {
      throw publicError_('FILE_TOO_LARGE', 'Foto terlalu besar untuk ditampilkan. Minta admin mengunggah versi yang lebih kecil.')
    }
    var mimeType = blob.getContentType()
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      throw publicError_('INVALID_FILE', 'Format foto tidak didukung.')
    }
    return { mimeType: mimeType, base64: Utilities.base64Encode(bytes) }
  })
}

function apiCustomerRespondToItem(accessToken, requestId, decision) {
  return safeApi_(function () {
    return customerRespondToItem_(accessToken, requestId, decision)
  })
}

function apiCustomerSubmitOrderDetails(accessToken, details) {
  return safeApi_(function () {
    return submitCustomerOrderDetails_(accessToken, details)
  })
}

function apiCustomerConfirmShopee(accessToken, username) {
  return safeApi_(function () {
    return confirmCustomerShopee_(accessToken, username)
  })
}

function apiAdminLogin(password) {
  return safeApi_(function () {
    return adminLogin_(password)
  })
}

function apiAdminLogout(sessionToken) {
  return safeApi_(function () {
    return adminLogout_(sessionToken)
  })
}

function apiAdminListCatalog(sessionToken) {
  return safeApi_(function () {
    requireAdmin_(sessionToken)
    return {
      products: readRecords_('Catalog').map(function (row) {
        return {
          productId: String(row.product_id),
          name: String(row.name),
          slug: String(row.slug),
          category: String(row.category || ''),
          referencePrice: Number(row.official_price || 0),
          officialUrl: String(row.official_url || ''),
          imageUrl: String(row.image_url || ''),
          sourceCheckedAt: String(row.source_checked_at || ''),
          isActive: row.is_active === true || String(row.is_active).toLowerCase() === 'true',
          sortOrder: Number(row.sort_order || 0)
        }
      }),
      variants: readRecords_('Variants').map(function (row) {
        return {
          variantId: String(row.variant_id),
          productId: String(row.product_id),
          name: String(row.name),
          imageUrl: String(row.image_url || ''),
          isActive: row.is_active === true || String(row.is_active).toLowerCase() === 'true'
        }
      })
    }
  })
}

function apiAdminListOrders(sessionToken) {
  return safeApi_(function () {
    requireAdmin_(sessionToken)
    var orders = readRecords_('Orders')
    var payments = readRecords_('Payments')
    var shipments = readRecords_('Shipments')
    return orders.filter(function (order) {
      return String(order.status) !== 'creating'
    }).map(function (order) {
      var orderPayments = payments.filter(function (payment) {
        return String(payment.order_id) === String(order.order_id)
      })
      var verifiedPaid = orderPayments.filter(function (payment) {
        return String(payment.verification_status) === 'verified'
      }).reduce(function (sum, payment) {
        var amount = Number(payment.amount || 0)
        return sum + (String(payment.type) === 'refund' ? -amount : amount)
      }, 0)
      var shipment = shipments.filter(function (row) {
        return String(row.order_id) === String(order.order_id)
      })[0] || {}
      return {
        orderId: String(order.order_id),
        orderCode: String(order.order_code),
        requestGroupId: String(order.request_group_id || ''),
        customerName: String(order.customer_name || ''),
        customerPhone: String(order.customer_phone || ''),
        shippingAddress: String(order.shipping_address || ''),
        productCount: Number(order.product_count || 0),
        subtotal: Number(order.product_subtotal || 0),
        fee: Number(order.jastip_fee || 0),
        shippingFee: Number(order.shipping_fee || 0),
        totalAmount: Number(order.total_amount || 0),
        totalPaid: verifiedPaid,
        balance: Math.max(0, Number(order.total_amount || 0) - verifiedPaid),
        paymentStatus: String(order.payment_status || 'unpaid'),
        status: String(order.status || ''),
        shopeeUsername: String(order.shopee_username || ''),
        shopeeCheckoutUrl: String(order.shopee_checkout_url || ''),
        courier: String(shipment.courier || order.courier || ''),
        trackingNumber: String(shipment.tracking_number || order.tracking_number || ''),
        shipmentStatus: String(shipment.status || ''),
        createdAt: String(order.created_at || ''),
        payments: orderPayments.map(function (payment) {
          return {
            paymentId: String(payment.payment_id),
            type: String(payment.type),
            amount: Number(payment.amount || 0),
            method: String(payment.method || ''),
            verificationStatus: String(payment.verification_status || ''),
            hasProof: Boolean(payment.proof_file_id),
            occurredAt: String(payment.occurred_at || '')
          }
        })
      }
    }).sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt))
    })
  })
}

function apiAdminUpdateOrderOptions(sessionToken, payload) {
  return safeApi_(function () {
    return updateOrderOptionsAsAdmin_(sessionToken, payload)
  })
}

function apiAdminGetDashboard(sessionToken) {
  return safeApi_(function () {
    requireAdmin_(sessionToken)
    var requests = readRecords_('Requests')
    var groups = readRecords_('Request_Groups')
    var units = readRecords_('Units')
    var orders = readRecords_('Orders')
    var payments = readRecords_('Payments')
    return {
      requestGroups: groups.filter(function (row) { return String(row.status) !== 'order_created' }).length,
      itemsSearching: requests.filter(function (row) { return String(row.status) === 'searching' }).length,
      itemsFound: requests.filter(function (row) { return String(row.status) === 'found' }).length,
      unitsAvailable: units.filter(function (row) { return String(row.status) === 'available' }).length,
      activeOrders: orders.filter(function (row) { return ['completed', 'cancelled'].indexOf(String(row.status)) === -1 }).length,
      paymentsAwaitingVerification: payments.filter(function (row) { return String(row.verification_status) === 'awaiting_verification' }).length
    }
  })
}

function apiAdminListRequests(sessionToken, statusFilter) {
  return safeApi_(function () {
    requireAdmin_(sessionToken)
    var groups = readRecords_('Request_Groups')
    var requests = readRecords_('Requests')
    var buyers = readRecords_('Buyers')
    var payments = readRecords_('Payments')
    var wanted = String(statusFilter || 'all')
    return groups.filter(function (group) {
      var items = requests.filter(function (row) {
        return String(row.request_group_id) === String(group.request_group_id)
      })
      return wanted === 'all' || String(group.status) === wanted || items.some(function (row) {
        return String(row.status) === wanted
      })
    }).map(function (group) {
      var buyer = buyers.filter(function (row) { return String(row.buyer_id) === String(group.buyer_id) })[0] || {}
      return {
        requestGroupId: String(group.request_group_id),
        requestCode: String(group.request_code),
        status: String(group.status),
        createdAt: String(group.created_at),
        customerName: String(buyer.name || ''),
        customerPhone: String(buyer.phone || ''),
        customerAddress: String(buyer.address || ''),
        payments: payments.filter(function (payment) {
          return String(payment.request_group_id) === String(group.request_group_id)
        }).map(function (payment) {
          return {
            paymentId: String(payment.payment_id),
            type: String(payment.type),
            amount: Number(payment.amount || 0),
            method: String(payment.method || ''),
            verificationStatus: String(payment.verification_status),
            occurredAt: String(payment.occurred_at || ''),
            notes: String(payment.notes || ''),
            hasProof: Boolean(payment.proof_file_id)
          }
        }),
        verifiedDepositAmount: payments.filter(function (payment) {
          return String(payment.request_group_id) === String(group.request_group_id) &&
            String(payment.type) === 'deposit' &&
            String(payment.verification_status) === 'verified'
        }).reduce(function (sum, payment) { return sum + Number(payment.amount || 0) }, 0),
        items: requests.filter(function (row) {
          return String(row.request_group_id) === String(group.request_group_id)
        }).map(function (row) {
          return {
            requestId: String(row.request_id),
            productId: String(row.product_id),
            variantId: String(row.variant_id || ''),
            productName: String(row.product_name_snapshot),
            variantName: String(row.variant_name_snapshot || ''),
            quantity: Number(row.quantity),
            assignedUnitCount: safeJsonParse_(row.unit_ids_json, []).length,
            status: String(row.status),
            actualCondition: String(row.actual_condition || ''),
            customerDecision: String(row.customer_decision || '')
          }
        })
      }
    })
  })
}

function apiAdminUpdateRequestItem(sessionToken, payload) {
  return safeApi_(function () {
    return updateRequestItemAsAdmin_(sessionToken, payload)
  })
}

function apiAdminUploadRequestPhoto(sessionToken, payload) {
  return safeApi_(function () {
    return uploadRequestPhotoAsAdmin_(sessionToken, payload)
  })
}

function apiAdminAddUnit(sessionToken, payload) {
  return safeApi_(function () {
    return addUnitAsAdmin_(sessionToken, payload)
  })
}

function apiAdminAssignUnit(sessionToken, requestId, unitId) {
  return safeApi_(function () {
    return assignUnitAsAdmin_(sessionToken, requestId, unitId)
  })
}

function apiAdminCreateOrder(sessionToken, requestGroupId) {
  return safeApi_(function () {
    return createOrderAsAdmin_(sessionToken, requestGroupId)
  })
}

function apiAdminUpdateShipment(sessionToken, payload) {
  return safeApi_(function () {
    return updateShipmentAsAdmin_(sessionToken, payload)
  })
}

function apiAdminAddExpense(sessionToken, payload) {
  return safeApi_(function () {
    return addExpenseAsAdmin_(sessionToken, payload)
  })
}

function apiAdminVerifyPayment(sessionToken, paymentId, decision) {
  return safeApi_(function () {
    return verifyPaymentAsAdmin_(sessionToken, paymentId, decision)
  })
}

function apiAdminAddPayment(sessionToken, payload) {
  return safeApi_(function () {
    return addPaymentAsAdmin_(sessionToken, payload)
  })
}

function apiAdminUploadPaymentProof(sessionToken, payload) {
  return safeApi_(function () {
    return uploadPaymentProofAsAdmin_(sessionToken, payload)
  })
}

function apiAdminGetPaymentProof(sessionToken, paymentId) {
  return safeApi_(function () {
    return getPaymentProofAsAdmin_(sessionToken, paymentId)
  })
}

function apiAdminSaveCatalogProduct(sessionToken, payload) {
  return safeApi_(function () {
    return saveCatalogProductAsAdmin_(sessionToken, payload)
  })
}

function apiAdminSaveVariant(sessionToken, payload) {
  return safeApi_(function () {
    return saveVariantAsAdmin_(sessionToken, payload)
  })
}

function apiAdminConfirmPayment(sessionToken, paymentId, decision) {
  return safeApi_(function () {
    return verifyPaymentAsAdmin_(sessionToken, paymentId, decision)
  })
}

function apiAdminListUnits(sessionToken) {
  return safeApi_(function () {
    requireAdmin_(sessionToken)
    return readRecords_('Units').map(function (row) {
      return {
        unitId: String(row.unit_id),
        unitCode: String(row.unit_code),
        productId: String(row.product_id),
        variantId: String(row.variant_id || ''),
        status: String(row.status),
        sellingPrice: Number(row.selling_price || 0),
        conditionNotes: String(row.condition_notes || ''),
        heldRequestId: String(row.held_request_id || ''),
        reservedOrderId: String(row.reserved_order_id || '')
      }
    })
  })
}
