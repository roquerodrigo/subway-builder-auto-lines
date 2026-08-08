import type { ForkChoices, ForkOption } from '@/domain/line/ExpansionPlan'
import type { ExtendPlanData } from '@/presentation/hooks/useExtendPlan'
import type { Route } from '@/shared/game/Route'

import { Fragment, h } from '@/infrastructure/ui/react'
import { ForkSelector } from '@/presentation/components/ForkSelector'
import { Select } from '@/presentation/components/Select'
import { buildDisplay, StationList } from '@/presentation/components/StationList'
import { routeLabel } from '@/presentation/labels'

export interface ExtendTabProps {
  choices: ForkChoices
  cityHasLines: boolean
  onChoose: (stationId: string, option: ForkOption | null) => void
  onSelectRoute: (id: string) => void
  planData: ExtendPlanData | null
  routes: Route[]
  selection: null | string
  status: string
}

// `routes` are the lines that can grow right now, so an empty list still means two
// different things to the player: a city with no lines at all, or lines that have
// nowhere left to go.
export function ExtendTab({
  choices,
  cityHasLines,
  onChoose,
  onSelectRoute,
  planData,
  routes,
  selection,
  status,
}: ExtendTabProps): JSX.Element {
  if (!routes.length) {
    return (
      <div className="text-xs text-muted-foreground">
        {cityHasLines ? 'No line can be extended right now.' : 'No lines in this city.'}
      </div>
    )
  }

  const hasAction = planData?.plan.hasAction() ?? false

  return (
    <Fragment>
      <Select
        onChange={onSelectRoute}
        options={routes.map((route) => ({ label: routeLabel(route), value: route.id }))}
        value={selection}
      />
      {planData ?
          (
            <Fragment>
              <StationList
                items={buildDisplay(planData.plan, planData.order, choices)}
                route={planData.route}
              />
              {planData.plan.endpoints
                .filter((endpoint) => endpoint.fork)
                .map((endpoint) => (
                  <ForkSelector
                    chosen={choices[endpoint.stationId]}
                    endpoint={endpoint}
                    key={endpoint.stationId}
                    onChoose={(option) => onChoose(endpoint.stationId, option)}
                  />
                ))}
              {!hasAction && !status ?
                  (
                    <div className="text-xs text-muted-foreground">No extension possible for this line.</div>
                  ) :
                null}
            </Fragment>
          ) :
        null}
    </Fragment>
  )
}
