export const LEGAL = {
  productName: 'Mahjong Messiah',
  operatorName: 'MahjongMessiah Team',
  contactEmail: 'hello@mahjongmessiah.club',
  jurisdiction: 'Ontario, Canada',
  governingLaw: 'the laws of the Province of Ontario and the federal laws of Canada applicable therein',
  lastUpdated: '2026-09-18',
  counselNotice:
    'This document is a placeholder draft intended for review by qualified legal counsel. It describes how Mahjong Messiah works today and is not formal legal advice.',
  responseWindowDays: 30,
} as const

export type LegalSection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export const privacySections: LegalSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    paragraphs: [
      `${LEGAL.productName} is a club scorekeeping service operated by ${LEGAL.operatorName}. We help clubs run live Mahjong sessions, record games, calculate fan, track Skill ratings and standings, manage rosters, and use guest table scoring when a session is open.`,
      `This Privacy Policy explains what personal information we collect, how we use it, and the choices you have. Questions: ${LEGAL.contactEmail}.`,
    ],
  },
  {
    id: 'who',
    title: 'Who we are',
    paragraphs: [
      `The service is provided by ${LEGAL.operatorName}. We do not publish a registered postal address. Contact us by email at ${LEGAL.contactEmail}.`,
      `This policy is intended for users in ${LEGAL.jurisdiction} and elsewhere who use the service. We process personal information in accordance with applicable Canadian privacy principles, including PIPEDA where it applies.`,
    ],
  },
  {
    id: 'children',
    title: 'Children under 13',
    paragraphs: [
      `${LEGAL.productName} is not directed at children under 13. We do not knowingly collect personal information from anyone under 13. You must confirm you are 13 or older before signing in or using guest table scoring from the login page.`,
      'If you believe a child under 13 has created an account or otherwise provided personal information, contact us and we will take steps to delete that information.',
    ],
  },
  {
    id: 'collect',
    title: 'Information we collect',
    paragraphs: [
      'Depending how you use the service, we may collect:',
    ],
    bullets: [
      'Google account details when you sign in: display name, email address, and a Firebase user ID.',
      'Account profile information stored for the app (linked to your Firebase user ID).',
      'Club memberships, manager status, join requests, and roster links between your account and player profiles.',
      'Game results, scores, fan calculations, Skill ratings, season/tournament standings, titles, and related club analytics.',
      'Live session and table data, including seat assignments, winds, dealer rotation, and QR / check-in links for tables.',
      'Guest table access: a short-lived guest token and any display name used at a table during an open session (session-scoped club data, not a full account).',
      'Emails we send on your behalf for club join requests (via our email provider).',
      'Technical and preference data stored in your browser, such as sound settings, offline game queues, club UI preferences, age attestation, and cookie/storage consent choices.',
    ],
  },
  {
    id: 'use',
    title: 'How we use information',
    paragraphs: [
      'We use personal information to:',
    ],
    bullets: [
      'Authenticate you and keep your clubs and results available across devices.',
      'Operate scoring, standings, Skill ratings, seasons, titles, and club administration tools.',
      'Support guest scoring and table check-in during live sessions.',
      'Send transactional emails such as club join-request notifications.',
      'Maintain security, prevent abuse, troubleshoot issues, and improve reliability.',
      'Respond to privacy, deletion, and support requests.',
    ],
  },
  {
    id: 'processors',
    title: 'Service providers and hosting',
    paragraphs: [
      'We use trusted processors to run the product:',
    ],
    bullets: [
      'Firebase Authentication (Google) for sign-in.',
      'Supabase / PostgreSQL for application data.',
      'Vercel (or similar hosting) to serve the web application.',
      'Resend for transactional email delivery.',
    ],
  },
  {
    id: 'processors-note',
    title: 'International processing',
    paragraphs: [
      'Our providers may process data in Canada, the United States, or other countries where they operate. By using the service you understand that your information may be transferred to and stored in those locations, subject to the safeguards those providers maintain.',
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing',
    paragraphs: [
      'Club members and managers can see information that is part of club activity (for example player names on a roster, scores on a table, and standings). Managers may also see join-request details needed to approve membership.',
      'We do not sell personal information. We share data with processors only as needed to operate the service, or when required by law.',
    ],
  },
  {
    id: 'retention',
    title: 'Retention',
    paragraphs: [
      'We keep account and club records while your account or club remains active and as needed to provide the service.',
      'When you delete your account in the app, we remove your memberships and personal account profile and unlink your auth identity from player records. Club game history and player score records are generally retained so other members’ standings and history stay intact; those records are no longer tied to your signed-in account.',
      'Guest table tokens are short-lived and tied to an open session. Browser storage preferences remain on your device until you clear them.',
    ],
  },
  {
    id: 'rights',
    title: 'Your choices and rights',
    paragraphs: [
      'Depending on where you live, you may have rights to access, correct, or delete personal information, or to withdraw consent where processing is based on consent.',
      'Signed-in users can permanently delete their account from Account settings (Delete Account). That flow explains club-manager handoff requirements and what is kept versus removed.',
      `If you cannot sign in, submit a request on our Data deletion page or email ${LEGAL.contactEmail}. We aim to respond within ${LEGAL.responseWindowDays} days.`,
      'You can change cookie and preference-storage choices through the cookie banner (or by clearing site data in your browser).',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    paragraphs: [
      'We use industry-standard practices such as authenticated API access, role-based club permissions, and careful handling of secrets. No method of transmission or storage is completely secure; please protect your Google account and only share club codes with people you trust.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes',
    paragraphs: [
      'We may update this policy as the product evolves. The “Last updated” date at the top will change when we do. Continued use after an update means you accept the revised policy, except where applicable law requires additional notice or consent.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [
      `${LEGAL.operatorName}`,
      `Email: ${LEGAL.contactEmail}`,
      `Governing jurisdiction referenced for this service: ${LEGAL.jurisdiction}.`,
    ],
  },
]

export const termsSections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    paragraphs: [
      `These Terms of Service (“Terms”) govern your use of ${LEGAL.productName}, operated by ${LEGAL.operatorName}. By creating an account, signing in, using guest table scoring, or otherwise using the service, you agree to these Terms and our Privacy Policy.`,
      LEGAL.counselNotice,
    ],
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    paragraphs: [
      'You must be at least 13 years old to use the service. The service is not directed at children under 13, and we do not knowingly collect their personal information.',
      'You are responsible for the Google account you use to sign in and for activity under that account.',
    ],
  },
  {
    id: 'service',
    title: 'The service',
    paragraphs: [
      `${LEGAL.productName} provides tools for Mahjong clubs, including but not limited to: multi-club dashboards, live session and focused table scoring, fan calculators and house rules, Skill ratings and standings, seasons and tournaments, titles, roster and join-request management, QR table check-in, guest table scoring, offline-safe game queuing, and related analytics.`,
      'Features may change, and we may add, modify, or discontinue functionality without notice where reasonable.',
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and clubs',
    paragraphs: [
      'Club managers are responsible for how their club is run: who may join, house scoring rules, seasons, and access to guest or QR entry.',
      'You agree not to misuse club codes, guest links, or check-in QR codes, and not to impersonate other players or interfere with another club’s data.',
      'Game history and standings are shared among club members. Deleting your account unlinks your identity from player records but does not erase other members’ historical games.',
    ],
  },
  {
    id: 'guest',
    title: 'Guest table scoring',
    paragraphs: [
      'Guest access lets someone score at an open table without a full account when a club session is live. Guest use is limited to that session context. Clubs decide whether guest or QR check-in is appropriate for their group.',
    ],
  },
  {
    id: 'acceptable',
    title: 'Acceptable use',
    paragraphs: [
      'You agree not to:',
    ],
    bullets: [
      'Attempt unauthorized access to accounts, clubs, APIs, or other users’ data.',
      'Upload malware, scrape the service abusively, or disrupt availability.',
      'Use the service for unlawful purposes or to harass others.',
      'Misrepresent your age or create accounts for anyone under 13.',
    ],
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    paragraphs: [
      `The ${LEGAL.productName} name, branding, interface, and software are owned by ${LEGAL.operatorName} or its licensors. You retain rights to the club content you submit, and you grant us a license to host and process that content solely to operate the service.`,
    ],
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer of warranties',
    paragraphs: [
      'The service is provided “as is” and “as available.” To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. Scoring, Skill ratings, and analytics depend on the data entered by clubs and may contain errors.',
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    paragraphs: [
      `To the fullest extent permitted by law, ${LEGAL.operatorName} and its contributors are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or goodwill, arising from your use of the service.`,
      'Our total liability for any claim relating to the service is limited to the greater of CAD $50 or the amount you paid us (if any) for the service in the twelve months before the claim.',
    ],
  },
  {
    id: 'termination',
    title: 'Termination',
    paragraphs: [
      'You may stop using the service and delete your account at any time through Account settings. We may suspend or terminate access if you violate these Terms or if we need to protect the service or other users.',
    ],
  },
  {
    id: 'law',
    title: 'Governing law',
    paragraphs: [
      `These Terms are governed by ${LEGAL.governingLaw}, without regard to conflict-of-law rules. Courts in ${LEGAL.jurisdiction} have exclusive jurisdiction over disputes, subject to mandatory consumer protections that cannot be waived.`,
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [
      `${LEGAL.operatorName} · ${LEGAL.contactEmail}`,
    ],
  },
]

export const cookieSections: LegalSection[] = [
  {
    id: 'intro',
    title: 'About this policy',
    paragraphs: [
      `This Cookie Policy explains how ${LEGAL.productName} uses cookies and similar technologies such as browser local storage and session storage. It should be read with our Privacy Policy.`,
      LEGAL.counselNotice,
    ],
  },
  {
    id: 'what',
    title: 'What we use',
    paragraphs: [
      'We currently do not use third-party advertising or analytics trackers. We do use:',
    ],
    bullets: [
      'Essential authentication storage from Firebase / Google sign-in so you can stay signed in and call authenticated APIs securely.',
      'Preference and functional storage on your device (for example sound preferences, offline game queues, club UI layout preferences, age attestation, and your cookie-consent choice).',
      'Short-lived session storage for flows such as table QR / check-in handoff.',
    ],
  },
  {
    id: 'categories',
    title: 'Categories',
    paragraphs: [
      'Essential: required for sign-in, security, and core scoring features. These continue to work even if you choose “Essential only.”',
      'Preferences: optional storage that remembers non-essential UI and client preferences (sound, layout, offline queue helpers, consent choice itself). Choosing “Essential only” limits preference storage where the product can still function without it; some convenience features may reset.',
    ],
  },
  {
    id: 'manage',
    title: 'Managing choices',
    paragraphs: [
      'When you first visit, a banner lets you Accept preferences storage or choose Essential only. You can clear site data in your browser to reset the choice and see the banner again.',
      'Browser controls also let you block cookies; blocking essential auth storage may prevent sign-in from working.',
    ],
  },
  {
    id: 'updates',
    title: 'Updates',
    paragraphs: [
      `If we add non-essential cookies or tracking in the future, we will update this policy and the consent banner. Last updated: ${LEGAL.lastUpdated}.`,
      `Questions: ${LEGAL.contactEmail}.`,
    ],
  },
]
