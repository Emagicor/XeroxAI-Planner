import { useRef } from 'react'

export default function GroundTruthUpload({
  fileName,
  error,
  onSelect,
  onClear,
}) {
  const inputRef = useRef(null)

  return (
    <div className="mt-4 rounded-xl border border-dashed border-line bg-card/60 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#F0EEE8]">Ground truth JSON</p>
          <p className="text-xs text-[#8B8A82] mt-0.5">
            Room order ignored; length and width may be swapped.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 rounded-lg border border-line bg-surface text-sm text-[#F0EEE8] hover:border-accent/50"
          >
            {fileName ? 'Replace JSON' : 'Upload JSON'}
          </button>
          {fileName && (
            <button
              type="button"
              onClick={() => {
                onClear()
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="px-4 py-2 rounded-lg text-sm text-[#8B8A82] hover:text-red-400"
            >
              Clear
            </button>
          )}
          <a
            href="/samples/ground-truth.example.json"
            download
            className="px-4 py-2 rounded-lg text-sm text-accent hover:underline"
          >
            Example format
          </a>
        </div>
      </div>

      {fileName && (
        <p className="mt-2 text-xs font-mono text-emerald-400/90">{fileName}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
        }}
      />
    </div>
  )
}
