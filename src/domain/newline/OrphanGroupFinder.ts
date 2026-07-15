import type { GameState } from '@/shared/game/GameState'

import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { NewLinePlanner } from '@/domain/newline/NewLinePlanner'
import { OrphanGroup } from '@/domain/newline/OrphanGroup'

// Finds connected components (>=2) of stations that belong to no route, linked
// only through other orphans (never pulls in stations that already have a line).
// Largest first. Pure read over a GameState snapshot.
export class OrphanGroupFinder {
  static find(state: GameState): OrphanGroup[] {
    const index = StationIndex.build(state)
    const network = new TrackNetwork(state, index)

    const orphan = new Set<string>()
    for (const station of state.stations ?? []) {
      if (!station.routeIds || station.routeIds.length === 0) {
        orphan.add(station.id)
      }
    }

    const seen = new Set<string>()
    const groups: OrphanGroup[] = []
    for (const stationId of orphan) {
      if (seen.has(stationId)) {
        continue
      }
      const component: string[] = []
      const queue = [stationId]
      seen.add(stationId)
      while (queue.length) {
        const current = queue.shift() as string
        component.push(current)
        network.neighborStationsWithin(current, orphan).forEach((neighbor) => {
          if (!seen.has(neighbor)) {
            seen.add(neighbor)
            queue.push(neighbor)
          }
        })
      }
      if (component.length >= 2) {
        const names = component.map((id) => index.name(id))
        groups.push(new OrphanGroup(component, names, this.terminals(index, network, component)))
      }
    }

    groups.sort((a, b) => b.stationIds.length - a.stationIds.length)

    return groups
  }

  private static terminals(
    index: StationIndex,
    network: TrackNetwork,
    stationIds: string[],
  ): [string, string] | null {
    // Name the group by the very corridor the preview builds (base plus the
    // single continuations it folds in), so the label always matches the preview.
    const path = NewLinePlanner.corridor(network, index, stationIds).path
    if (path.length < 2) {
      return null
    }

    return [index.name(path[0]), index.name(path[path.length - 1])]
  }
}
