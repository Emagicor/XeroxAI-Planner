export default function SectionHeader({ eyebrow, title, subtitle, action, className = '' }) {
  return (
    <div className={`mb-6 ${className}`}>
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent mb-2">
          {eyebrow}
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          {title && (
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  )
}
