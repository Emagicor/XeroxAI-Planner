export default function ResultActions({
  onDownloadCSV,
  onDownloadXLSX,
  onCopy,
  onReset,
  copyDone,
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
        className="px-4 py-2 rounded-lg border border-line bg-surface text-[#F0EEE8] hover:border-accent/50 transition-colors text-sm font-medium"
      >
        Download XLSX
      </button>
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
