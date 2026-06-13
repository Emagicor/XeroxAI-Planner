import { analyzeFloorPlan } from './analyzeApi'
import { analyzeFloorPlanStream } from './analyzeStreamApi'
import {
  createApiErrorFromPayload,
  isProviderFailureMessage,
} from '../utils/apiErrors'

/**
 * Single source of truth for the Analyze tab pipeline.
 * Test suite and any future callers should use these helpers so behavior stays aligned.
 */

export function shouldUseAnalyzeStream(file) {
  return file?.name?.toLowerCase().endsWith('.pdf') ?? false
}

function buildStreamProgressItems(totalRegions) {
  const total = Math.max(1, totalRegions ?? 1)
  return Array.from({ length: total }, (_, index) => ({
    id: `plan-${index + 1}`,
    planNumber: index + 1,
    label: total > 1 ? `Plan ${index + 1}` : 'Floor plan',
    status: 'pending',
    message: null,
  }))
}

/**
 * Run /analyze or /analyze/stream for an uploaded document.
 */
export async function runFloorPlanAnalyze(
  file,
  {
    isolateUpload = true,
    visionProvider = null,
    visionModel = null,
    onStreamEvent = null,
  } = {},
) {
  const analyzeOpts = {
    visionProvider,
    visionModel,
    isolateUpload,
  }

  if (shouldUseAnalyzeStream(file)) {
    const partialPages = []

    let meta = {
      filename: file.name,
      content_sha256: '',
      job_id: crypto.randomUUID(),
      status: 'processing',
      pages: [],
      grand_total_sqft: 0,
      eligible_pages: 0,
      ineligible_pages: 0,
      total_pages: 1,
      source_page_count: 1,
      total_regions: 1,
      scenario: null,
    }

    await analyzeFloorPlanStream(
      file,
      {
        onDetected: (evt) => {
          meta.total_pages = evt.total_regions
          meta.source_page_count = evt.source_page_count
          meta.total_regions = evt.total_regions
          meta.scenario = evt.scenario
          onStreamEvent?.({
            type: 'detected',
            event: evt,
            meta,
            progressItems: buildStreamProgressItems(evt.total_regions),
          })
        },
        onProgress: (evt) => {
          const pageData = evt.data
          if (
            pageData.eligible === false &&
            isProviderFailureMessage(pageData.ineligible_reason)
          ) {
            throw createApiErrorFromPayload({
              code: 'VISION_PROVIDER_ERROR',
              message: pageData.ineligible_reason,
            })
          }

          const idx = partialPages.findIndex((p) => p.page_number === pageData.page_number)
          if (idx >= 0) partialPages[idx] = pageData
          else partialPages.push(pageData)

          meta.pages = [...partialPages]
          meta.eligible_pages = meta.pages.filter((p) => p.eligible !== false).length
          meta.ineligible_pages = meta.pages.length - meta.eligible_pages
          meta.grand_total_sqft = meta.pages.reduce(
            (sum, page) =>
              sum + (page.eligible !== false ? Number(page.total_area_sqft ?? 0) : 0),
            0,
          )

          onStreamEvent?.({
            type: 'progress',
            event: evt,
            planIndex: (evt.page ?? 1) - 1,
            pageData,
            meta,
          })
        },
        onDone: (evt) => {
          meta.grand_total_sqft = evt.grand_total_sqft
          meta.eligible_pages = evt.eligible_pages
          meta.ineligible_pages = evt.ineligible_pages
          meta.status = 'complete'
          if (evt.vision_usage) {
            meta.vision_usage = evt.vision_usage
          }
          onStreamEvent?.({ type: 'done', event: evt, meta })
        },
      },
      analyzeOpts,
    )

    if (meta.status === 'complete' && meta.eligible_pages === 0) {
      const failedPage = meta.pages.find((page) =>
        isProviderFailureMessage(page.ineligible_reason),
      )
      if (failedPage) {
        throw createApiErrorFromPayload({
          code: 'VISION_PROVIDER_ERROR',
          message: failedPage.ineligible_reason,
        })
      }
    }

    return meta
  }

  return analyzeFloorPlan(file, analyzeOpts)
}

/**
 * Full pipeline: analyze an uploaded floor plan (blocking or stream).
 */
export async function runFloorPlanPipeline(file, options = {}) {
  const result = await runFloorPlanAnalyze(file, options)
  return { result }
}
