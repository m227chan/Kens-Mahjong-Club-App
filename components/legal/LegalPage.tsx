import Link from 'next/link'
import type { LegalSection } from '@/lib/legal'
import { LEGAL } from '@/lib/legal'

type LegalPageProps = {
  title: string
  description: string
  sections: LegalSection[]
}

export default function LegalPage({ title, description, sections }: LegalPageProps) {
  return (
    <article className="legal-page">
      <header className="legal-page-header">
        <p className="legal-page-kicker">{LEGAL.operatorName}</p>
        <h1>{title}</h1>
        <p className="legal-page-lede">{description}</p>
        <p className="legal-page-meta">Last updated: {LEGAL.lastUpdated}</p>
        <p className="legal-page-notice" role="note">
          {LEGAL.counselNotice}
        </p>
      </header>

      <nav className="legal-page-toc" aria-label="On this page">
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="legal-page-body">
        {sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
            <h2 id={`${section.id}-heading`}>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.id}-p-${index}`}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul>
                {section.bullets.map((item, index) => (
                  <li key={`${section.id}-b-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <footer className="legal-page-footer">
        <p>
          Contact:{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>
        <p className="legal-page-related">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/data-deletion">Request data deletion</Link>
        </p>
      </footer>
    </article>
  )
}
