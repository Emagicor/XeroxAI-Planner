import PlanImagesPanel from './PlanImagesPanel'

import ReviewTable from '@/components/results/ReviewTable'



export default function PlanResultBlock({

  plan,

  jobId,

  unit,

  activeRowId,

  activeRoom,

  onUpdateRow,

  onToggleIncluded,

  onAddRoom,

  onRowActivate,

  onSelectRoom,

  showTable = true,

  embedded = false,

}) {

  const legendRooms = plan.rows

    .filter((r) => r.included !== false)

    .map((r) => ({

      name: r.name,

      roomIndex: r.roomIndex,

      colorIndex: r.colorIndex,

    }))



  const inner = (

    <div className="space-y-6">

      {!embedded && (

        <div className="flex flex-wrap items-center justify-between gap-2">

          <p className="text-xs text-muted">

            {plan.roomCount} room{plan.roomCount !== 1 ? 's' : ''}

            {plan.totalAreaSqft > 0 && (

              <span className="font-mono ml-2">{plan.totalAreaSqft.toFixed(0)} sq ft</span>

            )}

          </p>

        </div>

      )}



      <section className="space-y-3">

        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">

          Floor plan

        </h4>

        <PlanImagesPanel

          floorLabel={embedded ? plan.floorLabel : null}

          clipPreview={plan.clipPreview}

          jobId={jobId}

          planNumber={plan.planNumber}

          annotatedImage={plan.annotatedImage}

          hasAnnotated={plan.hasAnnotated}

          rooms={legendRooms}

          activeRoom={activeRoom}

          onSelectRoom={onSelectRoom}

        />

      </section>



      {showTable && (

        <section className="space-y-3">

          <div className="flex flex-wrap items-end justify-between gap-2">

            <div>

              <h4 className="text-xs font-medium uppercase tracking-wide text-muted">

                Room measurements

              </h4>

              <p className="text-xs text-muted mt-1">

                Edit values below. Checked rows count toward totals and exports.

              </p>

            </div>

          </div>

          <ReviewTable

            rows={plan.rows}

            unit={unit}

            activePage={plan.planNumber}

            activeRowId={activeRowId}

            onUpdateRow={onUpdateRow}

            onToggleIncluded={onToggleIncluded}

            onAddRoom={() => onAddRoom(plan.planNumber)}

            onRowActivate={onRowActivate}

          />

        </section>

      )}

    </div>

  )



  if (embedded) return inner



  return (

    <article className="rounded-xl border border-line bg-card/60 overflow-hidden">

      <div className="px-4 py-3 border-b border-line/60 bg-surface/20">

        <h3 className="text-sm font-medium text-text">{plan.floorLabel}</h3>

      </div>

      <div className="p-4">{inner}</div>

    </article>

  )

}


