'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { generateAllTableQrs, type TableQr } from '@/lib/table-checkin-client'

export default function PrintSessionQrsPage() {
  const { clubId = '' } = useParams<{ clubId: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [codes, setCodes] = useState<TableQr[]>([])
  const [loadingCodes, setLoadingCodes] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, router, user])

  const loadCodes = useCallback(async () => {
    if (!user) return
    setLoadingCodes(true)
    setError(null)
    try {
      setCodes(await generateAllTableQrs(clubId))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to generate QR codes.')
    } finally {
      setLoadingCodes(false)
    }
  }, [clubId, user])

  useEffect(() => {
    if (user) void loadCodes()
  }, [loadCodes, user])

  const pages = Array.from(
    { length: Math.ceil(codes.length / 4) },
    (_, index) => codes.slice(index * 4, index * 4 + 4),
  )

  if (loading || !user) {
    return (
      <main className="qr-print-root">
        <p className="qr-print-loading" role="status">Opening the printable QR codes…</p>
        <QrPrintStyles />
      </main>
    )
  }

  return (
    <main className="qr-print-root" aria-busy={loadingCodes}>
      <header className="qr-print-toolbar">
        <button type="button" onClick={() => router.back()}>← Back</button>
        <h1>Session table QR codes</h1>
        <button type="button" onClick={() => window.print()} disabled={!codes.length || loadingCodes}>
          Print
        </button>
      </header>

      {error ? (
        <div className="qr-print-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadCodes()}>Try again</button>
        </div>
      ) : null}

      {loadingCodes ? (
        <p className="qr-print-loading" role="status" aria-live="polite">
          Generating printable QR codes…
        </p>
      ) : null}

      {!loadingCodes && !error && codes.length === 0 ? (
        <p className="qr-print-loading" role="status">No table QR codes are available for this session.</p>
      ) : null}

      {pages.length > 0 ? (
        <div className="qr-print-preview" aria-label="Printable QR code preview">
          {pages.map((page, pageIndex) => (
            <section
              className="qr-print-page"
              key={pageIndex}
              aria-label={`Printable page ${pageIndex + 1} of ${pages.length}`}
            >
              {page.map((code) => (
                <article className="qr-print-card" key={code.tableNumber}>
                  <div
                    className="qr-print-code"
                    role="img"
                    aria-label={`Check-in QR code for Table ${code.tableNumber}`}
                    dangerouslySetInnerHTML={{ __html: code.svg }}
                  />
                  <h2>Table {code.tableNumber}</h2>
                  <p>Scan to check in and keep score</p>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : null}

      <QrPrintStyles />
    </main>
  )
}

function QrPrintStyles() {
  return (
    <style jsx global>{`
      .qr-print-root{min-height:100dvh;padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));background:#e8e5d8}
      .qr-print-toolbar{position:sticky;top:max(8px,env(safe-area-inset-top));z-index:3;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;max-width:8.5in;margin:0 auto 18px;border:1px solid #c9c3ad;border-radius:8px;background:#fff;padding:10px 12px;color:#111;box-shadow:0 8px 28px #0002}
      .qr-print-toolbar h1{margin:0;overflow:hidden;color:#111;font:900 clamp(15px,3.5vw,18px)/1.2 system-ui;text-align:center;text-overflow:ellipsis;white-space:nowrap}
      .qr-print-toolbar button,.qr-print-error button{min-height:44px;border:1px solid #777;border-radius:6px;background:#fff;color:#111;padding:0 16px;font-weight:800}
      .qr-print-toolbar button:disabled{cursor:not-allowed;opacity:.45}
      .qr-print-preview{display:grid;gap:20px}
      .qr-print-page{box-sizing:border-box;display:grid;width:min(100%,8.5in);grid-template-columns:repeat(2,minmax(0,1fr));margin:0 auto;padding:clamp(14px,3.5vw,.35in);background:#fff;color:#000;box-shadow:0 8px 30px #0002}
      .qr-print-card{display:flex;min-width:0;aspect-ratio:1/1.22;flex-direction:column;align-items:center;justify-content:center;border:1px dashed #000;background:#fff;color:#000;padding:clamp(10px,2.5vw,.2in);text-align:center}
      .qr-print-code{width:min(72%,2.75in);aspect-ratio:1;background:#fff}
      .qr-print-code svg{display:block;width:100%;height:100%}
      .qr-print-card h2{margin:.12in 0 0;color:#000;font:900 clamp(20px,4vw,32px)/1.1 system-ui}
      .qr-print-card p{margin:.08in 0 0;color:#000;font:600 clamp(11px,2.2vw,14px)/1.3 system-ui}
      .qr-print-error,.qr-print-loading{max-width:8.5in;margin:40px auto;background:#fff;color:#111;padding:30px;text-align:center;font-weight:800}
      .qr-print-error{border:1px solid #c9c3ad;border-radius:8px}
      .qr-print-error p{margin:0}
      .qr-print-error button{margin-top:16px}
      html.dark .qr-print-root{background:#06120e}
      html.dark .qr-print-toolbar{border-color:#355047;background:#10231c;color:#f4f0df}
      html.dark .qr-print-toolbar h1{color:#f4f0df}
      html.dark .qr-print-toolbar button{border-color:#587067;background:#07140f;color:#f4f0df}
      html.dark .qr-print-error,html.dark .qr-print-loading{border-color:#355047;background:#10231c;color:#f4f0df}
      html.dark .qr-print-error button{border-color:#587067;background:#07140f;color:#f4f0df}
      @media(max-width:560px){
        .qr-print-root{padding-inline:12px}
        .qr-print-toolbar{top:max(6px,env(safe-area-inset-top));gap:8px;margin-bottom:12px;padding:8px}
        .qr-print-toolbar button{padding-inline:12px}
        .qr-print-page{grid-template-columns:1fr;gap:10px;padding:10px;border-radius:8px}
        .qr-print-card{min-height:min(108vw,430px);aspect-ratio:auto;border-style:solid;border-color:#d8d8d8;border-radius:6px}
        .qr-print-code{width:min(68vw,280px)}
        .qr-print-card h2{font-size:26px}
        .qr-print-card p{font-size:13px}
      }
      @media print{
        @page{size:Letter portrait;margin:0}
        .club-header,.qr-print-toolbar,.qr-print-error,.qr-print-loading{display:none!important}
        .qr-print-root{min-height:0;padding:0!important;background:#fff!important}
        .qr-print-preview{display:block}
        .qr-print-page{width:8.5in;height:11in;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:0;margin:0;padding:.35in;border-radius:0;box-shadow:none;background:#fff!important;color:#000!important;filter:grayscale(1);break-after:page;page-break-after:always}
        .qr-print-card{min-height:0;aspect-ratio:auto;border:1px dashed #000!important;border-radius:0;background:#fff!important;color:#000!important;padding:.2in}
        .qr-print-code{width:2.75in;height:2.75in;background:#fff!important}
        .qr-print-card h2{margin:.12in 0 0;color:#000!important;font:900 24pt/1.1 system-ui}
        .qr-print-card p{margin:.08in 0 0;color:#000!important;font:600 10pt/1.2 system-ui}
        .qr-print-page:last-child{break-after:auto;page-break-after:auto}
      }
    `}</style>
  )
}
