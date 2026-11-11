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
