/**
 * Filesystem helpers for test-suite/ — used by the Vite dev plugin on Save/Delete.
 *
 * Pipeline: Save → test-suite/cases/{id}/ + append entry to manifest.json
 * Results:  test-suite/test-results/run-<ISO-timestamp>.json + results-index.json
 */
import fs from 'fs'
import path from 'path'

const MANIFEST = 'manifest.json'
const RESULTS_DIR = 'test-results'
const RESULTS_INDEX = 'results-index.json'
const INPUT_EXTS = new Set(['.jpg', '.jpeg', '.png', '.pdf'])
const GT_EXTS = new Set(['.json'])

export function slugify(value, fallback = 'case') {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || fallback
}

function manifestPath(root) {
  return path.join(root, MANIFEST)
}

function caseDir(root, caseId) {
  return path.join(root, 'cases', caseId)
}

function resultsDir(root) {
  return path.join(root, RESULTS_DIR)
}

function resultsIndexPath(root) {
  return path.join(resultsDir(root), RESULTS_INDEX)
}

/** ISO timestamp safe for filenames (colons → dashes). */
export function runTimestampSlug(date = new Date()) {
  return date.toISOString().replace(/:/g, '-')
}

export function runIdFromTimestamp(timestamp) {
  return `run-${runTimestampSlug(new Date(timestamp))}`
}

function safeCaseFileName(uploadName, allowedExts, label = 'file') {
  const raw = path.basename(String(uploadName ?? '').trim())
  if (!raw || raw === '.' || raw === '..') throw new Error(`Invalid ${label} name`)
  const ext = path.extname(raw).toLowerCase()
  if (!allowedExts.has(ext)) {
    throw new Error(`${label} must be one of: ${[...allowedExts].join(', ')}`)
  }
  return raw
}

export function loadManifest(root) {
  const file = manifestPath(root)
  if (!fs.existsSync(file)) return { cases: [] }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function saveManifest(root, manifest) {
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export function listCases(root) {
  const cases = loadManifest(root).cases
  return Array.isArray(cases) ? cases : []
}

function uniqueCaseId(root, preferred) {
  const base = slugify(preferred)
  const existing = new Set(listCases(root).map((c) => c.id))
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Create test-suite/cases/{id}/ with input + ground-truth files, update manifest.
 */
export function createCase(
  root,
  { label, inputFileName: uploadName, groundTruthFileName: gtUploadName, inputBytes, groundTruth },
) {
  if (!inputBytes?.length) throw new Error('Input file is empty')
  if (!groundTruth || typeof groundTruth !== 'object') throw new Error('Ground truth must be a JSON object')

  const safeInput = safeCaseFileName(uploadName, INPUT_EXTS, 'Floor plan')
  const safeGt = safeCaseFileName(gtUploadName, GT_EXTS, 'Ground truth')
  const caseId = uniqueCaseId(root, path.basename(uploadName, path.extname(uploadName)) || label || 'case')
  const folder = caseDir(root, caseId)

  if (fs.existsSync(folder)) throw new Error(`Case folder "${caseId}" already exists`)

  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, safeInput), inputBytes)
  fs.writeFileSync(path.join(folder, safeGt), `${JSON.stringify(groundTruth, null, 2)}\n`, 'utf8')

  const entry = {
    id: caseId,
    label: (label || '').trim() || path.basename(uploadName, path.extname(uploadName)) || caseId,
    inputFile: safeInput,
    groundTruthFile: safeGt,
    createdAt: new Date().toISOString(),
  }

  const manifest = loadManifest(root)
  manifest.cases = [...(manifest.cases ?? []), entry]
  saveManifest(root, manifest)
  return entry
}

/**
 * Update files in an existing case folder and refresh manifest entry.
 */
export function updateCase(
  root,
  caseId,
  { label, inputFileName: uploadName, groundTruthFileName: gtUploadName, inputBytes, groundTruth },
) {
  const manifest = loadManifest(root)
  const idx = (manifest.cases ?? []).findIndex((c) => c.id === caseId)
  if (idx < 0) throw new Error('Test case not found')

  const folder = caseDir(root, caseId)
  if (!fs.existsSync(folder)) throw new Error('Case folder missing')

  const entry = { ...manifest.cases[idx] }

  if (inputBytes?.length && uploadName) {
    const safeInput = safeCaseFileName(uploadName, INPUT_EXTS, 'Floor plan')
    const oldPath = path.join(folder, entry.inputFile)
    if (fs.existsSync(oldPath) && entry.inputFile !== safeInput) fs.unlinkSync(oldPath)
    fs.writeFileSync(path.join(folder, safeInput), inputBytes)
    entry.inputFile = safeInput
  }

  if (groundTruth) {
    const safeGt = gtUploadName
      ? safeCaseFileName(gtUploadName, GT_EXTS, 'Ground truth')
      : entry.groundTruthFile
    const oldGtPath = path.join(folder, entry.groundTruthFile)
    if (fs.existsSync(oldGtPath) && entry.groundTruthFile !== safeGt) fs.unlinkSync(oldGtPath)
    fs.writeFileSync(path.join(folder, safeGt), `${JSON.stringify(groundTruth, null, 2)}\n`, 'utf8')
    entry.groundTruthFile = safeGt
  }

  if (label?.trim()) entry.label = label.trim()

  manifest.cases[idx] = entry
  saveManifest(root, manifest)
  return entry
}

/**
 * Remove case folder and delete entry from manifest.json.
 */
export function deleteCase(root, caseId) {
  const manifest = loadManifest(root)
  const before = manifest.cases ?? []
  const next = before.filter((c) => c.id !== caseId)
  if (next.length === before.length) throw new Error('Test case not found')

  manifest.cases = next
  saveManifest(root, manifest)

  const folder = caseDir(root, caseId)
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true })
}

export function loadResultsIndex(root) {
  const file = resultsIndexPath(root)
  if (!fs.existsSync(file)) return { runs: [] }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  return { runs: Array.isArray(data.runs) ? data.runs : [] }
}

function saveResultsIndex(root, index) {
  fs.mkdirSync(resultsDir(root), { recursive: true })
  fs.writeFileSync(resultsIndexPath(root), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
}

/**
 * Persist a full batch run and append summary to results-index.json.
 * @param {Array<{ testCaseId, input, output, status, executedAt }>} entries
 * @param {{ visionProvider?, visionModel?, modelLabel?, modelId? }} modelMeta
 */
export function saveRunResults(root, entries, modelMeta = null) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error('Run results must be a non-empty array')
  }

  const timestamp = new Date().toISOString()
  const runId = runIdFromTimestamp(timestamp)
  const dir = resultsDir(root)
  fs.mkdirSync(dir, { recursive: true })

  const filePath = path.join(dir, `${runId}.json`)
  fs.writeFileSync(filePath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')

  const passed = entries.filter((e) => e.status === 'passed').length
  const failed = entries.length - passed

  const summary = {
    runId,
    timestamp,
    totalTests: entries.length,
    passed,
    failed,
  }
  if (modelMeta?.visionProvider) summary.visionProvider = modelMeta.visionProvider
  if (modelMeta?.visionModel) summary.visionModel = modelMeta.visionModel
  if (modelMeta?.modelLabel) summary.modelLabel = modelMeta.modelLabel
  if (modelMeta?.modelId) summary.modelId = modelMeta.modelId
  if (modelMeta?.totalTokens != null) summary.totalTokens = modelMeta.totalTokens
  if (modelMeta?.totalApiCalls != null) summary.totalApiCalls = modelMeta.totalApiCalls
  if (modelMeta?.actualExtractionModel) summary.actualExtractionModel = modelMeta.actualExtractionModel
  if (modelMeta?.actualCorrectionModel) summary.actualCorrectionModel = modelMeta.actualCorrectionModel

  const index = loadResultsIndex(root)
  index.runs = [...(index.runs ?? []), summary]
  saveResultsIndex(root, index)

  return summary
}

export function loadRunResults(root, runId) {
  const safeId = path.basename(String(runId ?? ''))
  if (!safeId.startsWith('run-')) throw new Error('Invalid run id')

  const filePath = path.join(resultsDir(root), `${safeId}.json`)
  if (!fs.existsSync(filePath)) throw new Error('Run results not found')

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(data)) throw new Error('Invalid run results format')
  return data
}
