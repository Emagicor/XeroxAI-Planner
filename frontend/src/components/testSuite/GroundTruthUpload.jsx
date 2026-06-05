import { useRef } from 'react'

export default function GroundTruthUpload({
  fileName,
  fileNames,
  multiple = false,
  error,
  onSelect,
  onClear,
}) {
  const names = fileNames ?? (fileName ? [fileName] : [])
  const inputRef = useRef(null)

  return (
    <div className="mt-4 rounded-xl border border-dashed border-line bg-card/60 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#F0EEE8]">Ground truth JSON</p>
          <p className="text-xs text-[#8B8A82] mt-0.5">
            {multiple
              ? 'Upload one JSON per floor plan, in the same order. Length and width may be swapped.'
              : 'Room order ignored; length and width may be swapped.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 rounded-lg border border-line bg-surface text-sm text-[#F0EEE8] hover:border-accent/50"
          >
            {names.length ? 'Replace JSON' : multiple ? 'Upload JSON files' : 'Upload JSON'}
          </button>
          {names.length > 0 && (
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

      {names.length > 0 && (
        <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {names.map((name, i) => (
            <li key={`${name}-${i}`} className="text-xs font-mono text-emerald-400/90">
              #{i + 1} {name}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files
          if (!selected?.length) return
          if (multiple) {
            onSelect(selected)
          } else {
            onSelect(selected[0])
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}
