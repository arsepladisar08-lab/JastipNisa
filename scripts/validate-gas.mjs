import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { Script, createContext } from 'node:vm'

const root = process.cwd()
const required = [
  'gas/appsscript.json',
  'gas/Code.gs',
  'gas/Schema.gs',
  'gas/Database.gs',
  'gas/Setup.gs',
  'gas/Security.gs',
  'gas/RequestService.gs',
  'gas/WorkflowService.gs',
  'gas/CancellationService.gs',
  'gas/DriveService.gs',
  'gas/CatalogService.gs',
  'gas/Index.html',
  '.clasp.json.example',
]
const missing = required.filter((path) => !existsSync(resolve(root, path)))
if (missing.length) {
  console.error('Missing GAS files:', missing.join(', '))
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(resolve(root, 'gas/appsscript.json'), 'utf8'))
if (manifest.runtimeVersion !== 'V8' || manifest.webapp?.executeAs !== 'USER_DEPLOYING' ||
    manifest.webapp?.access !== 'ANYONE_ANONYMOUS') {
  throw new Error('Unexpected Apps Script runtime or Web App deployment identity.')
}
const scopes = manifest.oauthScopes || []
for (const scope of [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
]) {
  if (!scopes.includes(scope)) throw new Error('Missing OAuth scope: ' + scope)
}

// Parse all server files as one Apps Script V8 program. This is a syntax
// check only; Apps Script services are not available in the CI Node runtime.
const serverFiles = required.filter((path) => path.endsWith('.gs'))
const serverSource = serverFiles.map((path) =>
  '\n// ---- ' + path + ' ----\n' + readFileSync(resolve(root, path), 'utf8'),
).join('\n')
const serverProgram = new Script(serverSource, { filename: 'JastipNisaAppsScriptBundle.gs' })
if (!serverSource.includes('function doGet(e)') || !serverSource.includes('window.__JN_BOOT__')) {
  throw new Error('GAS server is missing validated deep-link bootstrap handling.')
}

function getServerFunctionSource(name) {
  const start = serverSource.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('Missing Apps Script function: ' + name)
  const end = serverSource.indexOf('\nfunction ', start + 10)
  return serverSource.slice(start, end < 0 ? serverSource.length : end)
}

const adminMutations = [
  'updateRequestItemAsAdmin_',
  'reissueCustomerAccessTokenAsAdmin_',
  'revokeCustomerAccessTokenAsAdmin_',
  'addUnitAsAdmin_',
  'assignUnitAsAdmin_',
  'createOrderAsAdmin_',
  'addPaymentAsAdmin_',
  'verifyPaymentAsAdmin_',
  'updateShipmentAsAdmin_',
  'addExpenseAsAdmin_',
  'updateOrderOptionsAsAdmin_',
  'getPaymentProofAsAdmin_',
  'uploadPaymentProofAsAdmin_',
  'saveCatalogProductAsAdmin_',
  'saveVariantAsAdmin_',
]
for (const name of adminMutations) {
  const body = getServerFunctionSource(name)
  const lock = body.indexOf('withScriptLock_(function () {')
  if (lock < 0 || !body.slice(lock).includes('session = requireAdmin_(sessionToken)')) {
    throw new Error('Admin mutation must revalidate its session inside LockService: ' + name)
  }
}

const photoUploadBody = getServerFunctionSource('uploadRequestPhotoAsAdmin_')
if (!photoUploadBody.includes('session = requireAdmin_(sessionToken)') ||
    !photoUploadBody.includes('file.setTrashed(true)')) {
  throw new Error('Request-photo upload must revalidate admin session and clean up stale Drive files.')
}

const customerDetailsBody = getServerFunctionSource('submitCustomerOrderDetails_')
const customerShopeeBody = getServerFunctionSource('confirmCustomerShopee_')
for (const [name, body] of [['submitCustomerOrderDetails_', customerDetailsBody], ['confirmCustomerShopee_', customerShopeeBody]]) {
  const lock = body.indexOf('withScriptLock_(function () {')
  if (lock < 0 || !body.slice(lock).includes('findRequestGroupByToken_(accessToken)')) {
    throw new Error('Customer mutation must revalidate its bearer token inside LockService: ' + name)
  }
}

const customerDecisionBody = getServerFunctionSource('customerRespondToItem_')
const customerDecisionLock = customerDecisionBody.indexOf('withScriptLock_(function () {')
if (customerDecisionLock < 0 ||
    !customerDecisionBody.slice(customerDecisionLock).includes('findRequestGroupByToken_(accessToken)') ||
    !customerDecisionBody.slice(customerDecisionLock).includes('DECISION_ALREADY_RECORDED')) {
  throw new Error('Customer decisions must revalidate tokens under lock and prevent conflicting repeated decisions.')
}

const customerPhotoBody = getServerFunctionSource('apiCustomerGetPhoto')
const customerPhotoLock = customerPhotoBody.indexOf('withScriptLock_(function () {')
if (customerPhotoLock < 0 ||
    customerPhotoBody.indexOf('DriveApp.getFileById') < customerPhotoLock) {
  throw new Error('Customer photo reads must be serialized with customer-token revocation.')
}

const paymentBody = getServerFunctionSource('addPaymentAsAdmin_')
const expenseBody = getServerFunctionSource('addExpenseAsAdmin_')
if (!paymentBody.includes('idempotency_payload_hash') || !paymentBody.includes('IDEMPOTENCY_CONFLICT') ||
    !expenseBody.includes('idempotency_payload_hash') || !expenseBody.includes('IDEMPOTENCY_CONFLICT')) {
  throw new Error('Payment and expense idempotency must fingerprint payloads and reject key conflicts.')
}
if (!serverSource.includes("'idempotency_payload_hash'")) {
  throw new Error('Database schema must persist idempotency payload fingerprints.')
}

if (!serverSource.includes("Cancellation_Requests: ['cancellation_request_id'")) {
  throw new Error('Cancellation review register must be included in the database schema.')
}
const cancellationCreateBody = getServerFunctionSource('createCustomerCancellationRequest_')
const cancellationReviewBody = getServerFunctionSource('reviewCancellationRequestAsAdmin_')
const cancellationCreateLock = cancellationCreateBody.indexOf('withScriptLock_(function () {')
const cancellationReviewLock = cancellationReviewBody.indexOf('withScriptLock_(function () {')
if (cancellationCreateLock < 0 ||
    !cancellationCreateBody.slice(cancellationCreateLock).includes('findRequestGroupByToken_(accessToken)') ||
    !cancellationCreateBody.includes("['confirmed', 'packing']")) {
  throw new Error('Customer cancellation requests must revalidate their token and only accept eligible pre-shipment orders.')
}
if (cancellationReviewLock < 0 ||
    !cancellationReviewBody.slice(cancellationReviewLock).includes('session = requireAdmin_(sessionToken)') ||
    !cancellationReviewBody.includes("['confirmed', 'packing']")) {
  throw new Error('Cancellation review must revalidate an admin session and the current order status under lock.')
}
for (const forbiddenWrite of [
  "updateRecord_('Orders'",
  "updateRecordsById_('Orders'",
  "updateRecord_('Units'",
  "updateRecordsById_('Units'",
  "updateRecord_('Payments'",
  "updateRecordsById_('Payments'",
]) {
  if (cancellationReviewBody.includes(forbiddenWrite)) {
    throw new Error('Cancellation review must not execute order, inventory, or payment changes automatically.')
  }
}
if (!cancellationReviewBody.includes('accepted_pending_execution') ||
    !cancellationReviewBody.includes('executionDeferred')) {
  throw new Error('Accepted cancellation requests must remain explicitly pending manual execution.')
}

// Exercise the database execution cache and grouped writes using an isolated
// in-memory Spreadsheet stub. This validates call counts and invalidation
// behavior without contacting any real Google spreadsheet.
const databaseTables = {
  Orders: {
    headers: ['order_id', 'status', 'total_amount'],
    rows: [
      ['o-1', 'confirmed', 100000],
      ['o-2', 'packing', 200000],
    ],
  },
}
const databaseCalls = { reads: 0, writes: 0 }
function createDatabaseSheet(tableName) {
  const table = databaseTables[tableName]
  return {
    getLastRow() { return table.rows.length + 1 },
    getLastColumn() { return table.headers.length },
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        getDisplayValues() {
          databaseCalls.reads += 1
          return Array.from({ length: rowCount }, (_, rowIndex) =>
            Array.from({ length: columnCount }, (_, columnIndex) => {
              const row = startRow + rowIndex - 1
              const column = startColumn + columnIndex - 1
              const value = row === 0 ? table.headers[column] : table.rows[row - 1]?.[column]
              return value === undefined || value === null ? '' : String(value)
            }),
          )
        },
        getValues() {
          databaseCalls.reads += 1
          return Array.from({ length: rowCount }, (_, rowIndex) =>
            Array.from({ length: columnCount }, (_, columnIndex) => {
              const row = startRow + rowIndex - 1
              const column = startColumn + columnIndex - 1
              return row === 0 ? table.headers[column] : table.rows[row - 1]?.[column] ?? ''
            }),
          )
        },
        setValues(matrix) {
          databaseCalls.writes += 1
          matrix.forEach((row, rowIndex) => {
            const absoluteRow = startRow + rowIndex - 1
            if (absoluteRow === 0) {
              table.headers = row.slice()
              return
            }
            while (table.rows.length < absoluteRow) {
              table.rows.push(Array(table.headers.length).fill(''))
            }
            row.forEach((value, columnIndex) => {
              table.rows[absoluteRow - 1][startColumn - 1 + columnIndex] = value
            })
          })
        },
      }
    },
  }
}
const databaseSpreadsheet = {
  getSheetByName(name) {
    return databaseTables[name] ? createDatabaseSheet(name) : null
  },
}
const databaseContext = createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-spreadsheet' }) },
  SpreadsheetApp: { openById: () => databaseSpreadsheet },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
})
serverProgram.runInContext(databaseContext)
databaseContext.resetDatabaseExecutionCache_()
const firstDatabaseSnapshot = databaseContext.readRecords_('Orders')
firstDatabaseSnapshot[0].status = 'mutated outside snapshot'
const secondDatabaseSnapshot = databaseContext.readRecords_('Orders')
if (secondDatabaseSnapshot[0].status !== 'confirmed') {
  throw new Error('Database cache must return isolated copies rather than exposing the cached snapshot.')
}
let databaseMetrics = databaseContext.getDatabaseExecutionMetrics_()
if (databaseMetrics.rangeReads !== 1 || databaseMetrics.cacheHits !== 1) {
  throw new Error('Repeated table reads within one execution must use one sheet data range read.')
}
const affectedRows = databaseContext.updateRecordsById_('Orders', 'order_id', [
  { id: 'o-1', patch: { status: 'packing' } },
  { id: 'o-2', patch: { status: 'shipped' } },
])
databaseMetrics = databaseContext.getDatabaseExecutionMetrics_()
if (affectedRows !== 2 || databaseMetrics.batchWriteGroups !== 1 || databaseMetrics.rangeWrites !== 1) {
  throw new Error('Adjacent record updates must be written in one contiguous spreadsheet range.')
}
const refreshedDatabaseRows = databaseContext.readRecords_('Orders')
if (refreshedDatabaseRows[0].status !== 'packing' || refreshedDatabaseRows[1].status !== 'shipped') {
  throw new Error('Database writes must invalidate cached table snapshots before the next read.')
}
databaseContext.withScriptLock_(function () {
  databaseContext.readRecords_('Orders')
  databaseContext.readRecords_('Orders')
})
databaseTables.Orders.rows[0][1] = 'external update'
if (databaseContext.readRecords_('Orders')[0].status !== 'external update') {
  throw new Error('Database snapshots must not survive the end of a locked Apps Script execution.')
}
console.log('Database cache/batch checks passed: 1 cached repeat read, 2 ID updates in 1 grouped range write.')

// Exercise doGet(e) with deterministic Apps Script service stubs. This does not
// replace a deployment test, but verifies query validation and bootstrap HTML.
const htmlServiceStub = {
  createHtmlOutputFromFile: () => ({
    getContent: () => '<!doctype html><html><head><title>JastipNisa</title></head><body><div id="root"></div></body></html>',
  }),
  createHtmlOutput: (content) => ({
    content,
    setTitle() { return this },
    addMetaTag() { return this },
  }),
}
const gasContext = createContext({
  HtmlService: htmlServiceStub,
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/test-deployment/exec' }) },
})
serverProgram.runInContext(gasContext)
const validPortalToken = 'A'.repeat(64)
const portalHtml = gasContext.doGet({ parameter: { page: 'portal', t: validPortalToken } }).content
const adminHtml = gasContext.doGet({ parameter: { page: 'admin', t: validPortalToken } }).content
const invalidHtml = gasContext.doGet({ parameter: { page: 'unknown', t: '<script>alert(1)</script>' } }).content
if (!portalHtml.includes('"page":"portal"') || !portalHtml.includes('"token":"' + validPortalToken + '"')) {
  throw new Error('GAS portal deep-link bootstrap did not preserve a valid customer token.')
}
if (!adminHtml.includes('"page":"admin"') || !adminHtml.includes('"token":""')) {
  throw new Error('GAS admin deep-link bootstrap must not accept a customer token.')
}
if (!invalidHtml.includes('"page":"home"') || !invalidHtml.includes('"token":""') || invalidHtml.includes('<script>alert(1)</script>')) {
  throw new Error('GAS deep-link bootstrap did not safely reject invalid page/token parameters.')
}

const htmlPath = resolve(root, 'gas/Index.html')
const html = readFileSync(htmlPath, 'utf8')
if (!html.includes('<base target="_top">')) throw new Error('Apps Script HTML is missing base target _top.')
// Ignore JavaScript string literals; inspect only document markup around scripts.
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
if (/<script\b[^>]*\bsrc=/i.test(markup)) throw new Error('Apps Script HTML still contains an external script reference.')
if (/<link\b[^>]*\bstylesheet[^>]*\bhref=/i.test(markup)) throw new Error('Apps Script HTML still contains an external stylesheet reference.')
if (!html.includes('JastipNisa')) throw new Error('Generated HTML does not contain the JastipNisa app shell.')
if (!html.includes('apiPublicGetCatalog') || !html.includes('apiAdminLogin')) {
  throw new Error('Generated HTML is missing required public/admin API bindings.')
}
if (html.includes('VITE_SUPABASE_URL') || html.includes('VITE_SUPABASE_ANON_KEY')) {
  throw new Error('Supabase environment identifiers must not be bundled in the GAS entrypoint.')
}
for (const mockMarker of ['handleGasMockCall', 'MOCK_CUSTOMER_TOKEN_1', 'MOCK_ADMIN_PASSWORD', 'MOCK_METHOD_NOT_IMPLEMENTED']) {
  if (html.includes(mockMarker)) {
    throw new Error('Development mock code must not be bundled in the production GAS entrypoint: ' + mockMarker)
  }
}

const bytes = statSync(htmlPath).size
console.log('GAS validation passed. Server syntax checked: ' + serverFiles.length + ' files. Bundle size: ' + Math.ceil(bytes / 1024) + ' KB')
