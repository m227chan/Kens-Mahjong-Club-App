'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { tableAction, type TablePlayer, type TableSession } from '@/lib/table-checkin-client'

type Exchange = { clubId: string; clubName: string; tableNumber: number; enrollmentStatus?: 'required' | 'pending'; linkedPlayer: TablePlayer | null; players: TablePlayer[]; unlinkedPlayers: TablePlayer[] }
type CheckIn = { status: 'ok'; session: TableSession } | { status: 'table_full'; occupants: string[]; session: TableSession }

export default function TableCheckInPage() {
  const { publicId = '' } = useParams<{ publicId: string }>()
  const router = useRouter()
  const { user, loading, signingIn, authError, signInWithGoogle } = useAuth()
  const [signature, setSignature] = useState('')
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🀄')
  const [fullTable, setFullTable] = useState<string[] | null>(null)
  const exchangeAttemptKey = useRef('')

  useEffect(() => {
    const key = `mahjong:table-qr:${publicId}`
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('k') ?? ''
    const saved = fromHash || window.sessionStorage.getItem(key) || ''
    if (saved) window.sessionStorage.setItem(key, saved)
    setSignature(saved)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [publicId])

  const finishCheckIn = async (details: Exchange, replacePlayerId?: string) => {
    const result = await tableAction<CheckIn>({ action: 'checkIn', clubId: details.clubId, tableNumber: details.tableNumber, replacePlayerId })
    if (result.status === 'table_full') { setFullTable(result.occupants); return }
    window.sessionStorage.removeItem(`mahjong:table-qr:${publicId}`)
    router.replace(`/club/${encodeURIComponent(details.clubId)}/table/${details.tableNumber}`)
  }

  useEffect(() => {
    if (loading || !user || !signature || exchange || busy) return
    const attemptKey = `${user.uid}:${publicId}:${signature}`
    if (exchangeAttemptKey.current === attemptKey) return
    exchangeAttemptKey.current = attemptKey
    setBusy(true); setError(null)
    void tableAction<Exchange>({ action: 'exchange', publicId, signature }).then(async (result) => {
      setExchange(result)
      setNewName(user.displayName ?? '')
      if (result.linkedPlayer) await finishCheckIn(result)
    }).catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Unable to check in.')).finally(() => setBusy(false))
  // finishCheckIn intentionally uses current route state only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, exchange, loading, publicId, signature, user])

  const filtered = useMemo(() => exchange?.unlinkedPlayers.filter((player) => player.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [], [exchange, search])
  const resolvePlayer = async (kind: 'link' | 'create', playerId?: string) => {
    if (!exchange) return
    setBusy(true); setError(null)
    try {
      if (kind === 'link') await tableAction({ action: 'linkSelf', clubId: exchange.clubId, playerId })
      else await tableAction({ action: 'createSelf', clubId: exchange.clubId, displayName: newName, icon: newIcon })
      await finishCheckIn(exchange)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to finish player setup.') }
    finally { setBusy(false) }
  }

  const requestEnrollment = async () => {
    if (!exchange || !user) return
    setBusy(true); setError(null)
    try {
      const result = await tableAction<{ enrollmentStatus: 'pending' | 'member' | 'retry' }>({ action: 'requestEnrollment', publicId, signature })
      if (result.enrollmentStatus === 'member' || result.enrollmentStatus === 'retry') {
        exchangeAttemptKey.current = ''
        setExchange(null)
        return
      }
      setExchange((current) => current ? { ...current, enrollmentStatus: 'pending' } : current)
      const token = await user.getIdToken()
      void fetch('/api/send-join-request-email', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ clubId: exchange.clubId, appUrl: window.location.origin })
      }).catch(() => undefined)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to request club access.')
    } finally {
      setBusy(false)
    }
  }

  const occupants = fullTable?.map((id) => exchange?.players.find((player) => player.id === id)).filter((player): player is TablePlayer => Boolean(player)) ?? []

  return <main className="mx-auto flex min-h-[calc(100dvh-90px)] max-w-lg items-center px-4 py-8">
    <section className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[.18em] text-[rgb(var(--bamboo))]">Table check-in</p>
      <h1 className="mt-2 text-2xl font-black text-slate-950">{exchange ? `${exchange.clubName} · Table ${exchange.tableNumber}` : 'Your table is waiting'}</h1>
      {!signature ? <p className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">This QR link is incomplete. Scan the printed table code again.</p> : null}
      {!loading && !user ? <div className="mt-5"><p className="text-sm text-slate-600">Sign in once so your games stay connected to your roster player.</p><button type="button" disabled={signingIn} onClick={() => void signInWithGoogle()} className="mt-4 min-h-12 w-full rounded-lg bg-[rgb(var(--bamboo))] px-4 font-black text-white">{signingIn ? 'Opening Google…' : 'Continue with Google'}</button></div> : null}
      {(loading || busy) ? <div className="mt-6 rounded-lg bg-slate-50 p-5 text-center text-sm font-bold text-slate-600">Preparing your table…</div> : null}
      {error || authError ? <p role="alert" className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error ?? authError}</p> : null}

      {exchange?.enrollmentStatus && !busy ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900"><h2 className="text-lg font-black">{exchange.enrollmentStatus === 'pending' ? 'Waiting for manager approval' : `Request to join ${exchange.clubName}`}</h2><p className="mt-2 text-sm text-slate-700">{exchange.enrollmentStatus === 'pending' ? 'Your request has been sent. Once a manager approves it, come back here to continue linking your roster player and join the table.' : 'This club requires a manager to approve new members before a table QR can check them in.'}</p>{exchange.enrollmentStatus === 'required' ? <button type="button" onClick={() => void requestEnrollment()} className="mt-4 min-h-12 w-full rounded-lg bg-[rgb(var(--bamboo))] px-4 font-black text-white">Request to join club</button> : <button type="button" onClick={() => { exchangeAttemptKey.current = ''; setExchange(null) }} className="mt-4 min-h-12 w-full rounded-lg border border-amber-300 bg-white px-4 font-black text-slate-900">Check approval again</button>}</div> : null}

      {exchange && !exchange.enrollmentStatus && !exchange.linkedPlayer && !fullTable && !busy ? <div className="mt-5 space-y-5">
        <div><h2 className="text-lg font-black text-slate-900">Who are you?</h2><p className="mt-1 text-sm text-slate-600">Link your account to an existing roster player, or create yourself once.</p></div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the roster…" className="min-h-12 w-full rounded-lg border border-slate-300 px-3" />
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {filtered.map((player) => <button key={player.id} type="button" onClick={() => window.confirm(`Link your account to ${player.displayName}?`) && void resolvePlayer('link', player.id)} className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-slate-200 px-3 text-left font-bold"><span className="text-xl">{player.icon}</span><span>{player.displayName}</span></button>)}
        </div>
        <div className="border-t border-slate-200 pt-4"><p className="text-sm font-black text-slate-800">Not on the roster?</p><div className="mt-2 grid grid-cols-[64px_1fr] gap-2"><input aria-label="Player emoji" value={newIcon} onChange={(event) => setNewIcon(event.target.value.slice(0, 12))} className="min-h-12 rounded-lg border border-slate-300 px-2 text-center text-xl"/><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Your player name" className="min-h-12 rounded-lg border border-slate-300 px-3" /></div><button type="button" onClick={() => void resolvePlayer('create')} className="mt-3 min-h-12 w-full rounded-lg bg-[rgb(var(--bamboo))] px-4 font-black text-white">Create me as a player</button></div>
      </div> : null}

      {fullTable ? <div className="mt-5"><h2 className="text-lg font-black">Table {exchange?.tableNumber} is full</h2><p className="mt-1 text-sm text-slate-600">Choose someone to move to the sideline. You will take their seat.</p><div className="mt-4 grid grid-cols-2 gap-2">{occupants.map((player) => <button key={player.id} type="button" disabled={busy} onClick={() => exchange && void finishCheckIn(exchange, player.id)} className="min-h-20 rounded-lg border border-slate-300 p-3 font-bold"><span className="block text-2xl">{player.icon}</span>{player.displayName}</button>)}</div></div> : null}
    </section>
  </main>
}
