import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { LEGAL, privacySections } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Privacy Policy · ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} collects and uses personal information.`,
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`How ${LEGAL.operatorName} handles personal information for ${LEGAL.productName}, including accounts, clubs, scoring, and guest tables.`}
      sections={privacySections}
    />
  )
}
