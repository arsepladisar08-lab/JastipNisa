import { beforeEach, describe, expect, it } from 'vitest'
import { handleGasMockCall, resetGasMockForTests } from './gasMock'

describe('GAS in-memory demo backend', () => {
  beforeEach(() => resetGasMockForTests())

  it('provides a seeded catalog and public configuration without a GAS bridge', async () => {
    const catalog = await handleGasMockCall<{ products: Array<{ productId: string }>; variants: unknown[] }>('apiPublicGetCatalog')
    const config = await handleGasMockCall<Record<string, string>>('apiPublicGetConfig')

    expect(catalog.products.length).toBeGreaterThan(0)
    expect(catalog.variants.length).toBeGreaterThan(0)
    expect(config.public_notice).toContain('MODE DEMO')
  })

  it('requires the demo password and exposes seeded admin workflows', async () => {
    await expect(handleGasMockCall('apiAdminLogin', ['wrong-password', 'demo-browser']))
      .rejects.toMatchObject({ code: 'LOGIN_FAILED' })

    const login = await handleGasMockCall<{ sessionToken: string }>('apiAdminLogin', ['demo-admin', 'demo-browser'])
    const requests = await handleGasMockCall<Array<{ requestCode: string }>>('apiAdminListRequests', [login.sessionToken, 'all'])
    const orders = await handleGasMockCall<Array<{ orderCode: string }>>('apiAdminListOrders', [login.sessionToken])

    expect(requests).toHaveLength(2)
    expect(orders).toHaveLength(1)
  })

  it('opens seeded customer portals and rejects invalid tokens', async () => {
    const token = 'demo_customer_token_0000000000000000000000000000000000000000000000000000000000000000'
    const portal = await handleGasMockCall<{ requestCode: string; items: Array<{ requestId: string; photoCount: number }> }>(
      'apiCustomerGetPortal', [token],
    )

    expect(portal.requestCode).toBe('JN-DEMO-001')
    expect(portal.items[0].photoCount).toBe(1)
    await expect(handleGasMockCall('apiCustomerGetPortal', ['invalid']))
      .rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' })
  })

  it('creates an unlimited-quantity demo request and calculates the established fee', async () => {
    const catalog = await handleGasMockCall<{ products: Array<{ productId: string }> }>('apiPublicGetCatalog')
    const created = await handleGasMockCall<{ requestCode: string; productCount: number; estimatedJastipFee: number }>(
      'apiPublicCreateRequest',
      [{
        customerName: 'Pengguna Demo',
        phone: '081234567890',
        submissionId: 'demo-submission-00000001',
        accessToken: 'demo_new_customer_token_000000000000000000000000000000000000000000000000',
        items: [{ productId: catalog.products[0].productId, quantity: 12 }],
      }],
    )

    expect(created.requestCode).toContain('JN-DEMO-')
    expect(created.productCount).toBe(12)
    expect(created.estimatedJastipFee).toBe(125000)
  })

  it('reuses a retried customer submission instead of creating a duplicate group', async () => {
    const catalog = await handleGasMockCall<{ products: Array<{ productId: string }> }>('apiPublicGetCatalog')
    const payload = {
      customerName: 'Pemesan Demo',
      phone: '081234567890',
      submissionId: 'demo-retry-submission-000001',
      accessToken: 'demo_retry_token_000000000000000000000000000000000000000000000000',
      items: [{ productId: catalog.products[0].productId, quantity: 1 }],
    }
    const first = await handleGasMockCall<{ requestGroupId: string; reusedSubmission: boolean }>('apiPublicCreateRequest', [payload])
    const retry = await handleGasMockCall<{ requestGroupId: string; reusedSubmission: boolean }>('apiPublicCreateRequest', [payload])
    const login = await handleGasMockCall<{ sessionToken: string }>('apiAdminLogin', ['demo-admin', 'demo-browser'])
    const requests = await handleGasMockCall<Array<{ requestCode: string }>>('apiAdminListRequests', [login.sessionToken, 'all'])

    expect(retry.requestGroupId).toBe(first.requestGroupId)
    expect(retry.reusedSubmission).toBe(true)
    expect(requests).toHaveLength(3)
  })

  it('locks in customer decisions and releases units after rejection', async () => {
    const catalog = await handleGasMockCall<{ products: Array<{ productId: string }>; variants: Array<{ variantId: string; productId: string }> }>('apiPublicGetCatalog')
    const product = catalog.products.find((item) => item.productId === 'demo-product-2')!
    const variant = catalog.variants.find((item) => item.productId === product.productId)!
    const created = await handleGasMockCall<{ requestGroupId: string; accessToken: string }>('apiPublicCreateRequest', [{
      customerName: 'Pelanggan Demo',
      phone: '081234567890',
      submissionId: 'demo-customer-reject-flow-0001',
      accessToken: 'demo_reject_flow_token_00000000000000000000000000000000000000000000',
      items: [{ productId: product.productId, variantId: variant.variantId, quantity: 1 }],
    }])
    const login = await handleGasMockCall<{ sessionToken: string }>('apiAdminLogin', ['demo-admin', 'demo-browser'])
    const requests = await handleGasMockCall<Array<{ requestGroupId: string; items: Array<{ requestId: string }> }>>('apiAdminListRequests', [login.sessionToken, 'all'])
    const group = requests.find((item) => item.requestGroupId === created.requestGroupId)!
    const requestId = group.items[0].requestId
    await handleGasMockCall('apiAdminUpdateRequestItem', [login.sessionToken, { requestId, status: 'searching', actualCondition: '' }])
    await handleGasMockCall('apiAdminUpdateRequestItem', [login.sessionToken, { requestId, status: 'found', actualCondition: 'Foto demo tersedia' }])
    await handleGasMockCall('apiAdminUploadRequestPhoto', [login.sessionToken, { requestId }])
    const unit = await handleGasMockCall<{ unitId: string }>('apiAdminAddUnit', [login.sessionToken, {
      unitCode: 'DEMO-REJECT-UNIT',
      productId: product.productId,
      variantId: variant.variantId,
      purchasePrice: 90000,
      sellingPrice: 119000,
    }])
    await handleGasMockCall('apiAdminAssignUnit', [login.sessionToken, requestId, unit.unitId])
    const token = created.accessToken
    await expect(handleGasMockCall('apiCustomerRespondToItem', [token, requestId, 'rejected']))
      .resolves.toMatchObject({ saved: true, decision: 'rejected', reused: false })
    await expect(handleGasMockCall('apiCustomerRespondToItem', [token, requestId, 'rejected']))
      .resolves.toMatchObject({ saved: true, decision: 'rejected', reused: true })
    await expect(handleGasMockCall('apiCustomerRespondToItem', [token, requestId, 'approved']))
      .rejects.toMatchObject({ code: 'DECISION_ALREADY_RECORDED' })
    const dashboard = await handleGasMockCall<{ unitsAvailable: number }>('apiAdminGetDashboard', [login.sessionToken])
    expect(dashboard.unitsAvailable).toBe(2)
  })

  it('rejects idempotency keys reused with different payment or expense payloads', async () => {
    const login = await handleGasMockCall<{ sessionToken: string }>('apiAdminLogin', ['demo-admin', 'demo-browser'])
    const paymentPayload = {
      requestGroupId: 'demo-group-search',
      type: 'deposit',
      amount: 50000,
      method: 'bank_transfer',
      idempotencyKey: 'demo-payment-idempotency-0001',
      notes: 'Deposit demo',
    }
    const first = await handleGasMockCall<{ paymentId: string; reused: boolean }>('apiAdminAddPayment', [login.sessionToken, paymentPayload])
    const retry = await handleGasMockCall<{ paymentId: string; reused: boolean }>('apiAdminAddPayment', [login.sessionToken, paymentPayload])
    expect(retry).toMatchObject({ paymentId: first.paymentId, reused: true })
    await expect(handleGasMockCall('apiAdminAddPayment', [login.sessionToken, { ...paymentPayload, amount: 60000 }]))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })

    await handleGasMockCall('apiAdminVerifyPayment', [login.sessionToken, first.paymentId, 'verified'])
    await expect(handleGasMockCall('apiAdminVerifyPayment', [login.sessionToken, first.paymentId, 'verified']))
      .resolves.toMatchObject({ saved: true, reused: true })
    await expect(handleGasMockCall('apiAdminVerifyPayment', [login.sessionToken, first.paymentId, 'rejected']))
      .rejects.toMatchObject({ code: 'INVALID_STATE' })

    const expensePayload = {
      occurredAt: '2026-11-11',
      category: 'Transport',
      description: 'Transport demo',
      amount: 15000,
      orderId: '',
      idempotencyKey: 'demo-expense-idempotency-0001',
    }
    const expense = await handleGasMockCall<{ expenseId: string; reused: boolean }>('apiAdminAddExpense', [login.sessionToken, expensePayload])
    await expect(handleGasMockCall('apiAdminAddExpense', [login.sessionToken, expensePayload]))
      .resolves.toMatchObject({ expenseId: expense.expenseId, reused: true })
    await expect(handleGasMockCall('apiAdminAddExpense', [login.sessionToken, { ...expensePayload, amount: 20000 }]))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('reissues and revokes customer access tokens', async () => {
    const login = await handleGasMockCall<{ sessionToken: string }>('apiAdminLogin', ['demo-admin', 'demo-browser'])
    const oldToken = 'demo_customer_token_1111111111111111111111111111111111111111111111111111111111111111'
    const reissued = await handleGasMockCall<{ accessToken: string }>(
      'apiAdminReissueCustomerAccessToken', [login.sessionToken, 'demo-group-search'],
    )

    expect(reissued.accessToken).not.toBe(oldToken)
    await expect(handleGasMockCall('apiCustomerGetPortal', [oldToken])).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    await expect(handleGasMockCall('apiCustomerGetPortal', [reissued.accessToken])).resolves.toMatchObject({
      requestCode: 'JN-DEMO-002',
    })
    await handleGasMockCall('apiAdminRevokeCustomerAccessToken', [login.sessionToken, 'demo-group-search'])
    await expect(handleGasMockCall('apiCustomerGetPortal', [reissued.accessToken])).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
  })
})
