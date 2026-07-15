import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { type Endpoint, ExpansionPlan, type Fork, type ForkOption } from '@/domain/line/ExpansionPlan'
import { BranchExplorer } from '@/domain/network/BranchExplorer'
import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'

// Walks each endpoint of a line outward along its corridor: follows
// single continuations as far as possible (auto chain), stopping at a fork (to
// offer the choice) or a dead-end. Each passed-through station becomes a
// through-station (both platforms); the current end stays a single-platform terminus
// until extended past it. Pure: reads state, returns a plan, mutates nothing.
export class LineExpansionPlanner {
  static plan(state: GameState, route: Route): ExpansionPlan {
    const index = StationIndex.build(state)
    const network = new TrackNetwork(state, index)

    const lineStationNodeIds = new Set(route.stNodes.map((stationNode) => stationNode.id))
    const lineStationIds = new Set<string>()
    for (const stationNodeId of lineStationNodeIds) {
      const stationId = index.stationOfNode.get(stationNodeId)
      if (stationId) {
        lineStationIds.add(stationId)
      }
    }

    // Next stations from a station, excluding `skip`, each with the connecting node.
    const nextStations = (stationId: string, skip: Set<string>): Map<string, string> => {
      const map = new Map<string, string>()
      for (const [neighbor, node] of network.neighborStationNodes(stationId)) {
        if (!skip.has(neighbor)) {
          map.set(neighbor, node)
        }
      }

      return map
    }

    // Outward continuations only: next stations that would NOT fold the line back
    // on itself. A candidate adjacent to an already-visited station other than
    // `stationId` is a chord/loop (e.g. a triangle) and is dropped — extending
    // into it makes the line zig-zag back over territory it already covers.
    const outwardStations = (stationId: string, visited: Set<string>): Map<string, string> => {
      const map = new Map<string, string>()
      for (const [neighbor, node] of nextStations(stationId, visited)) {
        let foldsBack = false
        for (const back of network.neighborStationNodes(neighbor).keys()) {
          if (back !== stationId && visited.has(back)) {
            foldsBack = true
            break
          }
        }
        if (!foldsBack) {
          map.set(neighbor, node)
        }
      }

      return map
    }

    const endpoints: Endpoint[] = []
    for (const stationId of lineStationIds) {
      // terminus = at most one in-line neighbor
      if (network.neighborStationsWithin(stationId, lineStationIds).size > 1) {
        continue
      }

      const station = index.stationById.get(stationId)
      if (!station) {
        continue
      }

      const visited = new Set(lineStationIds)
      const autoNames: string[] = []
      const autoStationNodeIds: string[] = []
      const autoStationIds: string[] = []
      let current = stationId
      let inwardStationNode = (station.stNodeIds ?? []).find((id) => lineStationNodeIds.has(id))
      let fork: Fork | null = null

      for (;;) {
        const nexts = outwardStations(current, visited)
        if (nexts.size === 0) {
          break
        } // dead-end
        if (nexts.size > 1) {
          // fork — offer one branch per end of the tracks past `current`, each
          // followed all the way to its terminus (like the new-line tab).
          const forkStation = current
          const forkInward = inwardStationNode
          const branches = BranchExplorer.leafPaths(
            forkStation,
            (id) => outwardStations(id, visited).keys(),
            visited,
          )
          const options: ForkOption[] = branches.map((branchPath) =>
            this.branchOption(network, index, lineStationNodeIds, forkStation, forkInward, branchPath),
          )
          if (options.length) {
            fork = { atName: index.name(forkStation), options }
          }
          break
        }

        // exactly one continuation: extend
        const [nextId, connStationNode] = [...nexts][0]
        for (const id of this.throughStationNodes(index, lineStationNodeIds, current, inwardStationNode)) {
          if (autoStationNodeIds.indexOf(id) < 0) {
            autoStationNodeIds.push(id)
          } // current becomes through
        }
        autoStationNodeIds.push(connStationNode) // next: single-platform terminus (for now)
        autoNames.push(index.name(nextId))
        autoStationIds.push(nextId)
        visited.add(nextId)
        inwardStationNode = connStationNode
        current = nextId
      }

      if (autoNames.length || fork) {
        endpoints.push({ autoNames, autoStationIds, autoStationNodeIds, fork, name: station.name, stationId })
      }
    }

    return new ExpansionPlan(index, lineStationNodeIds, lineStationIds, endpoints)
  }

  // The add-node ids for a full branch off `forkStation`: walking the branch, each
  // passed-through station gets its other platform and every station its facing
  // platform, so the leaf ends up a single-platform terminus.
  private static branchOption(
    network: TrackNetwork,
    index: StationIndex,
    lineStationNodeIds: Set<string>,
    forkStation: string,
    forkInward: string | undefined,
    branchPath: string[],
  ): ForkOption {
    const applyStationNodeIds: string[] = []
    const push = (id: string | undefined): void => {
      if (id && applyStationNodeIds.indexOf(id) < 0) {
        applyStationNodeIds.push(id)
      }
    }

    let cur = forkStation
    let inward = forkInward
    for (const next of branchPath) {
      const connStationNode = network.neighborStationNodes(cur).get(next)
      this.throughStationNodes(index, lineStationNodeIds, cur, inward).forEach(push) // cur becomes a through-station
      push(connStationNode) // next: facing platform (single-platform terminus until passed)
      inward = connStationNode
      cur = next
    }

    const leaf = branchPath[branchPath.length - 1]

    return {
      applyStationNodeIds,
      name: index.name(leaf),
      stationId: leaf,
      stationIds: branchPath,
    }
  }

  // Through-station nodes of a station not yet in the line, given the inward node.
  private static throughStationNodes(
    index: StationIndex,
    lineStationNodeIds: Set<string>,
    stationId: string,
    inward: string | undefined,
  ): string[] {
    return (index.stationById.get(stationId)?.stNodeIds ?? []).filter(
      (id) => id !== inward && !lineStationNodeIds.has(id),
    )
  }
}
