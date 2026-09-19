import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { cookieSections, LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Cookie Policy · ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} uses cookies and browser storage.`,
}

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description={`Cookies and similar technologies used by ${LEGAL.productName}, and how to manage your choices.`}
      sections={cookieSections}
    />
  )
}
