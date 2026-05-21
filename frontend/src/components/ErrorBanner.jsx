export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="mt-6 p-4 rounded-lg border border-[#D85A30]/40 bg-[#D85A30]/10 text-center">
      <p className="text-[#E8A090] mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-accent hover:underline"
      >
        Retry analysis
      </button>
    </div>
  )
}
