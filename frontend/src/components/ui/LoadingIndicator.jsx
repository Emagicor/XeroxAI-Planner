export default function LoadingIndicator({ steps, currentStep, label }) {
  return (
    <div className="mt-8 text-center">
      <div className="inline-flex items-center gap-2.5 mb-4 px-4 py-2 rounded-lg border border-line bg-surface">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-text font-medium text-sm">{steps[currentStep]}</span>
      </div>
      {label && <p className="text-sm text-muted mb-4">{label}</p>}
      <div className="flex justify-center gap-1.5">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`h-1 w-12 rounded-full transition-all duration-300 ${
              i <= currentStep ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
