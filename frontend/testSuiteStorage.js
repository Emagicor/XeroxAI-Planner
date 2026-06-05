/**
 * Filesystem helpers for test-suite/ — used by the Vite dev plugin on Save/Delete.
 *
 * Pipeline: Save → test-suite/cases/{id}/ + append entry to manifest.json
 */
import fs from 'fs'
import path from 'path'

const MANIFEST = 'manifest.json'
const GROUND_TRUTH = 'ground-truth.json'
const INPUT_EXTS = new Set(['.jpg', '.jpeg', '.png', '.pdf'])

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

function inputFileName(uploadName) {
  const ext = path.extname(uploadName || '').toLowerCase()
  if (!INPUT_EXTS.has(ext)) throw new Error('Floor plan must be JPG, PNG, or PDF')
  return `input${ext}`
}

/**
 * Create test-suite/cases/{id}/ with input file + ground-truth.json, update manifest.
 */
export function createCase(root, { label, inputFileName: uploadName, inputBytes, groundTruth }) {
  if (!inputBytes?.length) throw new Error('Input file is empty')
  if (!groundTruth || typeof groundTruth !== 'object') throw new Error('Ground truth must be a JSON object')

  const safeInput = inputFileName(uploadName)
  const caseId = uniqueCaseId(root, path.basename(uploadName, path.extname(uploadName)) || label || 'case')
  const folder = caseDir(root, caseId)

  if (fs.existsSync(folder)) throw new Error(`Case folder "${caseId}" already exists`)

  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, safeInput), inputBytes)
  fs.writeFileSync(path.join(folder, GROUND_TRUTH), `${JSON.stringify(groundTruth, null, 2)}\n`, 'utf8')

  const entry = {
    id: caseId,
    label: (label || '').trim() || path.basename(uploadName, path.extname(uploadName)) || caseId,
    inputFile: safeInput,
    groundTruthFile: GROUND_TRUTH,
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
export function updateCase(root, caseId, { label, inputFileName: uploadName, inputBytes, groundTruth }) {
  const manifest = loadManifest(root)
  const idx = (manifest.cases ?? []).findIndex((c) => c.id === caseId)
  if (idx < 0) throw new Error('Test case not found')

  const folder = caseDir(root, caseId)
  if (!fs.existsSync(folder)) throw new Error('Case folder missing')

  const entry = { ...manifest.cases[idx] }

  if (inputBytes?.length && uploadName) {
    const safeInput = inputFileName(uploadName)
    const oldPath = path.join(folder, entry.inputFile)
    if (fs.existsSync(oldPath) && entry.inputFile !== safeInput) fs.unlinkSync(oldPath)
    fs.writeFileSync(path.join(folder, safeInput), inputBytes)
    entry.inputFile = safeInput
  }

  if (groundTruth) {
    fs.writeFileSync(path.join(folder, GROUND_TRUTH), `${JSON.stringify(groundTruth, null, 2)}\n`, 'utf8')
    entry.groundTruthFile = GROUND_TRUTH
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
