'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { generateAllTableQrs, type TableQr } from '@/lib/table-checkin-client'

export default function PrintSessionQrsPage() {
  const { clubId = '' } = useParams<{ clubId: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [codes, setCodes] = useState<TableQr[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!loading && !user) router.replace('/login') }, [loading, router, user])
  useEffect(() => { if (user) void generateAllTableQrs(clubId).then(setCodes).catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Unable to generate QR codes.')) }, [clubId, user])
  const pages = Array.from({ length: Math.ceil(codes.length / 4) }, (_, index) => codes.slice(index * 4, index * 4 + 4))
  return <main className="qr-print-root">
    <div className="qr-print-toolbar"><button type="button" onClick={() => router.back()}>← Back</button><strong>Session table QR codes</strong><button type="button" onClick={() => window.print()} disabled={!codes.length}>Print</button></div>
    {error ? <p className="qr-print-error">{error}</p> : null}
    {!codes.length && !error ? <p className="qr-print-loading">Generating printable QR codes…</p> : null}
    {pages.map((page, pageIndex) => <section className="qr-print-page" key={pageIndex}>{page.map((code) => <article className="qr-print-card" key={code.tableNumber}><div className="qr-print-code" dangerouslySetInnerHTML={{ __html: code.svg }} /><h1>Table {code.tableNumber}</h1><p>Scan to check in and keep score</p></article>)}</section>)}
    <style jsx global>{`
      .qr-print-root{background:#e8e5d8;min-height:100vh;padding:20px}.qr-print-toolbar{position:sticky;top:0;z-index:3;margin:0 auto 18px;max-width:8.5in;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #c9c3ad;background:#fff;padding:12px 16px;color:#111}.qr-print-toolbar button{min-height:42px;border:1px solid #777;background:#fff;color:#111;padding:0 16px;font-weight:800}.qr-print-page{box-sizing:border-box;width:8.5in;height:11in;margin:0 auto 20px;padding:.35in;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;background:#fff;color:#000;box-shadow:0 8px 30px #0002;page-break-after:always}.qr-print-card{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px dashed #000;background:#fff;color:#000;text-align:center;padding:.2in}.qr-print-code{width:2.75in;height:2.75in;background:#fff}.qr-print-code svg{width:100%;height:100%;display:block}.qr-print-card h1{margin:.12in 0 0;font:900 24pt/1.1 system-ui;color:#000}.qr-print-card p{margin:.08in 0 0;font:600 10pt/1.2 system-ui;color:#000}.qr-print-error,.qr-print-loading{margin:40px auto;max-width:8.5in;background:#fff;color:#111;padding:30px;text-align:center;font-weight:800}html.dark .qr-print-root{background:#06120e}html.dark .qr-print-toolbar{border-color:#355047;background:#10231c;color:#f4f0df}html.dark .qr-print-toolbar button{border-color:#587067;background:#07140f;color:#f4f0df}html.dark .qr-print-error,html.dark .qr-print-loading{border:1px solid #355047;background:#10231c;color:#f4f0df}@media print{@page{size:Letter portrait;margin:0}.club-header,.qr-print-toolbar{display:none!important}.qr-print-root{padding:0!important;background:#fff!important}.qr-print-page{margin:0;box-shadow:none;background:#fff!important;color:#000!important;filter:grayscale(1)}.qr-print-card,.qr-print-code{background:#fff!important;color:#000!important;border-color:#000!important}.qr-print-card h1,.qr-print-card p{color:#000!important}.qr-print-page:last-child{page-break-after:auto}}
    `}</style>
  </main>
}
