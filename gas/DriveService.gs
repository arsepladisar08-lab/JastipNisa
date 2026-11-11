function uploadRequestPhotoAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var requestId = cleanText_(payload && payload.requestId, 100, 'Request')
  var fileName = cleanText_(payload && payload.fileName || 'foto-unit.jpg', 120, 'Nama file')
  var mimeType = String(payload && payload.mimeType || '')
  var base64 = String(payload && payload.base64 || '')
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || !base64 || base64.length > 950000) {
    throw publicError_('INVALID_FILE', 'Foto harus JPG, PNG, atau WebP dengan ukuran maksimal sekitar 700 KB.')
  }
  var request = findRecord_('Requests', 'request_id', requestId)
  if (!request) throw publicError_('NOT_FOUND', 'Request item tidak ditemukan.')
  if (String(request.status) !== 'found') {
    throw publicError_('INVALID_STATE', 'Foto aktual hanya dapat diunggah setelah item ditandai ditemukan.')
  }
  var bytes
  try {
    bytes = Utilities.base64Decode(base64)
  } catch (error) {
    throw publicError_('INVALID_FILE', 'Data foto tidak dapat dibaca.')
  }
  if (bytes.length > 700000) throw publicError_('FILE_TOO_LARGE', 'Ukuran foto melebihi 700 KB.')
  var folderId = getScriptProperties_().getProperty('JN_UNIT_PHOTOS_FOLDER_ID')
  if (!folderId) throw new Error('Folder foto belum dikonfigurasi.')
  var safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 90)
  var blob = Utilities.newBlob(bytes, mimeType, safeName)
  var file = DriveApp.getFolderById(folderId).createFile(blob)
  file.setDescription('JastipNisa actual unit photo for request ' + requestId)

  try {
    return withScriptLock_(function () {
      session = requireAdmin_(sessionToken)
      var fresh = findRecord_('Requests', 'request_id', requestId)
      if (!fresh || String(fresh.status) !== 'found') {
        throw publicError_('INVALID_STATE', 'Status request berubah sebelum foto tersimpan. File sementara dibersihkan.')
      }
      var photoIds = safeJsonParse_(fresh.actual_photo_file_ids_json, [])
      photoIds.push(file.getId())
      var saved = updateRecord_('Requests', 'request_id', requestId, {
        actual_photo_file_ids_json: JSON.stringify(photoIds),
        customer_decision: '',
        updated_at: isoNow_()
      })
      if (!saved) {
        throw publicError_('REQUEST_NOT_FOUND', 'Request item tidak lagi tersedia.')
      }
      appendAudit_('admin', session.role, 'request_photo_uploaded', 'request', requestId, { fileId: file.getId() })
      return { uploaded: true, photoCount: photoIds.length }
    })
  } catch (error) {
    try { file.setTrashed(true) } catch (cleanupError) {
      console.error('JastipNisa temporary photo cleanup failed: ' + String(cleanupError))
    }
    throw error
  }
}

function uploadPaymentProofAsAdmin_(sessionToken, payload) {
  var session = requireAdmin_(sessionToken)
  var fileName = cleanText_(payload && payload.fileName || 'bukti-pembayaran', 120, 'Nama file')
  var mimeType = String(payload && payload.mimeType || '')
  var base64 = String(payload && payload.base64 || '')
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType) && mimeType !== 'application/pdf') {
    throw publicError_('INVALID_FILE', 'Bukti pembayaran harus JPG, PNG, WebP, atau PDF.')
  }
  if (!base64 || base64.length > 950000) {
    throw publicError_('FILE_TOO_LARGE', 'Ukuran bukti pembayaran melebihi batas unggah.')
  }
  var bytes
  try {
    bytes = Utilities.base64Decode(base64)
  } catch (error) {
    throw publicError_('INVALID_FILE', 'Data bukti pembayaran tidak dapat dibaca.')
  }
  if (bytes.length > 700000) {
    throw publicError_('FILE_TOO_LARGE', 'Ukuran bukti pembayaran maksimal 700 KB.')
  }
  var folderId = getScriptProperties_().getProperty('JN_PAYMENT_PROOFS_FOLDER_ID')
  if (!folderId) throw new Error('Folder bukti pembayaran belum dikonfigurasi.')
  var safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 90)
  return withScriptLock_(function () {
    session = requireAdmin_(sessionToken)
    var file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mimeType, safeName))
    file.setDescription('JastipNisa private payment proof; admin-only access.')
    appendAudit_('admin', session.role, 'payment_proof_uploaded', 'drive_file', file.getId(), {
      mimeType: mimeType,
      byteLength: bytes.length
    })
    return { fileId: file.getId(), fileName: file.getName() }
  })
}

function getPaymentProofAsAdmin_(sessionToken, paymentId) {
  return withScriptLock_(function () {
    var session = requireAdmin_(sessionToken)
    var payment = findRecord_('Payments', 'payment_id', paymentId)
    if (!payment || !payment.proof_file_id) {
      throw publicError_('PROOF_NOT_FOUND', 'Bukti pembayaran belum tersedia.')
    }
    var file = DriveApp.getFileById(String(payment.proof_file_id))
    var blob = file.getBlob()
    var bytes = blob.getBytes()
    if (bytes.length > 700000) {
      throw publicError_('FILE_TOO_LARGE', 'Bukti pembayaran terlalu besar untuk ditampilkan di dashboard.')
    }
    var mimeType = blob.getContentType()
    if (!/^image\\/(jpeg|png|webp)$/.test(mimeType) && mimeType !== 'application/pdf') {
      throw publicError_('INVALID_FILE', 'Tipe bukti pembayaran tidak didukung.')
    }
    appendAudit_('admin', session.role, 'payment_proof_viewed', 'payment', paymentId, {})
    return {
      fileName: file.getName(),
      mimeType: mimeType,
      base64: Utilities.base64Encode(bytes)
    }
  })
}
