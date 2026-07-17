'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadCalibration, removeCalibration, saveCalibration } from '@/lib/coach-vision/calibration-store'
import { rectFromPoints, type CalibrationProfile, type NormalizedPoint, type NormalizedRect } from '@/lib/coach-vision/regions'

const STEPS = [
  'Tap the top-left table corner', 'Tap the top-right table corner',
  'Tap the bottom-right table corner', 'Tap the bottom-left table corner',
  'Tap one corner of your hand area', 'Tap the opposite corner of your hand area',
  'Tap one corner of the discard area', 'Tap the opposite corner of the discard area',
]

function Region({ rect, label, tone }: { rect: NormalizedRect; label: string; tone: string }) {
  return <div className={`pointer-events-none absolute border-2 ${tone}`} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}><span className="absolute left-0 top-0 rounded-br bg-black/75 px-1.5 py-1 text-[10px] font-black uppercase text-white">{label}</span></div>
}

export default function CameraPreview({ clubId }: { clubId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const hiddenTimerRef = useRef<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<NormalizedPoint[]>([])
  const [calibrating, setCalibrating] = useState(false)
  const [calibration, setCalibration] = useState<CalibrationProfile | null>(null)

  useEffect(() => setCalibration(loadCalibration(clubId)), [clubId])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && streamRef.current) hiddenTimerRef.current = window.setTimeout(stopCamera, 15_000)
      else if (hiddenTimerRef.current !== null) { window.clearTimeout(hiddenTimerRef.current); hiddenTimerRef.current = null }
    }
    const onPageHide = () => stopCamera()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      if (hiddenTimerRef.current !== null) window.clearTimeout(hiddenTimerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [stopCamera])

  const startCamera = async () => {
    setStatus('starting'); setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not provide camera capture.')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('live')
    } catch (nextError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStatus('error')
      setError(nextError instanceof Error ? nextError.message : 'Camera access failed.')
    }
  }

  const tapFrame = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!calibrating || points.length >= STEPS.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const next = [...points, { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }]
    setPoints(next)
    if (next.length === 8) {
      const track = streamRef.current?.getVideoTracks()[0]
      const profile: CalibrationProfile = {
        v: 1,
        clubId,
        cameraDeviceId: track?.getSettings().deviceId,
        orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
        tableCorners: [next[0], next[1], next[2], next[3]],
        handRegion: rectFromPoints(next[4], next[5]),
        discardRegion: rectFromPoints(next[6], next[7]),
        savedAt: new Date().toISOString(),
      }
      try { saveCalibration(profile); setCalibration(profile); setCalibrating(false) }
      catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Calibration is invalid.'); setPoints([]) }
    }
  }

  const beginCalibration = () => { setPoints([]); setError(null); setCalibrating(true) }
  const clearCalibration = () => { removeCalibration(clubId); setCalibration(null); setPoints([]); setCalibrating(false) }

  return (
    <section className="rounded-2xl border border-emerald-200/20 bg-emerald-950/55 p-3 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">On-device camera</p><p className="mt-1 text-sm text-emerald-50/65">No recording or uploads</p></div>
        <div className="flex gap-2">
          {status !== 'live' ? <button type="button" onClick={startCamera} disabled={status === 'starting'} className="rounded-lg bg-emerald-300 px-3 py-2 text-sm font-black text-emerald-950 disabled:opacity-50">{status === 'starting' ? 'Starting…' : 'Start camera'}</button> : <button type="button" onClick={stopCamera} className="rounded-lg border border-emerald-200/25 px-3 py-2 text-sm font-bold">Stop</button>}
        </div>
      </div>

      <div onPointerDown={tapFrame} className="relative aspect-video overflow-hidden rounded-xl bg-black touch-none">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {status !== 'live' ? <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-bold text-stone-300">Mount the phone in landscape behind your tiles, then start the rear camera.</div> : null}
        {calibration ? <><Region rect={calibration.handRegion} label="My hand" tone="border-emerald-300" /><Region rect={calibration.discardRegion} label="Discards" tone="border-amber-300" /></> : null}
        {points.map((point, index) => <span key={index} className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />)}
        {calibrating ? <div className="pointer-events-none absolute inset-x-2 top-2 rounded-lg bg-black/80 px-3 py-2 text-center text-sm font-black text-white">{STEPS[points.length]}</div> : null}
      </div>

      {error ? <p role="alert" className="mt-3 rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-100">{error}</p> : null}
      {status === 'live' ? <div className="mt-3 flex flex-wrap gap-2">{!calibrating ? <button type="button" onClick={beginCalibration} className="rounded-lg border border-emerald-200/25 px-3 py-2 text-sm font-bold">{calibration ? 'Recalibrate' : 'Calibrate regions'}</button> : <button type="button" onClick={() => { setCalibrating(false); setPoints([]) }} className="rounded-lg border border-rose-300/30 px-3 py-2 text-sm font-bold text-rose-100">Cancel</button>}{calibration ? <button type="button" onClick={clearCalibration} className="rounded-lg px-3 py-2 text-sm font-bold text-emerald-100/65">Forget calibration</button> : null}</div> : null}
      {calibration ? <p className="mt-3 text-xs font-semibold text-emerald-100/55">Calibrated locally {new Date(calibration.savedAt).toLocaleString()}. Recognition remains disabled until a validated tile model is installed.</p> : null}
    </section>
  )
}

