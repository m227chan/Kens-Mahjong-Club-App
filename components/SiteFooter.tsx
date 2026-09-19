import Link from 'next/link'
import { LEGAL } from '@/lib/legal'

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Site">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <p className="site-footer-name">{LEGAL.operatorName}</p>
          <p className="site-footer-meta">{LEGAL.jurisdiction}</p>
          <p>
            <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
          </p>
        </div>
        <nav className="site-footer-nav" aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/cookies">Cookie Policy</Link>
          <Link href="/data-deletion">Request data deletion</Link>
        </nav>
      </div>
    </footer>
  )
}
