'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const tiles = [
  ['中',7,14,64,.2,.82],['發',25,7,48,1.4,1.08],['萬',45,17,58,2.6,.91],
  ['●',68,9,46,3.1,1.16],['竹',88,19,62,4.4,.76],['三',12,61,44,5.2,1.18],
  ['九',30,78,60,.8,.88],['南',53,69,50,2.1,1.04],['北',75,83,66,3.7,.8],['東',92,64,46,4.9,1.12],
] as const

function FloatingTiles() {
  const field = useRef<HTMLDivElement>(null)
  const nodes = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    if (!field.current) return

    let bounds = field.current.getBoundingClientRect()
    let frame = 0
    const pointer = { x: -1000, y: -1000, active: false }
    const motion = tiles.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }))
    const resize = () => { if (field.current) bounds = field.current.getBoundingClientRect() }
    const move = (event: PointerEvent) => {
      pointer.x = event.clientX - bounds.left
      pointer.y = event.clientY - bounds.top
      pointer.active = true
    }
    const leave = () => { pointer.active = false }

    const tick = () => {
      tiles.forEach((tile, index) => {
        const node = nodes.current[index]
        if (!node) return
        const [, x, y] = tile
        const state = motion[index]
        const dx = bounds.width * x / 100 + state.x - pointer.x
        const dy = bounds.height * y / 100 + state.y - pointer.y
        const distance = Math.hypot(dx, dy)

        if (pointer.active && distance < 135 && distance > 0.1) {
          const force = (1 - distance / 135) * 1.7
          state.vx += dx / distance * force
          state.vy += dy / distance * force
        }

        state.vx = (-state.x * 0.005 + state.vx) * 0.93
        state.vy = (-state.y * 0.005 + state.vy) * 0.93
        state.x += state.vx
        state.y += state.vy
        node.style.transform = 'translate3d(' + state.x + 'px,' + state.y + 'px,0)'
      })
      frame = requestAnimationFrame(tick)
    }

    addEventListener('resize', resize)
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointercancel', leave)
    document.addEventListener('mouseleave', leave)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
      removeEventListener('pointermove', move)
      removeEventListener('pointercancel', leave)
      document.removeEventListener('mouseleave', leave)
    }
  }, [])

  return (
    <div ref={field} className="login-tile-field" aria-hidden="true">
      {tiles.map(([glyph, x, y, size], index) => {
        const duration = 18 + (index * 7) % 13
        const driftX = 70 + (index * 37) % 130
        const driftY = 55 + (index * 29) % 105
        return (
          <div
            key={index}
            ref={node => { nodes.current[index] = node }}
            className="login-tile-anchor"
            style={{
              left: x + '%',
              top: y + '%',
              '--tile-size': size + 'px',
              '--tile-duration': duration + 's',
              '--tile-delay': -(index * 2.35) + 's',
              '--drift-x': (index % 2 ? -driftX : driftX) + 'px',
              '--drift-y': (index % 3 ? driftY : -driftY) + 'px',
              '--return-x': (index % 2 ? driftX * 0.55 : -driftX * 0.55) + 'px',
              '--return-y': (index % 3 ? -driftY * 0.7 : driftY * 0.7) + 'px',
              '--tile-rotation': (index % 2 ? 14 : -14) + 'deg',
            } as CSSProperties}
          >
            <div className="login-animated-tile">
              <span className={glyph === '中' ? 'tile-red' : glyph === '發' || glyph === '竹' ? 'tile-green' : ''}>{glyph}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LoginPage(){
  const router=useRouter()
  const {user,loading,signingIn,authError,signInWithGoogle}=useAuth()
  const [localError,setLocalError]=useState<string|null>(null)
  useEffect(()=>{if(!loading&&user)router.replace('/')},[loading,router,user])
  const handleSignIn=async()=>{
    setLocalError(null)
    try{await signInWithGoogle()}catch(error){setLocalError(error instanceof Error?error.message:'Unable to sign in with Google. Please try again.')}
  }
  return <main className="login-welcome">
    <FloatingTiles/>
    <div className="login-welcome-grid">
      <section className="login-intro" aria-labelledby="login-title">
        <p className="login-eyebrow"><span>🀄</span> Ken&apos;s Mahjong Club</p>
        <h1 id="login-title">Every game, every rivalry, every rating—remembered.</h1>
        <p className="login-lede">A shared scorebook for the people you play with. Run sessions, record results, and see the standings take shape over time.</p>
        <ul className="login-feature-list" aria-label="Score tracker features">
          <li><span>01</span><div><strong>Run the table</strong><p>Organize players and record each result while the session is live.</p></div></li>
          <li><span>02</span><div><strong>Follow every rivalry</strong><p>Keep game history, points, and ELO standings together.</p></div></li>
          <li><span>03</span><div><strong>Bring every club</strong><p>Switch between your Mahjong groups from one personal dashboard.</p></div></li>
        </ul>
      </section>
      <section className="login-card" aria-label="Sign in">
        <div className="login-card-mark" aria-hidden="true">中</div>
        <p className="login-card-kicker">Your table is waiting</p>
        <h2>Welcome back</h2>
        <p className="login-card-copy">Sign in to open your clubs and pick up where the last game ended.</p>
        <button type="button" onClick={handleSignIn} disabled={loading||signingIn} className="login-google-button">
          <span className="google-mark" aria-hidden="true">G</span>
          {loading?'Checking sign-in status…':signingIn?'Opening Google sign-in…':'Continue with Google'}
        </button>
        {(localError??authError)&&<p className="login-error" role="alert">{localError??authError}</p>}
        <p className="login-privacy">Your results stay connected to your account so they&apos;re ready on any device.</p>
      </section>
    </div>
  </main>
}