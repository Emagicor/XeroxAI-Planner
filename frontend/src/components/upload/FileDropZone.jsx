import { formatFileSize } from '@/utils/format'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

function UploadIcon() {
  return (
    <svg
      className="w-8 h-8 text-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  )
}

function EmptyState({ onBrowse }) {
  return (
    <div className="py-4">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center mb-5">
        <UploadIcon />
      </div>
      <p className="text-lg font-semibold text-text mb-2">
        Drop your floor plan here
      </p>
      <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
        JPG, PNG, or PDF — each floor plan is detected and clipped before AI analysis
      </p>
      <Button onClick={onBrowse} size="lg">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Browse files
      </Button>
    </div>
  )
}

function FilePreview({ file, preview, onChangeFile }) {
  const isPdf = file.name.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
      {preview && !isPdf && (
        <img
          src={preview}
          alt="Preview"
          className="w-28 h-28 object-cover rounded-xl border border-line shadow-lg"
        />
      )}
      {isPdf && (
        <div className="w-28 h-28 rounded-xl border border-line bg-surface flex items-center justify-center">
          <span className="text-xl font-mono font-semibold text-accent">PDF</span>
        </div>
      )}
      <div className="text-left flex-1 min-w-0">
        <p className="font-semibold text-text truncate">{file.name}</p>
        <p className="text-sm text-muted font-mono mt-1">{formatFileSize(file.size)}</p>
        <Button variant="ghost" size="sm" onClick={onChangeFile} className="mt-3">
          Change file
        </Button>
      </div>
    </div>
  )
}

export default function FileDropZone({
  file,
  preview,
  loading,
  fileInputRef,
  onFileSelect,
  onDrop,
  showPreview = true,
}) {
  const browse = () => fileInputRef.current?.click()

  if (!showPreview && file) return null

  return (
    <Card
      glow
      className={`transition-colors ${
        loading ? 'border-accent/40 bg-accent/5' : 'hover:border-accent/30'
      }`}
    >
      <div
        className="p-8 sm:p-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={(e) => onFileSelect(e.target.files[0])}
        />

        {!file ? (
          <EmptyState onBrowse={browse} />
        ) : (
          <FilePreview file={file} preview={preview} onChangeFile={browse} />
        )}
      </div>
    </Card>
  )
}
