'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import { BrandLockup, RedDragonMark } from '@/components/BrandMark'
import {
  stepTilePhysics,
  type TilePhysicsBody,
  type TilePhysicsBounds,
} from '@/lib/login-tile-physics'

type TileDefinition = {
  name: string
  x: number
  y: number
  size: number
  vx: number
  vy: number
} & (
  | { kind: 'honor'; glyph: string; color: string }
  | { kind: 'character'; rankGlyph: string }
  | { kind: 'bamboo'; rank: 3 | 6 }
  | { kind: 'circle'; rank: 2 | 5 }
)

const tiles: readonly TileDefinition[] = [
  { kind: 'honor', glyph: '中', color: '#c9362b', name: 'Red dragon', x: 8, y: 15, size: 64, vx: 28, vy: 17 },
  { kind: 'honor', glyph: '發', color: '#13734f', name: 'Green dragon', x: 24, y: 8, size: 52, vx: -22, vy: 25 },
  { kind: 'honor', glyph: '東', color: '#1f568c', name: 'East wind', x: 43, y: 18, size: 58, vx: 19, vy: -24 },
  { kind: 'honor', glyph: '南', color: '#1f568c', name: 'South wind', x: 69, y: 10, size: 50, vx: -27, vy: 18 },
  { kind: 'character', rankGlyph: '一', name: 'One of characters', x: 88, y: 20, size: 62, vx: -31, vy: -16 },
  { kind: 'character', rankGlyph: '五', name: 'Five of characters', x: 11, y: 62, size: 50, vx: 25, vy: -21 },
  { kind: 'bamboo', rank: 3, name: 'Three of bamboo', x: 31, y: 80, size: 60, vx: 23, vy: 19 },
  { kind: 'bamboo', rank: 6, name: 'Six of bamboo', x: 53, y: 70, size: 54, vx: -20, vy: -27 },
  { kind: 'circle', rank: 2, name: 'Two of circles', x: 76, y: 84, size: 66, vx: 29, vy: -18 },
  { kind: 'circle', rank: 5, name: 'Five of circles', x: 91, y: 65, size: 52, vx: -25, vy: 23 },
]

const bambooLayouts = {
  3: [[32, 14], [21, 43], [43, 43]],
  6: [[21, 13], [43, 13], [21, 34], [43, 34], [21, 55], [43, 55]],
} as const

const circleLayouts = {
  2: [[22, 22], [42, 50]],
  5: [[18, 16], [46, 16], [32, 36], [18, 56], [46, 56]],
} as const

function MahjongTileSymbol({ tile }: { tile: TileDefinition }) {
  if (tile.kind === 'honor') {
    return <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true"><text x="32" y="52" textAnchor="middle" fill={tile.color} className="mahjong-honor-glyph">{tile.glyph}</text></svg>
  }
  if (tile.kind === 'character') {
    return <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true"><text x="32" y="32" textAnchor="middle" fill="#1f568c" className="mahjong-character-rank">{tile.rankGlyph}</text><text x="32" y="59" textAnchor="middle" fill="#c9362b" className="mahjong-character-suit">萬</text></svg>
  }
  if (tile.kind === 'bamboo') {
    return <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">{bambooLayouts[tile.rank].map(([x, y], index) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}><rect x="-2.6" y="-8" width="5.2" height="16" rx="2.6" fill={index % 3 === 1 ? '#1f568c' : '#13734f'} /><path d="M0-3L-7-8M0-1L7-6M0 3L-7 8M0 2L7 7" stroke={index % 3 === 2 ? '#c9362b' : '#13734f'} strokeWidth="2" strokeLinecap="round" /></g>)}</svg>
  }
  return <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">{circleLayouts[tile.rank].map(([x, y], index) => { const color = ['#1f568c', '#c9362b', '#13734f'][index % 3]; return <g key={`${x}-${y}`}><circle cx={x} cy={y} r="8" fill="none" stroke={color} strokeWidth="3" /><circle cx={x} cy={y} r="3.25" fill={color} /></g> })}</svg>
}

type ActiveTileDrag = {
  index: number
  pointerId: number
  offsetX: number
  offsetY: number
  x: number
  y: number
  vx: number
  vy: number
  lastX: number
  lastY: number
  lastTime: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

function FloatingTiles() {
  const { play } = useSound()
  const field = useRef<HTMLDivElement>(null)
  const nodes = useRef<Array<HTMLDivElement | null>>([])
  const bodies = useRef<TilePhysicsBody[]>([])
  const bounds = useRef<TilePhysicsBounds>({ width: 0, height: 0 })
  const rotations = useRef<number[]>(tiles.map((_, index) => (index % 2 ? 7 : -7)))
  const spins = useRef<number[]>(tiles.map((_, index) => (index % 2 ? 5 : -5)))
  const activeDrag = useRef<ActiveTileDrag | null>(null)
  const lastClack = useRef(0)
  const [grabbedIndex, setGrabbedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!field.current) return

    let frame = 0
    let previousTime = 0
    const previousRootCursor = document.documentElement.style.cursor
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const deviceHints = navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }
    const lowPowerDevice =
      (navigator.hardwareConcurrency || 4) <= 4 ||
      (deviceHints.deviceMemory !== undefined && deviceHints.deviceMemory <= 4) ||
      deviceHints.connection?.saveData === true
    const targetFrameMilliseconds = 1000 / (lowPowerDevice ? 24 : 30)
    const minimumDriftSpeed = lowPowerDevice ? 11 : 14
    bodies.current = []

    const paint = () => {
      bodies.current.forEach((body, index) => {
        const node = nodes.current[index]
        if (!node) return
        const tile = tiles[index]
        const top = body.y - tile.size * .59
        const left = body.x - tile.size / 2
        node.style.left = '0'
        node.style.top = '0'
        node.style.transform = `translate3d(${left}px,${top}px,0) rotate(${rotations.current[index]}deg)`
      })
    }

    const resize = () => {
      if (!field.current) return
      const rect = field.current.getBoundingClientRect()
      const previousBounds = bounds.current
      const nextBounds = { width: rect.width, height: rect.height }
      if (bodies.current.length === 0) {
        bodies.current = tiles.map((tile) => {
          const radius = tile.size * .59
          return {
            x: clamp(nextBounds.width * tile.x / 100, radius, nextBounds.width - radius),
            y: clamp(nextBounds.height * tile.y / 100, radius, nextBounds.height - radius),
            vx: tile.vx,
            vy: tile.vy,
            radius,
          }
        })
      } else if (previousBounds.width > 0 && previousBounds.height > 0) {
        bodies.current = bodies.current.map((body) => ({
          ...body,
          x: clamp(body.x * nextBounds.width / previousBounds.width, body.radius, nextBounds.width - body.radius),
          y: clamp(body.y * nextBounds.height / previousBounds.height, body.radius, nextBounds.height - body.radius),
        }))
      }
      bounds.current = nextBounds
      paint()
    }

    const pointFromEvent = (event: PointerEvent) => {
      const rect = field.current?.getBoundingClientRect()
      return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null
    }

    const isProtectedContent = (event: PointerEvent) => {
      const target = event.target
      return target instanceof Element && Boolean(target.closest('.club-header,.login-intro,.login-card,.login-feature-list,button,a,input,select,textarea'))
    }

    const hitTest = (point: { x: number; y: number }) => {
      let match = -1
      let nearestDistance = Number.POSITIVE_INFINITY
      bodies.current.forEach((body, index) => {
        const distance = Math.hypot(point.x - body.x, point.y - body.y)
        if (distance <= body.radius * 1.08 && distance < nearestDistance) {
          match = index
          nearestDistance = distance
        }
      })
      return match
    }

    const beginPointerDrag = (event: PointerEvent) => {
      if (activeDrag.current || isProtectedContent(event)) return
      const point = pointFromEvent(event)
      if (!point) return
      const index = hitTest(point)
      if (index < 0) return
      const body = bodies.current[index]
      event.preventDefault()
      activeDrag.current = {
        index,
        pointerId: event.pointerId,
        offsetX: point.x - body.x,
        offsetY: point.y - body.y,
        x: body.x,
        y: body.y,
        vx: 0,
        vy: 0,
        lastX: point.x,
        lastY: point.y,
        lastTime: event.timeStamp,
      }
      body.vx = 0
      body.vy = 0
      setGrabbedIndex(index)
      document.documentElement.style.cursor = 'grabbing'
      play('tile')
    }

    const movePointerDrag = (event: PointerEvent) => {
      const drag = activeDrag.current
      const point = pointFromEvent(event)
      if (!point) return
      if (!drag) {
        document.documentElement.style.cursor = !isProtectedContent(event) && hitTest(point) >= 0 ? 'grab' : previousRootCursor
        return
      }
      if (drag.pointerId !== event.pointerId) return
      event.preventDefault()
      const body = bodies.current[drag.index]
      const elapsedSeconds = Math.max((event.timeStamp - drag.lastTime) / 1000, 1 / 240)
      drag.vx = clamp((point.x - drag.lastX) / elapsedSeconds, -1800, 1800)
      drag.vy = clamp((point.y - drag.lastY) / elapsedSeconds, -1800, 1800)
      drag.x = clamp(point.x - drag.offsetX, body.radius, bounds.current.width - body.radius)
      drag.y = clamp(point.y - drag.offsetY, body.radius, bounds.current.height - body.radius)
      drag.lastX = point.x
      drag.lastY = point.y
      drag.lastTime = event.timeStamp
      spins.current[drag.index] = clamp(drag.vx * .025, -36, 36)
    }

    const endPointerDrag = (event: PointerEvent) => {
      const drag = activeDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const body = bodies.current[drag.index]
      if (body) {
        body.vx = drag.vx
        body.vy = drag.vy
      }
      activeDrag.current = null
      setGrabbedIndex(null)
      document.documentElement.style.cursor = previousRootCursor
      play('tile')
    }

    const tick = (time: number) => {
      if (document.hidden) {
        frame = 0
        return
      }
      if (previousTime !== 0 && time - previousTime < targetFrameMilliseconds) {
        frame = requestAnimationFrame(tick)
        return
      }
      const elapsedSeconds = previousTime === 0 ? 0 : Math.max(0, (time - previousTime) / 1000)
      previousTime = time
      const previousBodies = bodies.current
      const drag = activeDrag.current
      const nextBodies = stepTilePhysics(previousBodies, bounds.current, elapsedSeconds, {
        restitution: .9,
        wallRestitution: .82,
        linearDamping: .055,
        collisionPasses: lowPowerDevice ? 1 : 2,
        dragged: drag ? { index: drag.index, x: drag.x, y: drag.y, vx: drag.vx, vy: drag.vy } : null,
      })
      nextBodies.forEach((body, index) => {
        if (drag?.index === index) return
        const speed = Math.hypot(body.vx, body.vy)
        if (speed >= minimumDriftSpeed) return
        const angle = speed > .01 ? Math.atan2(body.vy, body.vx) : index * 2.39996
        body.vx = Math.cos(angle) * minimumDriftSpeed
        body.vy = Math.sin(angle) * minimumDriftSpeed
      })
      const collisionImpulse = nextBodies.some((body, index) => {
        const previous = previousBodies[index]
        return previous && Math.abs(body.vx - previous.vx) + Math.abs(body.vy - previous.vy) > 140
      })
      if (collisionImpulse && time - lastClack.current > 180) {
        lastClack.current = time
        play('tile')
      }
      bodies.current = nextBodies
      nextBodies.forEach((body, index) => {
        spins.current[index] = spins.current[index] * Math.exp(-.5 * elapsedSeconds) + body.vx * .002
        rotations.current[index] += spins.current[index] * elapsedSeconds
      })
      paint()
      frame = requestAnimationFrame(tick)
    }

    const syncPhysics = () => {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        return
      }
      if (!frame) {
        previousTime = 0
        frame = requestAnimationFrame(tick)
      }
    }

    resize()
    if (reducedMotion) return
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    resizeObserver?.observe(field.current)
    addEventListener('resize', resize)
    addEventListener('pointerdown', beginPointerDrag, { capture: true, passive: false })
    addEventListener('pointermove', movePointerDrag, { capture: true, passive: false })
    addEventListener('pointerup', endPointerDrag, { capture: true, passive: true })
    addEventListener('pointercancel', endPointerDrag, { capture: true, passive: true })
    document.addEventListener('visibilitychange', syncPhysics)
    syncPhysics()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      removeEventListener('resize', resize)
      removeEventListener('pointerdown', beginPointerDrag, { capture: true })
      removeEventListener('pointermove', movePointerDrag, { capture: true })
      removeEventListener('pointerup', endPointerDrag, { capture: true })
      removeEventListener('pointercancel', endPointerDrag, { capture: true })
      document.removeEventListener('visibilitychange', syncPhysics)
      document.documentElement.style.cursor = previousRootCursor
    }
  }, [play])

  return (
    <div ref={field} className="login-tile-field" aria-hidden="true">
      {tiles.map((tile, index) => (
        <div
          key={tile.name}
          ref={node => { nodes.current[index] = node }}
          className={`login-tile-anchor${grabbedIndex === index ? ' is-grabbed' : ''}`}
          data-tile-name={tile.name}
          style={{
            '--tile-size': `${tile.size}px`,
            left: `${tile.x}%`,
            top: `${tile.y}%`,
            transform: `translate(-50%,-50%) rotate(${index % 2 ? 7 : -7}deg)`,
          } as CSSProperties}
        >
          <div className="login-animated-tile">
            <MahjongTileSymbol tile={tile} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LoginPage(){
  const router=useRouter()
  const {user,loading,signingIn,authError,signInWithGoogle}=useAuth()
  const {play,unlock}=useSound()
  const [localError,setLocalError]=useState<string|null>(null)
  useEffect(()=>{if(!loading&&user&&!authError)router.replace('/')},[authError,loading,router,user])
  const handleSignIn=async()=>{
    setLocalError(null)
    unlock()
    try{await signInWithGoogle();play('confirmation')}catch(error){play('error');setLocalError(error instanceof Error?error.message:'Unable to sign in with Google. Please try again.')}
  }
  return <main className="login-welcome">
    <FloatingTiles/>
    <div className="login-welcome-grid">
      <section className="login-intro" aria-labelledby="login-title">
        <div className="login-eyebrow"><BrandLockup className="brand-lockup-signature" /></div>
        <h1 id="login-title">
          <span>Mahjong scoring,</span>
          <span className="login-title-accent">simplified.</span>
        </h1>
        <p className="login-lede">A shared scorebook for the people you play with. Run sessions, record results, and see the standings take shape over time.</p>
        <div className="login-proof-row" aria-label="Product highlights">
          <span><i aria-hidden="true" /> Live table scoring</span>
          <span>Offline-safe games</span>
          <span>Custom house rules</span>
        </div>
      </section>
      <section className="login-card" aria-label="Sign in">
        <div className="login-card-heading">
          <div className="login-card-mark" aria-hidden="true"><RedDragonMark /></div>
          <div>
            <p className="login-card-kicker">Your table is waiting</p>
            <h2>Welcome back</h2>
          </div>
        </div>
        <p className="login-card-copy">Sign in to open your clubs and pick up where the last game ended.</p>
        <button type="button" onClick={handleSignIn} disabled={loading||signingIn} className="login-google-button">
          <Image className="google-mark object-contain p-[3px]" src="/google-g.png" alt="" width={25} height={25} aria-hidden="true" />
          {loading?'Checking sign-in status…':signingIn?'Opening Google sign-in…':'Continue with Google'}
        </button>
        {(localError??authError)&&<p className="login-error" role="alert">{localError??authError}</p>}
        <p className="login-privacy">Your results stay connected to your account so they&apos;re ready on any device.</p>
      </section>
      <ul className="login-feature-list" aria-label="Score tracker features">
        <li><span>01</span><div><strong>Run the table</strong><p>Organize players and record each result while the session is live.</p></div></li>
        <li><span>02</span><div><strong>Follow every rivalry</strong><p>Keep game history, points, and experience-aware Skill standings together.</p></div></li>
        <li><span>03</span><div><strong>Bring every club</strong><p>Switch between your Mahjong groups from one personal dashboard.</p></div></li>
      </ul>
    </div>
  </main>
}
