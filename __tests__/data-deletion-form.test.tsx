import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DataDeletionForm from '@/components/legal/DataDeletionForm'

describe('data deletion form', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('requires confirmation before submit is enabled', () => {
    render(<DataDeletionForm />)
    expect(screen.getByRole('button', { name: /Submit deletion request/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: /Submit deletion request/i })).not.toBeDisabled()
  })

  it('posts the request and shows success', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    render(<DataDeletionForm />)
    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Alex Player' },
    })
    fireEvent.change(screen.getByLabelText(/Email associated/i), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Submit deletion request/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Request received/i)
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/data-deletion-request',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
