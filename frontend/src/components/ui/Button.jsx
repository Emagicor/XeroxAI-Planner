const VARIANTS = {
  primary:
    'bg-accent text-white border border-accent/80 hover:brightness-105 active:brightness-95 shadow-sm hover:shadow-md',
  secondary:
    'bg-surface text-text border border-line hover:border-line hover:bg-card active:bg-surface',
  ghost:
    'text-muted border border-transparent hover:text-text hover:bg-text/[0.04]',
  danger:
    'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)] hover:brightness-95',
  success:
    'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)] hover:brightness-95',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-2.5 text-sm rounded-lg',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:brightness-100',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
