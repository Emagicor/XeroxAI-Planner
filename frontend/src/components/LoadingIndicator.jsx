export default function LoadingIndicator({ steps, currentStep }) {
  return (
    <div className="mt-8 text-center">
      <div className="inline-flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-[#F0EEE8] font-medium">{steps[currentStep]}</span>
      </div>
      <div className="flex justify-center gap-2">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`h-1.5 w-16 rounded-full transition-colors ${
              i <= currentStep ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
