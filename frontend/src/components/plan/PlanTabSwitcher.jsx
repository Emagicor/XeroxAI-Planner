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
    <div className="rounded-xl border border-line bg-card overflow-hidden mb-6 shadow-[var(--shadow-sm)]">
      <div className="border-b border-line bg-surface overflow-x-auto">
        <div className="flex min-w-max p-1 gap-1">
          {plans.map((plan) => {
            const selected = plan.planNumber === active.planNumber
            return (
              <button
                key={plan.planNumber}
                type="button"
                onClick={() => onSelectPlan(plan.planNumber)}
                className={[
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                  selected
                    ? 'bg-accent-subtle text-accent'
                    : 'text-muted hover:text-text hover:bg-text/[0.04]',
                ].join(' ')}
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
