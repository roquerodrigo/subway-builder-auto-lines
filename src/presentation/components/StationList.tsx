import type { ExpansionPlan, ForkChoices } from '@/domain/line/ExpansionPlan'
import type { StationListItem } from '@/presentation/types'
import type { Route } from '@/shared/game/Route'

import { h } from '@/infrastructure/ui/react'
import { DEFAULT_LINE_COLOR, STATION_DOT_FILL } from '@/presentation/theme'

export interface StationListProps {
  route: null | Route
  items: StationListItem[]
  hideNewTag?: boolean
  color?: string
  flatRows?: boolean
}

// Route-details-style vertical list: a connector line in the route color with a
// dot per station, names stacked. New stops (isNew) are highlighted; each row
// draws its own rail segment so the line stays continuous. `color` overrides the
// route color (a new line has no route yet — the preview picks its color).
// `flatRows` drops the highlight's rounded corners (a new line is all-new, so the
// pill styling just adds noise).
export function StationList({ route, items, hideNewTag, color: colorOverride, flatRows }: StationListProps): JSX.Element {
  const color = colorOverride || route?.color || DEFAULT_LINE_COLOR
  const rowClass = 'flex items-center flex-1 px-2 py-1' + (flatRows ? '' : ' rounded')
  return (
    <div>
      {items.map((item, i) => {
        const top = i === 0 ? '50%' : '0'
        const bottom = i === items.length - 1 ? '50%' : '0'
        const dot = item.isNew ? 11 : 8
        return (
          <div className="flex items-stretch" key={i} style={{ minHeight: '30px' }}>
            <div style={{ position: 'relative', flex: '0 0 16px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '2px',
                  top,
                  bottom,
                  background: color,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: dot + 'px',
                  height: dot + 'px',
                  borderRadius: '50%',
                  boxSizing: 'border-box',
                  background: item.isNew ? color : STATION_DOT_FILL,
                  border: '2px solid ' + color,
                }}
              />
            </div>
            <div
              className={rowClass}
              style={item.isNew ? { background: 'rgba(127,127,127,.14)' } : undefined}
            >
              <div className={item.isNew ? 'font-bold' : 'text-muted-foreground'}>{item.name}</div>
              {item.isNew && !hideNewTag ?
                  (
                    <span className="ml-1.5 font-bold" style={{ fontSize: '9px', color }}>
                      New
                    </span>
                  ) :
                null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Full ordered display: every existing station, with each endpoint's new stops
// highlighted right at that endpoint (before the start terminus, after the rest).
export function buildDisplay(plan: ExpansionPlan, order: string[], choices: ForkChoices): StationListItem[] {
  const endpointById = new Map(plan.endpoints.map((endpoint) => [endpoint.stationId, endpoint] as const))

  // Carries the station id alongside the name: two different stations can share a
  // name, and the list has to tell them apart the way the apply path does.
  const chainStations = (stationId: string): { id: string, name: string }[] => {
    const endpoint = endpointById.get(stationId)
    if (!endpoint) {
      return []
    }
    const named = (id: string): { id: string, name: string } => ({
      id,
      name: plan.index.stationById.get(id)?.name ?? '?',
    })
    const stations = endpoint.autoStationIds.map(named)
    const choice = choices[stationId]
    if (endpoint.fork && choice) {
      stations.push(...choice.stationIds.map(named))
    }
    return stations
  }

  const list: StationListItem[] = []
  const seenNew = new Set<string>()
  // Keyed by station, not by name: keying on the name would collapse two distinct
  // stations that happen to share one into a single row, under-reporting what the
  // line actually gains — the apply path adds both.
  const pushNew = (station: { id: string, name: string }): void => {
    if (seenNew.has(station.id)) {
      return
    }
    seenNew.add(station.id)
    list.push({ name: station.name, isNew: true })
  }

  order.forEach((stationId, i) => {
    const existing: StationListItem = {
      name: plan.index.stationById.get(stationId)?.name ?? '?',
      isNew: false,
    }
    const stations = chainStations(stationId)
    if (i === 0) {
      // start terminus: its new stops extend outward, before it
      stations.slice().reverse().forEach(pushNew)
      list.push(existing)
    } else {
      list.push(existing)
      stations.forEach(pushNew)
    }
  })
  return list
}
