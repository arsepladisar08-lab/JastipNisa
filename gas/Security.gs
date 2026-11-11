function hmacHex_(value, secret) {
  var bytes = Utilities.computeHmacSha256Signature(String(value), String(secret))
  return bytes.map(function (byte) {
    var unsigned = (byte + 256) % 256
    return ('0' + unsigned.toString(16)).slice(-2)
  }).join('')
}

function constantTimeEqual_(left, right) {
  var a = String(left || '')
  var b = String(right || '')
  var mismatch = a.length ^ b.length
  var maxLength = Math.max(a.length, b.length)
  for (var i = 0; i < maxLength; i += 1) {
    mismatch |= (a.charCodeAt(i % Math.max(a.length, 1)) || 0) ^
      (b.charCodeAt(i % Math.max(b.length, 1)) || 0)
  }
  return mismatch === 0
}

function getAuthPepper_() {
  var pepper = getScriptProperties_().getProperty('JN_AUTH_PEPPER')
  if (!pepper) throw new Error('Konfigurasi keamanan belum disiapkan.')
  return pepper
}

function getCustomerTokenPepper_() {
  var pepper = getScriptProperties_().getProperty('JN_CUSTOMER_TOKEN_PEPPER')
  if (!pepper) throw new Error('Konfigurasi token pelanggan belum disiapkan.')
  return pepper
}

function customerTokenHash_(token) {
  var value = String(token || '')
  if (!/^[A-Za-z0-9_-]{40,160}$/.test(value)) {
    throw publicError_('INVALID_ACCESS_TOKEN', 'Tautan akses tidak valid.')
  }
  return hmacHex_(value, getCustomerTokenPepper_())
}

function findRequestGroupByToken_(token) {
  var tokenHash = customerTokenHash_(token)
  var groups = readRecords_('Request_Groups')
  for (var i = 0; i < groups.length; i += 1) {
    if (constantTimeEqual_(groups[i].access_token_hash, tokenHash) &&
        !groups[i].access_token_revoked_at) {
      return groups[i]
    }
  }
  throw publicError_('ACCESS_DENIED', 'Tautan akses tidak ditemukan atau sudah dinonaktifkan.')
}

function createSessionToken_() {
  return [
    Utilities.getUuid(),
    Utilities.getUuid(),
    Utilities.getUuid()
  ].join('').replace(/-/g, '')
}

function sessionCacheKey_(token) {
  if (!token || String(token).length < 80 || String(token).length > 160) {
    throw publicError_('SESSION_INVALID', 'Sesi admin tidak valid. Silakan login kembali.')
  }
  return 'jn_admin_' + hmacHex_(token, getAuthPepper_())
}

function requireAdmin_(sessionToken) {
  var cache = CacheService.getScriptCache()
  var cacheKey = sessionCacheKey_(sessionToken)
  var session = cache.get(cacheKey)
  if (!session) {
    throw publicError_('ADMIN_SESSION_EXPIRED', 'Sesi admin berakhir. Silakan login kembali.')
  }
  return safeJsonParse_(session, { role: 'admin' })
}

function adminLogin_(password) {
  var input = String(password || '')
  if (input.length < 1 || input.length > 256) {
    throw publicError_('LOGIN_FAILED', 'Password admin tidak sesuai.')
  }

  var properties = getScriptProperties_()
  var now = Date.now()
  var lockedUntil = Number(properties.getProperty('JN_AUTH_LOCKED_UNTIL') || 0)
  if (lockedUntil > now) {
    throw publicError_('LOGIN_RATE_LIMITED', 'Terlalu banyak percobaan login. Coba lagi beberapa menit kemudian.')
  }

  var expectedHash = properties.getProperty('JN_ADMIN_PASSWORD_HASH')
  var salt = properties.getProperty('JN_ADMIN_PASSWORD_SALT')
  if (!expectedHash || !salt) {
    throw publicError_('ADMIN_NOT_CONFIGURED', 'Akun admin belum disiapkan oleh pemilik aplikasi.')
  }

  var actualHash = hmacHex_(salt + ':' + input, getAuthPepper_())
  if (!constantTimeEqual_(actualHash, expectedHash)) {
    withScriptLock_(function () {
      var count = Number(properties.getProperty('JN_AUTH_FAILED_COUNT') || 0) + 1
      properties.setProperty('JN_AUTH_FAILED_COUNT', String(count))
      if (count >= 8) {
        properties.setProperty('JN_AUTH_LOCKED_UNTIL', String(Date.now() + (15 * 60 * 1000)))
        properties.setProperty('JN_AUTH_FAILED_COUNT', '0')
      }
    })
    throw publicError_('LOGIN_FAILED', 'Email atau password admin tidak sesuai.')
  }

  withScriptLock_(function () {
    properties.deleteProperty('JN_AUTH_FAILED_COUNT')
    properties.deleteProperty('JN_AUTH_LOCKED_UNTIL')
  })

  var token = createSessionToken_()
  var cacheKey = sessionCacheKey_(token)
  var nowIso = isoNow_()
  CacheService.getScriptCache().put(cacheKey, JSON.stringify({
    role: 'admin',
    createdAt: nowIso
  }), 1800)

  appendAudit_('admin', 'primary', 'login_success', 'session', '', {})
  return { sessionToken: token, expiresInSeconds: 1800 }
}

function adminLogout_(sessionToken) {
  requireAdmin_(sessionToken)
  var cacheKey = sessionCacheKey_(sessionToken)
  CacheService.getScriptCache().remove(cacheKey)
  appendAudit_('admin', 'primary', 'logout', 'session', '', {})
  return { signedOut: true }
}
