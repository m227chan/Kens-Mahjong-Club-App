import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/api')>('@/lib/server/api')
  return actual
})

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('https://mahjong.example/api/data-deletion-request', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}

describe('data deletion request API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'noreply@mahjongmessiah.club'
    delete process.env.DATA_DELETION_TO
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects invalid email', async () => {
    const { POST } = await import('@/app/api/data-deletion-request/route')
    const response = await POST(
      request({ name: 'Alex Player', email: 'not-an-email', details: '' }),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Enter a valid email address.',
    })
  })

  it('rejects short names', async () => {
    const { POST } = await import('@/app/api/data-deletion-request/route')
    const response = await POST(request({ name: 'A', email: 'alex@example.com' }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Enter your name.' })
  })

  it('sends email via Resend when configured', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/data-deletion-request/route')
    const response = await POST(
      request({
        name: 'Alex Player',
        email: 'alex@example.com',
        clubId: 'abc123',
        details: 'Please remove my account.',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(call[1].body))
    expect(body.to).toEqual(['hello@mahjongmessiah.club'])
    expect(body.reply_to).toBe('alex@example.com')
    expect(body.subject).toContain('Alex Player')
    expect(body.text).toContain('ABC123')
  })

  it('returns 503 when email is not configured', async () => {
    delete process.env.RESEND_API_KEY
    const { POST } = await import('@/app/api/data-deletion-request/route')
    const response = await POST(
      request({ name: 'Alex Player', email: 'alex@example.com' }),
    )
    expect(response.status).toBe(503)
  })
})
