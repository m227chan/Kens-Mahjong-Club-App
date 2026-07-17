import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { apiError, bearerToken, jsonObject } from '@/lib/server/api'

function request(body = '{}', headers: Record<string, string> = {}) {
  return new NextRequest('https://mahjong.example/api/test', {
    method: 'POST',
    body,
    headers,
  })
}

describe('server API boundary', () => {
  it('requires a strict bearer token', () => {
    expect(
      bearerToken(request('{}', { authorization: 'Bearer valid-token' })),
    ).toBe('valid-token')
    expect(() => bearerToken(request())).toThrow('Authentication required.')
    expect(() =>
      bearerToken(request('{}', { authorization: 'Basic invalid' })),
    ).toThrow('Authentication required.')
  })

  it('accepts JSON objects and rejects other JSON values', async () => {
    await expect(jsonObject(request('{"action":"test"}'))).resolves.toEqual({
      action: 'test',
    })
    await expect(jsonObject(request('[]'))).rejects.toThrow(
      'Request body must be a JSON object.',
    )
  })

  it('enforces body limits using actual UTF-8 bytes', async () => {
    await expect(jsonObject(request('{"value":"é"}'), 12)).rejects.toThrow(
      'Request body is too large.',
    )
  })

  it('redacts database errors while logging them server-side', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = apiError(
      Object.assign(new Error('relation secret_table does not exist'), {
        code: '42P01',
      }),
      'Database operation failed.',
    )
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Database operation failed.',
    })
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })

  it('uses authentication and authorization status codes', async () => {
    const auth = apiError({ code: 'auth/id-token-expired' }, 'Failed.')
    expect(auth.status).toBe(401)

    const forbidden = apiError(
      new Error('Only an active club manager can do that.'),
      'Failed.',
    )
    expect(forbidden.status).toBe(403)
  })
})
