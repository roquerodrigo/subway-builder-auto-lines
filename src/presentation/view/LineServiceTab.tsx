import type { HeadwayMinutes, LineService } from '@/domain/settings/ServiceSettings'
import type { Route } from '@/shared/game/Route'

import {
  MAX_CARS_PER_TRAIN,
  MAX_HEADWAY_MINUTES,
  MIN_CARS_PER_TRAIN,
  MIN_HEADWAY_MINUTES,
} from '@/domain/settings/ServiceSettings'
import { Fragment, h } from '@/infrastructure/ui/react'
import { NumberField } from '@/presentation/components/NumberField'
import { Select } from '@/presentation/components/Select'
import { routeLabel } from '@/presentation/labels'

export interface LineServiceTabProps {
  onChange: (service: LineService) => void
  onSelectRoute: (id: string) => void
  ownService: boolean
  routes: Route[]
  running: LineService | null
  selection: null | string
  service: LineService
}

// One line's own service. The fields carry what the line is set to run — its own
// numbers, or the city-wide ones it still follows — and applying them keeps the
// line on them when it is later extended. What it actually runs is shown
// underneath: a period is served by whole trains over the round trip, so the two
// rarely land on exactly the same figure.
export function LineServiceTab({
  onChange,
  onSelectRoute,
  ownService,
  routes,
  running,
  selection,
  service,
}: LineServiceTabProps): JSX.Element {
  if (!routes.length) {
    return <div className="text-xs text-muted-foreground">No lines in this city.</div>
  }

  const headway = (period: keyof HeadwayMinutes, label: string): JSX.Element => (
    <NumberField
      label={label}
      max={MAX_HEADWAY_MINUTES}
      min={MIN_HEADWAY_MINUTES}
      onChange={(value) =>
        onChange({ ...service, headwayMinutes: { ...service.headwayMinutes, [period]: value } })}
      suffix="min"
      value={service.headwayMinutes[period]}
    />
  )

  return (
    <Fragment>
      <Select
        onChange={onSelectRoute}
        options={routes.map((route) => ({ label: routeLabel(route), value: route.id }))}
        value={selection}
      />
      <div className="space-y-2">
        <NumberField
          label="Cars per train"
          max={MAX_CARS_PER_TRAIN}
          min={MIN_CARS_PER_TRAIN}
          onChange={(value) => onChange({ ...service, carsPerTrain: value })}
          value={service.carsPerTrain}
        />
        {headway('peak', 'Peak')}
        {headway('midday', 'Midday')}
        {headway('offPeak', 'Off-peak')}
        {headway('night', 'Night')}
      </div>
      <div className="text-xs text-muted-foreground">
        {ownService ?
          'This line runs on its own service — it keeps it when the line is extended.' :
          'This line follows the city-wide settings.'}
      </div>
      {running ?
          (
            <div className="text-xs text-muted-foreground">
              {'Today it runs ' + running.carsPerTrain + '-car trains every ' + everyMinutes(running.headwayMinutes) +
                ' min — a period is served by whole trains over the round trip, so it lands near the figure asked for.'}
            </div>
          ) :
        null}
    </Fragment>
  )
}

function everyMinutes(headways: HeadwayMinutes): string {
  return [headways.peak, headways.midday, headways.offPeak, headways.night].join(' / ')
}
