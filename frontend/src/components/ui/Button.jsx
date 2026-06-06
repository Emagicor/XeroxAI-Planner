const VARIANTS = {
  primary:
    'bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent/90 hover:shadow-accent/35 border border-accent/50',
  secondary:
    'bg-surface text-text border border-line hover:border-accent/40 hover:bg-card',
  ghost:
    'text-muted border border-transparent hover:text-text hover:bg-text/5',
  danger:
    'bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25',
  success:
    'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-8 py-3.5 text-sm rounded-xl',
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
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
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
