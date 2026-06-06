export default function LoadingIndicator({ steps, currentStep, label }) {
  return (
    <div className="mt-8 text-center">
      <div className="inline-flex items-center gap-2.5 mb-4 px-4 py-2 rounded-xl border border-line/60 bg-surface/40">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-sm shadow-accent/50" />
        <span className="text-text font-semibold text-sm">{steps[currentStep]}</span>
      </div>
      {label && <p className="text-sm text-muted mb-4">{label}</p>}
      <div className="flex justify-center gap-2">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`h-1.5 w-14 rounded-full transition-all duration-300 ${
              i <= currentStep ? 'bg-accent shadow-sm shadow-accent/30' : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
