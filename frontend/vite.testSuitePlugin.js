import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  createCase,
  deleteCase,
  loadResultsIndex,
  loadRunResults,
  saveRunResults,
  updateCase,
} from './testSuiteStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const TEST_SUITE_DIR = path.resolve(__dirname, '../test-suite')

function contentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.pdf')) return 'application/pdf'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

/** Save / delete write to test-suite/; static files served at /test-suite. */
function registerTestSuiteApi(middlewares) {
  middlewares.use('/api/test-suite', async (req, res, next) => {
    const subpath = (req.url ?? '/').split('?')[0]

    if (req.method === 'POST' && subpath === '/save') {
      try {
        const body = await readJsonBody(req)
        const inputBytes = Buffer.from(body.inputBase64 ?? '', 'base64')
        const entry = createCase(TEST_SUITE_DIR, {
          label: body.label ?? '',
          inputFileName: body.inputFileName,
          groundTruthFileName: body.groundTruthFileName,
          inputBytes,
          groundTruth: body.groundTruth,
        })
        sendJson(res, 201, entry)
      } catch (err) {
        sendJson(res, 400, { message: err.message || 'Save failed' })
      }
      return
    }

    if (req.method === 'POST' && subpath === '/results') {
      try {
        const body = await readJsonBody(req)
        const modelMeta = {
          visionProvider: body.visionProvider ?? null,
          visionModel: body.visionModel ?? null,
          modelLabel: body.modelLabel ?? null,
          modelId: body.modelId ?? null,
        }
        const summary = saveRunResults(
          TEST_SUITE_DIR,
          body.entries ?? body.results ?? [],
          modelMeta,
        )
        sendJson(res, 201, summary)
      } catch (err) {
        sendJson(res, 400, { message: err.message || 'Save results failed' })
      }
      return
    }

    const resultsMatch = subpath.match(/^\/results\/([^/]+)\/?$/)
    if (resultsMatch && req.method === 'GET') {
      try {
        const runId = decodeURIComponent(resultsMatch[1])
        const entries = loadRunResults(TEST_SUITE_DIR, runId)
        sendJson(res, 200, entries)
      } catch (err) {
        const status = err.message === 'Run results not found' ? 404 : 400
        sendJson(res, status, { message: err.message || 'Load results failed' })
      }
      return
    }

    const caseMatch = subpath.match(/^\/cases\/([^/]+)\/?$/)
    if (caseMatch) {
      const caseId = decodeURIComponent(caseMatch[1])

      if (req.method === 'PUT') {
        try {
          const body = await readJsonBody(req)
          const inputBytes = body.inputBase64 ? Buffer.from(body.inputBase64, 'base64') : null
          const entry = updateCase(TEST_SUITE_DIR, caseId, {
            label: body.label,
            inputFileName: body.inputFileName,
            groundTruthFileName: body.groundTruthFileName,
            inputBytes,
            groundTruth: body.groundTruth,
          })
          sendJson(res, 200, entry)
        } catch (err) {
          const status = err.message === 'Test case not found' ? 404 : 400
          sendJson(res, status, { message: err.message || 'Update failed' })
        }
        return
      }

      if (req.method === 'DELETE') {
        try {
          deleteCase(TEST_SUITE_DIR, caseId)
          res.statusCode = 204
          res.end()
        } catch (err) {
          sendJson(res, 404, { message: err.message || 'Delete failed' })
        }
        return
      }
    }

    next()
  })
}

function registerStaticTestSuite(middlewares) {
  middlewares.use('/test-suite', (req, res, next) => {
    const raw = (req.url ?? '/').split('?')[0]
    const rel = decodeURIComponent(raw.replace(/^\//, ''))
    const filePath = path.normalize(path.join(TEST_SUITE_DIR, rel))

    if (!filePath.startsWith(TEST_SUITE_DIR)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        next()
        return
      }
      res.setHeader('Content-Type', contentType(filePath))
      res.setHeader('Cache-Control', 'no-store')
      res.end(data)
    })
  })
}

export function serveTestSuitePlugin() {
  return {
    name: 'serve-test-suite',
    configureServer(server) {
      registerTestSuiteApi(server.middlewares)
      registerStaticTestSuite(server.middlewares)
    },
    configurePreviewServer(server) {
      registerTestSuiteApi(server.middlewares)
      registerStaticTestSuite(server.middlewares)
    },
    writeBundle(options) {
      copyDir(TEST_SUITE_DIR, path.join(options.dir, 'test-suite'))
    },
  }
}
