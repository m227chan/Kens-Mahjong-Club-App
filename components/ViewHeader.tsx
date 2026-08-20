import type { ReactNode } from 'react'

export default function ViewHeader({
  title,
  action,
  className = '',
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={`view-header${className ? ` ${className}` : ''}`}>
      <div className="view-header-copy">
        <h2 className="view-header-title">{title}</h2>
      </div>
      {action ? <div className="view-header-action-slot">{action}</div> : null}
    </header>
  )
}
