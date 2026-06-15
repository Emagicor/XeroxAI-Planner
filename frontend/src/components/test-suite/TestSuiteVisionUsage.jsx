import { getVisionUsage } from '@/utils/visionUsage'
import VisionUsagePanel from '@/components/vision/VisionUsagePanel'

export function TestSuiteCaseVisionUsage({ aiResult }) {
  const usage = getVisionUsage(aiResult)
  if (!usage) return null

  return (
    <section className="mt-6 space-y-3">
      <VisionUsagePanel usage={usage} title="Vision tokens & models" />
    </section>
  )
}

export default VisionUsagePanel
