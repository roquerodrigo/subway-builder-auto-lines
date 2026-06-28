import type { RouteShape } from '@/shared/game/RouteShape'
import type { StationNode } from '@/shared/game/StationNode'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

// One stop's departure timing; the last entry's departureTime is the full
// round-trip cycle in seconds.
export interface StComboTiming {
  departureTime: number
}

// A line/route. `tempParentId` marks a preview/temp route (dropped by cleanup);
// `bullet` is the line label (this mod assigns sequential numbers); `shape` is the
// bullet icon shape (this mod creates lines as squares).
export interface Route {
  id: string
  bullet?: string
  shape?: RouteShape
  color?: string
  trainType?: string
  carsPerTrain?: number
  stNodes: StationNode[]
  stComboTimings?: StComboTiming[]
  trainSchedule?: TrainSchedule
  tempParentId?: null | string
}

export function findRoute(routes: Route[] | undefined, routeId: string): Route | undefined {
  return (routes ?? []).find((route) => route.id === routeId)
}
