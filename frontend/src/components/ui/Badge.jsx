const VARIANTS = {
  default: 'border-line/60 bg-surface/60 text-muted',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/30 bg-red-500/10 text-red-300',
  live: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
}

export default function Badge({ children, variant = 'default', dot = false, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
        VARIANTS[variant] ?? VARIANTS.default,
        className,
      ].join(' ')}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  )
}
