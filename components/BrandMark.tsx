import type { SVGProps } from 'react'

export function RedDragonMark({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`red-dragon-mark ${className}`.trim()}
      {...props}
    >
      <path
        d="M16 3v26M6 8h20v16H6z"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="square"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function BrandLockup({
  className = '',
  showDescriptor = false,
}: {
  className?: string
  showDescriptor?: boolean
}) {
  return (
    <span className={`brand-lockup ${className}`.trim()}>
      <RedDragonMark />
      <span className="brand-lockup-copy">
        <span className="brand-wordmark">Mahjong Messiah</span>
        {showDescriptor ? <span className="brand-descriptor">Score Tracker</span> : null}
      </span>
    </span>
  )
}
