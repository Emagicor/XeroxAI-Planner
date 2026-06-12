const VARIANTS = {
  default: 'border-line bg-surface text-muted',
  accent: 'border-accent/25 bg-accent-subtle text-accent',
  success: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
  danger: 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
  live: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
}

export default function Badge({ children, variant = 'default', dot = false, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        VARIANTS[variant] ?? VARIANTS.default,
        className,
      ].join(' ')}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  )
}
