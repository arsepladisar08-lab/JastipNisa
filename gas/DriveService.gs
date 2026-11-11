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

  withScriptLock_(function () {
    var fresh = findRecord_('Requests', 'request_id', requestId)
    var photoIds = safeJsonParse_(fresh.actual_photo_file_ids_json, [])
    photoIds.push(file.getId())
    updateRecord_('Requests', 'request_id', requestId, {
      actual_photo_file_ids_json: JSON.stringify(photoIds),
      updated_at: isoNow_()
    })
    appendAudit_('admin', session.role, 'request_photo_uploaded', 'request', requestId, { fileId: file.getId() })
  })
  return { uploaded: true, photoCount: safeJsonParse_(findRecord_('Requests', 'request_id', requestId).actual_photo_file_ids_json, []).length }
}
