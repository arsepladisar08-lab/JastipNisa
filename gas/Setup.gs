function setupJastipNisa_() {
  return withScriptLock_(function () {
    var properties = getScriptProperties_()
    var rootFolderId = properties.getProperty('JN_DRIVE_ROOT_ID')
    var photosFolderId = properties.getProperty('JN_UNIT_PHOTOS_FOLDER_ID')
    var proofsFolderId = properties.getProperty('JN_PAYMENT_PROOFS_FOLDER_ID')
    var spreadsheetId = properties.getProperty('JN_SPREADSHEET_ID')

    if (!rootFolderId) {
      var rootFolder = DriveApp.createFolder('JastipNisa Private Files')
      rootFolderId = rootFolder.getId()
      properties.setProperty('JN_DRIVE_ROOT_ID', rootFolderId)
    } else {
      rootFolder = DriveApp.getFolderById(rootFolderId)
    }

    if (!photosFolderId) {
      photosFolderId = rootFolder.createFolder('Foto Unit Aktual').getId()
      properties.setProperty('JN_UNIT_PHOTOS_FOLDER_ID', photosFolderId)
    }
    if (!proofsFolderId) {
      proofsFolderId = rootFolder.createFolder('Bukti Pembayaran').getId()
      properties.setProperty('JN_PAYMENT_PROOFS_FOLDER_ID', proofsFolderId)
    }

    if (!spreadsheetId) {
      var spreadsheet = SpreadsheetApp.create('JastipNisa Database')
      spreadsheetId = spreadsheet.getId()
      DriveApp.getFileById(spreadsheetId).moveTo(rootFolder)
      properties.setProperty('JN_SPREADSHEET_ID', spreadsheetId)
    }

    if (!properties.getProperty('JN_AUTH_PEPPER')) {
      properties.setProperty('JN_AUTH_PEPPER', Utilities.getUuid() + Utilities.getUuid())
    }
    if (!properties.getProperty('JN_CUSTOMER_TOKEN_PEPPER')) {
      properties.setProperty('JN_CUSTOMER_TOKEN_PEPPER', Utilities.getUuid() + Utilities.getUuid())
    }

    ensureDatabaseSchema_()
    seedDefaultSettings_()

    return {
      ok: true,
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: SpreadsheetApp.openById(spreadsheetId).getUrl(),
      driveRootFolderId: rootFolderId,
      unitPhotosFolderId: photosFolderId,
      paymentProofsFolderId: proofsFolderId,
      message: 'Fondasi JastipNisa siap. Lanjutkan bootstrap admin secara manual.'
    }
  })
}

function seedDefaultSettings_() {
  var existing = readRecords_('Settings')
  var keys = existing.map(function (row) { return String(row.setting_key) })
  var missing = JN_DEFAULT_SETTINGS.filter(function (row) { return keys.indexOf(row.setting_key) === -1 })
    .map(function (row) {
      return {
        setting_key: row.setting_key,
        setting_value: row.setting_value,
        is_public: row.is_public,
        updated_at: isoNow_(),
        updated_by: 'system'
      }
    })
  if (missing.length) appendRecords_('Settings', missing)
}

function bootstrapAdminPassword_() {
  return withScriptLock_(function () {
    var properties = getScriptProperties_()
    if (properties.getProperty('JN_ADMIN_PASSWORD_HASH')) {
      throw new Error('Password admin sudah disiapkan. Gunakan fungsi rotasi password yang diaudit.')
    }
    var initialPassword = properties.getProperty('JN_INITIAL_ADMIN_PASSWORD')
    if (!initialPassword || initialPassword.length < 16) {
      throw new Error('Isi JN_INITIAL_ADMIN_PASSWORD di Script Properties dengan passphrase minimal 16 karakter sebelum menjalankan fungsi ini.')
    }
    var salt = Utilities.getUuid() + Utilities.getUuid()
    var pepper = properties.getProperty('JN_AUTH_PEPPER')
    if (!pepper) throw new Error('Jalankan setupJastipNisa_ terlebih dahulu.')

    properties.setProperty('JN_ADMIN_PASSWORD_SALT', salt)
    properties.setProperty('JN_ADMIN_PASSWORD_HASH', hmacHex_(salt + ':' + initialPassword, pepper))
    properties.deleteProperty('JN_INITIAL_ADMIN_PASSWORD')
    return 'Password admin berhasil di-bootstrap. Hapus catatan sementara dan simpan passphrase di password manager.'
  })
}

function getPublicSettings_() {
  var allowList = ['service_name', 'admin_whatsapp', 'public_notice', 'packing_estimate', 'currency']
  var result = {}
  readRecords_('Settings').forEach(function (row) {
    if (allowList.indexOf(String(row.setting_key)) !== -1 && String(row.is_public) === 'true') {
      result[String(row.setting_key)] = String(row.setting_value || '')
    }
  })
  return result
}
