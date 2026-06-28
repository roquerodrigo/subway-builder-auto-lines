import type { ForkChoices, ForkOption } from '@/domain/line/ExpansionPlan'
import type { ExtendPlanData } from '@/presentation/hooks/useExtendPlan'
import type { Route } from '@/shared/game/Route'

import { Fragment, h } from '@/infrastructure/ui/react'
import { ForkSelector } from '@/presentation/components/ForkSelector'
import { Select } from '@/presentation/components/Select'
import { buildDisplay, StationList } from '@/presentation/components/StationList'
import { routeLabel } from '@/presentation/labels'

export interface ExtendTabProps {
  routes: Route[]
  selection: null | string
  planData: ExtendPlanData | null
  choices: ForkChoices
  status: string
  onSelectRoute: (id: string) => void
  onChoose: (stationId: string, option: ForkOption | null) => void
}

export function ExtendTab({
  routes,
  selection,
  planData,
  choices,
  status,
  onSelectRoute,
  onChoose,
}: ExtendTabProps): JSX.Element {
  if (!routes.length) {
    return <div className="text-xs text-muted-foreground">No lines in this city.</div>
  }

  const hasAction = planData?.plan.hasAction() ?? false

  return (
    <Fragment>
      <Select
        onChange={onSelectRoute}
        options={routes.map((route) => ({ value: route.id, label: routeLabel(route) }))}
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
