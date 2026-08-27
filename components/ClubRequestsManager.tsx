'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { updateClubJoinApproval } from '@/lib/data'
import type { ClubDoc, JoinRequestDoc } from '@/lib/types'
import { useModalFocus } from '@/lib/use-modal-focus'

type ClubRequestsManagerProps = {
  open: boolean
  club: ClubDoc
  requests: JoinRequestDoc[]
  resolvingUid: string | null
  notice: { message: string; error: boolean } | null
  onClose: () => void
  onResolve: (request: JoinRequestDoc, approved: boolean) => void
}

export default function ClubRequestsManager({
  open,
  club,
  requests,
  resolvingUid,
  notice,
  onClose,
  onResolve,
}: ClubRequestsManagerProps) {
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [optimisticApprovalRequired, setOptimisticApprovalRequired] = useState<boolean | null>(null)
  const [policyNotice, setPolicyNotice] = useState<{ message: string; error: boolean } | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const getInitialFocus = useCallback(() => closeRef.current, [])

  useModalFocus({
    open,
    layerRef,
    dialogRef,
    getInitialFocus,
    onEscape: onClose,
    escapeDisabled: savingPolicy || resolvingUid !== null,
  })

  const approvalRequired = optimisticApprovalRequired ?? club.joinApprovalRequired

  useEffect(() => {
    if (optimisticApprovalRequired === club.joinApprovalRequired) {
      setOptimisticApprovalRequired(null)
    }
  }, [club.joinApprovalRequired, optimisticApprovalRequired])

  const changeApprovalPolicy = async () => {
    if (savingPolicy) return
    const nextValue = !approvalRequired
    setOptimisticApprovalRequired(nextValue)
    setSavingPolicy(true)
    setPolicyNotice({ message: 'Saving join policy…', error: false })
    try {
      await updateClubJoinApproval(club.id, nextValue)
      setPolicyNotice({
        message: nextValue
          ? 'Manager approval is now required.'
          : requests.length
            ? 'Instant joining is on. Pending requests were admitted.'
            : 'Anyone with the club ID can now join instantly.',
        error: false,
      })
    } catch (error) {
      setOptimisticApprovalRequired(null)
      setPolicyNotice({
        message: error instanceof Error ? error.message : 'Unable to update the join policy.',
        error: true,
      })
    } finally {
      setSavingPolicy(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div ref={layerRef} className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div ref={dialogRef} id="club-requests-dialog" role="dialog" aria-modal="true" aria-labelledby="club-requests-title" tabIndex={-1} className="responsive-modal-panel flex max-h-[calc(100dvh-3rem)] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[rgb(var(--bamboo))]">Club access</p>
              <h3 id="club-requests-title" className="mt-2 text-xl font-black text-slate-950">Join requests</h3>
              <p className="mt-1 text-sm text-slate-500">Choose how people join {club.name} and review pending requests.</p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} disabled={savingPolicy || resolvingUid !== null} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50">Close</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4" aria-labelledby="join-policy-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h4 id="join-policy-title" className="font-black text-slate-950">Require manager approval</h4>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {approvalRequired
                    ? 'People with the club ID must be accepted before they become members.'
                    : 'Any signed-in person with the club ID becomes a member immediately.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={approvalRequired}
                aria-label="Require manager approval"
                disabled={savingPolicy}
                onClick={() => void changeApprovalPolicy()}
                className={`join-approval-switch${approvalRequired ? ' is-on' : ''}`}
              >
                <span aria-hidden="true" />
                <strong>{savingPolicy ? 'Saving…' : approvalRequired ? 'On' : 'Off'}</strong>
              </button>
            </div>
            {policyNotice ? <p role={policyNotice.error ? 'alert' : 'status'} aria-live={policyNotice.error ? 'assertive' : 'polite'} className={`mt-3 text-sm font-bold ${policyNotice.error ? 'text-rose-700' : 'text-emerald-700'}`}>{policyNotice.message}</p> : null}
          </section>

          <section aria-labelledby="pending-requests-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Pending</p>
                <h4 id="pending-requests-title" className="mt-1 text-lg font-black text-slate-950">Member requests</h4>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">{requests.length} pending</span>
            </div>

            {notice ? <div role={notice.error ? 'alert' : 'status'} aria-live={notice.error ? 'assertive' : 'polite'} className={`mt-4 rounded-lg border px-4 py-3 text-sm font-bold ${notice.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.message}</div> : null}

            {requests.length ? (
              <div className="mt-4 space-y-3">
                {requests.map((request) => {
                  const resolving = resolvingUid === request.uid
                  return (
                    <article key={request.uid} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-bold text-slate-950">{request.displayName ?? request.email ?? 'Unknown user'}</p>
                        {request.email ? <p className="mt-1 break-all text-sm text-slate-500">{request.email}</p> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button type="button" onClick={() => onResolve(request, false)} disabled={resolvingUid !== null} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-50">{resolving ? 'Working…' : 'Deny'}</button>
                        <button type="button" onClick={() => onResolve(request, true)} disabled={resolvingUid !== null} className="min-h-10 rounded-lg bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white disabled:opacity-50">{resolving ? 'Working…' : 'Accept'}</button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="font-black text-slate-800">No pending requests</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">New approval-required joins will appear here automatically.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
