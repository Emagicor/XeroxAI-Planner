import { useEffect, useState } from 'react'
import { fetchUsdInrRate } from '@/utils/tokenCost'

export function useUsdInrRate() {
  const [rate, setRate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchUsdInrRate()
      .then((inr) => {
        if (!cancelled) setRate(inr)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Exchange rate unavailable')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { rate, loading, error }
}
