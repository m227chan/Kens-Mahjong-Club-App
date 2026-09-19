'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'

export default function DataDeletionForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [clubId, setClubId] = useState('')
  const [details, setDetails] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!confirmed) {
      setError('Confirm that you want us to process this deletion request.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/data-deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          clubId: clubId.trim(),
          details: details.trim(),
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to submit the request.')
      }
      setDone(true)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit the request.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="data-deletion-success" role="status">
        <h2>Request received</h2>
        <p>
          We emailed {LEGAL.operatorName}. Expect a response within about{' '}
          {LEGAL.responseWindowDays} days at the address you provided, or from{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
        <p>
          If you can still sign in, you may also delete your account immediately from Account
          settings.
        </p>
      </div>
    )
  }

  return (
    <form className="data-deletion-form" onSubmit={(event) => void onSubmit(event)} noValidate>
      <p className="data-deletion-lede">
        Prefer self-service? Sign in and use{' '}
        <strong>Account settings → Delete Account</strong>. Use this form if you cannot sign in.
        Requests are handled manually — we do not auto-delete from this form.
      </p>

      <label className="data-deletion-label">
        Your name
        <input
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="data-deletion-input"
        />
      </label>

      <label className="data-deletion-label">
        Email associated with the account
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="data-deletion-input"
        />
      </label>

      <label className="data-deletion-label">
        Club ID (optional)
        <input
          name="clubId"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          value={clubId}
          onChange={(event) => setClubId(event.target.value.toUpperCase())}
          className="data-deletion-input"
          placeholder="ABC123"
        />
      </label>

      <label className="data-deletion-label">
        Additional details (optional)
        <textarea
          name="details"
          rows={4}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          className="data-deletion-input data-deletion-textarea"
          maxLength={2000}
        />
      </label>

      <label className="data-deletion-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          I request deletion or unlinking of my personal account data as described in the{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>

      {error ? (
        <p className="data-deletion-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="data-deletion-submit" disabled={busy || !confirmed}>
        {busy ? 'Sending…' : 'Submit deletion request'}
      </button>
    </form>
  )
}
