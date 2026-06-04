export default function ResultActions({
  onDownloadCSV,
  onDownloadXLSX,
  onDownloadJSON,
  onDownloadGroundTruth,
  onCopy,
  onReset,
  copyDone,
  xlsxLoading = false,
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      <button
        type="button"
        onClick={onDownloadCSV}
        className="px-4 py-2 rounded-lg border border-line bg-surface text-[#F0EEE8] hover:border-accent/50 transition-colors text-sm font-medium"
      >
        Download CSV
      </button>
      <button
        type="button"
        onClick={onDownloadXLSX}
        disabled={xlsxLoading}
        className="px-4 py-2 rounded-lg border border-line bg-surface text-[#F0EEE8] hover:border-accent/50 transition-colors text-sm font-medium disabled:opacity-50"
      >
        {xlsxLoading ? 'Exporting…' : 'Download XLSX'}
      </button>
      {onDownloadJSON && (
        <button
          type="button"
          onClick={onDownloadJSON}
          className="px-4 py-2 rounded-lg border border-line bg-surface text-[#F0EEE8] hover:border-accent/50 transition-colors text-sm font-medium"
        >
          Download AI JSON
        </button>
      )}
      {onDownloadGroundTruth && (
        <button
          type="button"
          onClick={onDownloadGroundTruth}
          className="px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/50 transition-colors text-sm font-medium"
        >
          Download ground truth
        </button>
      )}
      <button
        type="button"
        onClick={onCopy}
        className="px-4 py-2 rounded-lg border border-line bg-surface text-[#F0EEE8] hover:border-accent/50 transition-colors text-sm font-medium"
      >
        {copyDone ? 'Copied!' : 'Copy table'}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium ml-auto"
      >
        Analyze another
      </button>
    </div>
  )
}
