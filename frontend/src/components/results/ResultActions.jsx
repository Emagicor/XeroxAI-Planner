import Button from '@/components/ui/Button'

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

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
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onDownloadCSV}>
          <DownloadIcon />
          CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={onDownloadXLSX} disabled={xlsxLoading}>
          <DownloadIcon />
          {xlsxLoading ? 'Exporting…' : 'XLSX'}
        </Button>
        {onDownloadJSON && (
          <Button variant="secondary" size="sm" onClick={onDownloadJSON}>
            <DownloadIcon />
            JSON
          </Button>
        )}
        {onDownloadGroundTruth && (
          <Button variant="success" size="sm" onClick={onDownloadGroundTruth}>
            <DownloadIcon />
            Ground truth
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copyDone ? 'Copied!' : 'Copy table'}
        </Button>
      </div>
      <Button size="md" onClick={onReset} className="sm:ml-auto">
        Analyze another
      </Button>
    </div>
  )
}
