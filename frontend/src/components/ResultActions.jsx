export default function ResultActions({ onDownloadCSV, onReset }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onDownloadCSV}
        className="px-5 py-2.5 rounded-lg border border-line bg-surface text-[#F0EEE8] hover:border-accent/50 transition-colors text-sm font-medium"
      >
        Download CSV
      </button>
      <button
        type="button"
        onClick={onReset}
        className="px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium"
      >
        Analyze Another
      </button>
    </div>
  )
}
