import { formatFileSize } from '../utils/format'

//Upload Icon SVG
function UploadIcon() {
  return (
    <svg
      className="w-7 h-7 text-[#8B8A82]"
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

//Empty State
function EmptyState({ onBrowse }) {
  return (
    <>
      <div className="mx-auto w-14 h-14 rounded-full bg-surface border border-line flex items-center justify-center mb-4">
        <UploadIcon />
      </div>
      <p className="text-lg font-medium text-[#F0EEE8] mb-1">Drop your floor plan here</p>
      <p className="text-sm text-[#8B8A82] mb-4">JPG, PNG, or PDF — click to browse</p>
      <button
        type="button"
        onClick={onBrowse}
        className="text-sm text-accent hover:underline"
      >
        Choose file
      </button>
    </>
  )
}

//File Preview Section
function FilePreview({ file, preview, onChangeFile }) {
  const isPdf = file.name.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {preview && !isPdf && (
        <img
          src={preview}
          alt="Preview"
          className="w-32 h-32 object-cover rounded-lg border border-line"
        />
      )}
      {isPdf && (
        <div className="w-32 h-32 rounded-lg border border-line bg-surface flex items-center justify-center">
          <span className="text-2xl font-mono text-accent">PDF</span>
        </div>
      )}
      <div className="text-left flex-1">
        <p className="font-medium text-[#F0EEE8] truncate max-w-xs">{file.name}</p>
        <p className="text-sm text-[#8B8A82] font-mono">{formatFileSize(file.size)}</p>
        <button
          type="button"
          onClick={onChangeFile}
          className="text-sm text-accent mt-2 hover:underline"
        >
          Change file
        </button>
      </div>
    </div>
  )
}

//File Drop and Input Zone
export default function FileDropZone({
  file,
  preview,
  loading,
  fileInputRef,
  onFileSelect,
  onDrop,
}) {
  const browse = () => fileInputRef.current?.click()

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed transition-colors p-10 text-center ${
        loading
          ? 'border-accent/50 bg-accent/5'
          : 'border-line bg-card/85 backdrop-blur-md hover:border-accent/40'
      }`}
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
  )
}
