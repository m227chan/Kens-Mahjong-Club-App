import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { LEGAL, termsSections } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Terms of Service · ${LEGAL.productName}`,
  description: `Terms governing use of ${LEGAL.productName}.`,
}

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description={`The rules for using ${LEGAL.productName}, operated by ${LEGAL.operatorName}.`}
      sections={termsSections}
    />
  )
}
