function createCustomerCancellationRequest_(accessToken, reason) {
  var requestReason = cleanText_(reason, 1000, 'Alasan pembatalan')
  if (requestReason.length < 8) {
    throw publicError_('INVALID_CANCELLATION_REASON', 'Tuliskan alasan pembatalan minimal 8 karakter.')
  }

  return withScriptLock_(function () {
    var group = findRequestGroupByToken_(accessToken)
    if (!group.order_id) {
      throw publicError_('ORDER_NOT_FOUND', 'Belum ada pesanan final yang dapat diajukan pembatalannya.')
    }
    var order = findRecord_('Orders', 'order_id', group.order_id)
    if (!order || String(order.request_group_id) !== String(group.request_group_id)) {
      throw publicError_('ORDER_NOT_FOUND', 'Pesanan final tidak ditemukan.')
    }
    var orderStatus = String(order.status || '')
    if (['confirmed', 'packing'].indexOf(orderStatus) === -1) {
      throw publicError_('ORDER_NOT_CANCELLABLE', 'Permintaan pembatalan online hanya dapat diajukan sebelum pesanan dikirim. Hubungi admin untuk penanganan kondisi khusus.')
    }

    var previous = readRecords_('Cancellation_Requests').filter(function (row) {
      return String(row.request_group_id) === String(group.request_group_id) &&
        String(row.order_id) === String(order.order_id)
    })
    var active = previous.filter(function (row) {
      return ['pending', 'accepted_pending_execution'].indexOf(String(row.status)) !== -1
    })[0]
    if (active) {
      if (String(active.status) === 'pending' && String(active.reason) === requestReason) {
        return {
          cancellationRequestId: String(active.cancellation_request_id),
          status: String(active.status),
          reused: true
        }
      }
      throw publicError_('CANCELLATION_ALREADY_OPEN', 'Permintaan pembatalan sebelumnya masih menunggu tindak lanjut admin.')
    }

    var now = isoNow_()
    var cancellationRequestId = newId_()
    appendRecords_('Cancellation_Requests', [{
      cancellation_request_id: cancellationRequestId,
      request_group_id: group.request_group_id,
      order_id: order.order_id,
      buyer_id: group.buyer_id,
      reason: requestReason,
      status: 'pending',
      review_note: '',
      reviewed_by: '',
      reviewed_at: '',
      created_at: now,
      updated_at: now
    }])
    appendAudit_('customer', group.request_group_id, 'cancellation_requested', 'cancellation_request', cancellationRequestId, {
      orderId: String(order.order_id),
      orderStatusAtRequest: orderStatus
    })
    return {
      cancellationRequestId: cancellationRequestId,
      status: 'pending',
      reused: false
    }
  })
}

function reviewCancellationRequestAsAdmin_(sessionToken, cancellationRequestId, decision, reviewNote) {
  var session = requireAdmin_(sessionToken)
  var requestId = cleanText_(cancellationRequestId, 100, 'Permintaan pembatalan')
  var nextDecision = String(decision || '')
  var note = cleanText_(reviewNote || '', 1000, 'Catatan admin')
  if (['accepted', 'rejected'].indexOf(nextDecision) === -1) {
    throw publicError_('INVALID_CANCELLATION_DECISION', 'Keputusan review pembatalan tidak valid.')
  }
  if (note.length < 3) {
    throw publicError_('CANCELLATION_REVIEW_NOTE_REQUIRED', 'Catatan admin minimal 3 karakter untuk menjelaskan keputusan.')
  }

  return withScriptLock_(function () {
    session = requireAdmin_(sessionToken)
    var request = findRecord_('Cancellation_Requests', 'cancellation_request_id', requestId)
    if (!request) throw publicError_('CANCELLATION_NOT_FOUND', 'Permintaan pembatalan tidak ditemukan.')
    var current = String(request.status || '')
    var nextStatus = nextDecision === 'accepted' ? 'accepted_pending_execution' : 'rejected'
    if (current === nextStatus) {
      return { saved: true, status: current, reused: true, orderChanged: false }
    }
    if (current !== 'pending') {
      throw publicError_('CANCELLATION_ALREADY_REVIEWED', 'Permintaan pembatalan ini sudah pernah diputuskan.')
    }

    var order = findRecord_('Orders', 'order_id', request.order_id)
    if (!order || String(order.request_group_id) !== String(request.request_group_id)) {
      throw publicError_('ORDER_NOT_FOUND', 'Pesanan terkait tidak ditemukan.')
    }
    if (['confirmed', 'packing'].indexOf(String(order.status || '')) === -1) {
      throw publicError_('ORDER_REQUIRES_MANUAL_REVIEW', 'Status pesanan telah berubah. Review pembatalan perlu ditangani manual dan tidak dapat diputuskan melalui alur standar.')
    }

    var now = isoNow_()
    updateRecord_('Cancellation_Requests', 'cancellation_request_id', requestId, {
      status: nextStatus,
      review_note: note,
      reviewed_by: session.role,
      reviewed_at: now,
      updated_at: now
    })
    appendAudit_('admin', session.role, 'cancellation_' + nextDecision, 'cancellation_request', requestId, {
      orderId: String(order.order_id),
      orderStatusUnchanged: String(order.status),
      executionDeferred: nextDecision === 'accepted'
    })

    // Important: acceptance records the admin's decision only. It does not
    // cancel the order, release inventory, issue a refund, or edit payments.
    return {
      saved: true,
      status: nextStatus,
      reused: false,
      orderChanged: false,
      executionDeferred: nextDecision === 'accepted'
    }
  })
}
