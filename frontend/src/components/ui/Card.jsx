export default function Card({ children, className = '', padding = true, glow = false }) {
  return (
    <div
      className={[
        'rounded-2xl border border-line/80 bg-card/90 backdrop-blur-md overflow-hidden',
        glow ? 'shadow-xl shadow-black/20 ring-1 ring-line/5' : '',
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
      className={`px-5 py-4 border-b border-line/60 bg-surface/30 flex flex-wrap items-start justify-between gap-3 ${className}`}
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
