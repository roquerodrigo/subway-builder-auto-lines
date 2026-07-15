import type { RouteShape } from '@/shared/game/RouteShape'
import type { StationNode } from '@/shared/game/StationNode'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

// A line/route. `tempParentId` marks a preview/temp route (dropped by cleanup);
// `bullet` is the line label (this mod assigns sequential numbers); `shape` is the
// bullet icon shape (this mod creates lines as squares).
export interface Route {
  bullet?: string
  carsPerTrain?: number
  color?: string
  id: string
  shape?: RouteShape
  stComboTimings?: StComboTiming[]
  stNodes: StationNode[]
  tempParentId?: null | string
  trainSchedule?: TrainSchedule
  trainType?: string
}

// One stop's departure timing; the last entry's departureTime is the full
// round-trip cycle in seconds.
export interface StComboTiming {
  departureTime: number
}

export function findRoute(routes: Route[] | undefined, routeId: string): Route | undefined {
  return (routes ?? []).find((route) => route.id === routeId)
}
