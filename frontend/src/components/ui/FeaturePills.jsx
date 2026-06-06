export default function FeaturePills({ items }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-line/60 bg-surface/40 backdrop-blur-sm"
        >
          <span className="font-mono text-sm font-semibold text-accent">{item.value}</span>
          <span className="text-xs text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
