import { planTabLabel } from '@/utils/scenarios'

/**
 * Horizontal tabs to switch between floor plans (Page N · Plan M).
 */
export default function PlanTabSwitcher({
  plans,
  activePlan,
  onSelectPlan,
  children,
}) {
  if (!plans?.length) return null

  const active =
    plans.find((p) => p.planNumber === activePlan) ?? plans[0]

  return (
    <div className="rounded-xl border border-line bg-card/60 overflow-hidden mb-6">
      <div className="border-b border-line/60 bg-surface/20 overflow-x-auto">
        <div className="flex min-w-max px-2 pt-2 gap-1">
          {plans.map((plan) => {
            const selected = plan.planNumber === active.planNumber
            return (
              <button
                key={plan.planNumber}
                type="button"
                onClick={() => onSelectPlan(plan.planNumber)}
                className={`px-4 py-2.5 rounded-t-lg text-sm font-medium border border-b-0 transition-colors whitespace-nowrap ${
                  selected
                    ? 'border-line bg-card text-text -mb-px z-10'
                    : 'border-transparent text-muted hover:text-text hover:bg-surface/40'
                }`}
              >
                {planTabLabel(plan)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4">{children(active)}</div>
    </div>
  )
}
