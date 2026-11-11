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

var JN_DB_READ_CACHE_ = Object.create(null)
var JN_DB_METRICS_ = { rangeReads: 0, rangeWrites: 0, cacheHits: 0, batchWriteGroups: 0 }

function resetDatabaseExecutionCache_() {
  JN_DB_READ_CACHE_ = Object.create(null)
  JN_DB_METRICS_ = { rangeReads: 0, rangeWrites: 0, cacheHits: 0, batchWriteGroups: 0 }
}

function invalidateDatabaseReadCache_(tableName) {
  delete JN_DB_READ_CACHE_[tableName]
}

function getDatabaseExecutionMetrics_() {
  return {
    rangeReads: JN_DB_METRICS_.rangeReads,
    rangeWrites: JN_DB_METRICS_.rangeWrites,
    cacheHits: JN_DB_METRICS_.cacheHits,
    batchWriteGroups: JN_DB_METRICS_.batchWriteGroups
  }
}

function cloneDatabaseRecords_(records) {
  return records.map(function (record) {
    var copy = {}
    Object.keys(record).forEach(function (key) { copy[key] = record[key] })
    return copy
  })
}

function readRecords_(tableName) {
  if (Object.prototype.hasOwnProperty.call(JN_DB_READ_CACHE_, tableName)) {
    JN_DB_METRICS_.cacheHits += 1
    return cloneDatabaseRecords_(JN_DB_READ_CACHE_[tableName])
  }

  var sheet = getSheet_(tableName)
  var lastRow = sheet.getLastRow()
  var headers = getTableHeaders_(sheet)
  if (lastRow < 2 || headers.length === 0) {
    JN_DB_READ_CACHE_[tableName] = []
    return []
  }

  JN_DB_METRICS_.rangeReads += 1
  var records = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    .filter(function (row) { return row.some(function (value) { return value !== '' && value !== null }) })
    .map(function (row) {
      var record = {}
      headers.forEach(function (header, index) {
        var value = row[index]
        record[header] = value instanceof Date ? value.toISOString() : value
      })
      return record
    })
  JN_DB_READ_CACHE_[tableName] = records
  return cloneDatabaseRecords_(records)
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
  JN_DB_METRICS_.rangeWrites += 1
  invalidateDatabaseReadCache_(tableName)
}

function findRecord_(tableName, idField, idValue) {
  var records = readRecords_(tableName)
  for (var i = 0; i < records.length; i += 1) {
    if (String(records[i][idField]) === String(idValue)) return records[i]
  }
  return null
}

function updateRecord_(tableName, idField, idValue, patch) {
  var updated = updateRecordsById_(tableName, idField, [{ id: idValue, patch: patch }])
  return updated > 0
}

// Apply multiple ID-keyed patches with one key-column read and one data write
// per contiguous row group. All callers must already hold the script lock.
function updateRecordsById_(tableName, idField, updates) {
  if (!updates || !updates.length) return 0
  var sheet = getSheet_(tableName)
  var headers = getTableHeaders_(sheet)
  var keyColumn = headers.indexOf(idField) + 1
  if (keyColumn < 1) throw new Error('Primary key tidak ditemukan pada ' + tableName)

  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return 0

  JN_DB_METRICS_.rangeReads += 1
  var keyValues = sheet.getRange(2, keyColumn, lastRow - 1, 1).getDisplayValues()
  var rowById = Object.create(null)
  keyValues.forEach(function (row, index) {
    var key = String(row[0])
    if (key && !Object.prototype.hasOwnProperty.call(rowById, key)) rowById[key] = index + 2
  })

  var patchesByRow = Object.create(null)
  updates.forEach(function (update) {
    if (!update || update.id === undefined || update.id === null) return
    var rowNumber = rowById[String(update.id)]
    if (!rowNumber) return
    patchesByRow[rowNumber] = Object.assign(patchesByRow[rowNumber] || {}, update.patch || {})
  })

  var targetRows = Object.keys(patchesByRow).map(Number).sort(function (a, b) { return a - b })
  if (!targetRows.length) return 0

  var groups = []
  targetRows.forEach(function (rowNumber) {
    var current = groups[groups.length - 1]
    if (!current || rowNumber > current.end + 1) {
      groups.push({ start: rowNumber, end: rowNumber, rows: [rowNumber] })
    } else {
      current.end = rowNumber
      current.rows.push(rowNumber)
    }
  })

  groups.forEach(function (group) {
    var range = sheet.getRange(group.start, 1, group.end - group.start + 1, headers.length)
    JN_DB_METRICS_.rangeReads += 1
    var values = range.getValues()
    group.rows.forEach(function (rowNumber) {
      var row = values[rowNumber - group.start]
      var patch = patchesByRow[rowNumber]
      headers.forEach(function (header, index) {
        if (Object.prototype.hasOwnProperty.call(patch, header)) {
          row[index] = normalizeSheetValue_(patch[header])
        }
      })
    })
    range.setValues(values)
    JN_DB_METRICS_.rangeWrites += 1
    JN_DB_METRICS_.batchWriteGroups += 1
  })

  invalidateDatabaseReadCache_(tableName)
  return targetRows.length
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
  // Each locked mutation starts with a fresh sheet snapshot. Repeated reads
  // during that one transaction can reuse it, and all writes invalidate it.
  resetDatabaseExecutionCache_()
  try {
    return callback()
  } finally {
    resetDatabaseExecutionCache_()
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
