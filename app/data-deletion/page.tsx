import type { Metadata } from 'next'
import Link from 'next/link'
import DataDeletionForm from '@/components/legal/DataDeletionForm'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Request data deletion · ${LEGAL.productName}`,
  description: `Request deletion of your ${LEGAL.productName} account data.`,
}

export default function DataDeletionPage() {
  return (
    <article className="legal-page data-deletion-page">
      <header className="legal-page-header">
        <p className="legal-page-kicker">{LEGAL.operatorName}</p>
        <h1>Request data deletion</h1>
        <p className="legal-page-lede">
          Signed-in users should delete from Account settings. Everyone else can submit a manual
          request below.
        </p>
        <p className="legal-page-notice" role="note">
          {LEGAL.counselNotice}
        </p>
      </header>

      <section className="data-deletion-selfserve" aria-labelledby="self-serve-heading">
        <h2 id="self-serve-heading">Delete in the app</h2>
        <ol>
          <li>Sign in with Google.</li>
          <li>Open Account settings from the header.</li>
          <li>Choose Delete Account, resolve any sole-manager clubs, and confirm your name.</li>
        </ol>
        <p>
          Player game history for clubs is typically retained but unlinked from your auth identity.
          Memberships and your personal account profile are removed. See the{' '}
          <Link href="/privacy">Privacy Policy</Link> for details.
        </p>
      </section>

      <section aria-labelledby="form-heading">
        <h2 id="form-heading">Cannot sign in?</h2>
        <DataDeletionForm />
      </section>
    </article>
  )
}
