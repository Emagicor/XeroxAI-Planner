import { lazy, Suspense } from 'react'
import { features } from '@/config/features'
import AnalyzeApp from './AnalyzeApp'

const DevApp = lazy(() => import('./DevApp'))

export default function App() {
  if (!features.testSuite) {
    return <AnalyzeApp />
  }

  return (
    <Suspense fallback={<AnalyzeApp />}>
      <DevApp />
    </Suspense>
  )
}
