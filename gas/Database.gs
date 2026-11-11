function getScriptProperties_() {
  return PropertiesService.getScriptProperties()
}

function getSpreadsheet_() {
  var spreadsheetId = getScriptProperties_().getProperty('JN_SPREADSHEET_ID')
  if (!spreadsheetId) {
    throw new Error('Database belum disiapkan. Jalankan setupJastipNisa_ dari Apps Script editor.')
  }
  return SpreadsheetApp.openById(spreadsheetId)
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name)
  if (!sheet) throw new Error('Sheet database tidak ditemukan: ' + name)
  return sheet
}

function ensureTableSchema_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.setFrozenRows(1)
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold')
    return
  }

  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0]
    .map(function (value) { return String(value).trim() })
    .filter(Boolean)
  var missing = headers.filter(function (header) { return existing.indexOf(header) === -1 })
  if (missing.length) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    sheet.getRange(1, 1, 1, existing.length + missing.length).setFontWeight('bold')
  }
  sheet.setFrozenRows(1)
}

function ensureDatabaseSchema_() {
  var spreadsheet = getSpreadsheet_()
  Object.keys(JN_TABLE_SCHEMA).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name)
    if (!sheet) sheet = spreadsheet.insertSheet(name)
    ensureTableSchema_(sheet, JN_TABLE_SCHEMA[name])
  })
}

function getTableHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn()
  if (!lastColumn) return []
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (value) {
    return String(value).trim()
  })
}

function normalizeSheetValue_(value) {
  if (value === undefined || value === null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return "'" + value
  return value
}

function readRecords_(tableName) {
  var sheet = getSheet_(tableName)
  var lastRow = sheet.getLastRow()
  var headers = getTableHeaders_(sheet)
  if (lastRow < 2 || headers.length === 0) return []

  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    .filter(function (row) { return row.some(function (value) { return value !== '' && value !== null }) })
    .map(function (row) {
      var record = {}
      headers.forEach(function (header, index) {
        var value = row[index]
        record[header] = value instanceof Date ? value.toISOString() : value
      })
      return record
    })
}

function appendRecords_(tableName, records) {
  if (!records || !records.length) return
  var sheet = getSheet_(tableName)
  var headers = getTableHeaders_(sheet)
  var rows = records.map(function (record) {
    return headers.map(function (header) { return normalizeSheetValue_(record[header]) })
  })
  var startRow = Math.max(sheet.getLastRow(), 1) + 1
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows)
}

function findRecord_(tableName, idField, idValue) {
  var records = readRecords_(tableName)
  for (var i = 0; i < records.length; i += 1) {
    if (String(records[i][idField]) === String(idValue)) return records[i]
  }
  return null
}

function updateRecord_(tableName, idField, idValue, patch) {
  var sheet = getSheet_(tableName)
  var headers = getTableHeaders_(sheet)
  var keyColumn = headers.indexOf(idField) + 1
  if (keyColumn < 1) throw new Error('Primary key tidak ditemukan pada ' + tableName)

  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return false
  var values = sheet.getRange(2, keyColumn, lastRow - 1, 1).getDisplayValues()
  var rowNumber = -1
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(idValue)) {
      rowNumber = i + 2
      break
    }
  }
  if (rowNumber < 0) return false

  var rowRange = sheet.getRange(rowNumber, 1, 1, headers.length)
  var row = rowRange.getValues()[0]
  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(patch, header)) {
      row[index] = normalizeSheetValue_(patch[header])
    }
  })
  rowRange.setValues([row])
  return true
}

function appendAudit_(actorType, actorId, action, entityType, entityId, details) {
  var record = {
    audit_id: Utilities.getUuid(),
    actor_type: actorType,
    actor_id: actorId || '',
    action: action,
    entity_type: entityType,
    entity_id: entityId || '',
    details_json: JSON.stringify(details || {}),
    created_at: new Date().toISOString()
  }
  appendRecords_('Audit_Log', [record])
}

function withScriptLock_(callback) {
  var lock = LockService.getScriptLock()
  lock.waitLock(15000)
  try {
    return callback()
  } finally {
    lock.releaseLock()
  }
}

function newId_() {
  return Utilities.getUuid()
}

function isoNow_() {
  return new Date().toISOString()
}

function safeJsonParse_(value, fallback) {
  try {
    return JSON.parse(String(value || ''))
  } catch (error) {
    return fallback
  }
}

function cleanText_(value, maxLength, fieldName) {
  var text = String(value === undefined || value === null ? '' : value).trim()
  if (text.length > maxLength) throw new Error((fieldName || 'Field') + ' terlalu panjang.')
  return text
}

function normalizePhone_(value) {
  return String(value || '').replace(/\D/g, '')
}

function assertPositiveInteger_(value, fieldName) {
  var number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error((fieldName || 'Jumlah') + ' harus bilangan bulat lebih dari nol.')
  return number
}

function calculateJastipFee_(count) {
  var quantity = Math.max(0, Math.floor(Number(count) || 0))
  if (quantity === 0) return 0
  if (quantity === 1) return 15000
  return 25000 + ((quantity - 2) * 10000)
}

function makeRequestCode_() {
  var stamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd')
  var suffix = Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase()
  return 'JN-' + stamp + '-' + suffix
}


function sha256Hex_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  )
  return bytes.map(function (byte) {
    var unsigned = (byte + 256) % 256
    return ('0' + unsigned.toString(16)).slice(-2)
  }).join('')
}
