export default function SectionHeader({ eyebrow, title, subtitle, action, className = '' }) {
  return (
    <div className={`mb-8 ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          {title && (
            <h2 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-text leading-tight">
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
