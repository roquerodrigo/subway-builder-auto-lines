import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { LineExpansionPlanner } from '@/domain/line/LineExpansionPlanner'
import { StationIndex } from '@/domain/network/StationIndex'

// The lines that can actually grow right now. A line boxed in by the tracks around
// it has nothing to offer, so it never reaches the extend tab. One station index
// serves every line — building one per line is what would make this expensive.
export class ExtendableRoutes {
  static filter(state: GameState, routes: Route[]): Route[] {
    const index = StationIndex.build(state)

    return routes.filter((route) => LineExpansionPlanner.plan(state, route, index).hasAction())
  }
}
