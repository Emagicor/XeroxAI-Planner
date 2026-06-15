export default function Card({ children, className = '', padding = true, glow = false }) {
  return (
    <div
      className={[
        'rounded-xl border border-violet-400 bg-card overflow-hidden',
        glow ? 'shadow-[var(--shadow-md)]' : 'shadow-[var(--shadow-sm)]',
        padding ? '' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, badge, className = '' }) {
  return (
    <div
      className={`px-5 py-4 border-b border-line flex flex-wrap items-start justify-between gap-3 ${className}`}
    >
      <div>
        {title && <p className="text-sm font-semibold text-text">{title}</p>}
        {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {action}
      </div>
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
