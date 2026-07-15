import type { ExpansionPlan } from '@/domain/line/ExpansionPlan'
import type { PanelDependencies } from '@/presentation/PanelDependencies'
import type { Coordinate } from '@/shared/game/Coordinate'
import type { Route } from '@/shared/game/Route'

import { Corridor } from '@/domain/line/Corridor'
import { LineExpansionPlanner } from '@/domain/line/LineExpansionPlanner'
import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { React } from '@/infrastructure/ui/react'
import { realRoutes } from '@/presentation/labels'
import { PanelMode } from '@/presentation/types'

export interface ExtendPlanData {
  order: string[]
  plan: ExpansionPlan
  railPath: (stationIds: string[]) => Coordinate[]
  route: Route
}

// The plan is memoised on [mode, selection, refreshKey]: recomputing it every render
// would hand back fresh fork-option objects, so a fork picked into `choices`
// would no longer match by identity. Memoising keeps option identities stable
// across the re-renders that fork selection itself triggers.
export function useExtendPlan(
  dependencies: PanelDependencies,
  mode: PanelMode,
  selection: null | string,
  refreshKey: number,
): ExtendPlanData | null {
  return React.useMemo<ExtendPlanData | null>(() => {
    if (mode !== PanelMode.Extend) {
      return null
    }
    const route = realRoutes(dependencies.api).find((candidate) => candidate.id === selection)
    if (!route) {
      return null
    }
    const state = dependencies.store.state()
    const plan = LineExpansionPlanner.plan(state, route)
    const network = new TrackNetwork(state, plan.index)
    const order = Corridor.order(network, plan.lineStationIds)

    return { order, plan, railPath: (stationIds) => network.railPath(stationIds), route }
    // `dependencies` is stable; keying on [mode, selection, refreshKey] is deliberate (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selection, refreshKey])
}
