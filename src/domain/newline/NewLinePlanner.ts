import type { StationIndex } from '@/domain/network/StationIndex'
import type { TrackNetwork } from '@/domain/network/TrackNetwork'

import { Corridor } from '@/domain/line/Corridor'
import { BranchExplorer } from '@/domain/network/BranchExplorer'

// A branch the line could follow at a fork: the corridor from the junction out to
// a reachable far terminus, walking straight past intermediate junctions. `name`
// labels it (first hop … terminus); `key` uniquely identifies the option.
export interface NewLineBranch {
  key: string
  name: string
  stationIds: string[]
}

export interface NewLineCorridor {
  forks: NewLineFork[]
  path: string[]
}

// A fork at one end of the base corridor: the junction and the branches the line
// could continue into. `end` says which end of the base path the branch attaches.
export interface NewLineFork {
  atName: string
  atStationId: string
  end: 'end' | 'start'
  options: NewLineBranch[]
}

export type NewLineForkChoices = Record<string, NewLineBranch | null | undefined>

// Plans the line for an orphan group: the longest degree-2 corridor plus, at each
// corridor end that is a junction, the branches the user can continue into
// (instead of the walk just stopping there). Pure: computes ids, mutates nothing.
export class NewLinePlanner {
  // station-node ids to add for an ordered corridor: both platforms for middle stations,
  // and at each end only the node facing into the path. Skipping the far end's
  // second node avoids the cycle-closing edge that would make a station appear 3×.
  static addStationNodeIds(network: TrackNetwork, index: StationIndex, path: string[]): string[] {
    const edgePair = (a: string, b: string): [string, string] | null => {
      const aNodes = index.stationById.get(a)?.stNodeIds ?? []
      const bNodes = new Set(index.stationById.get(b)?.stNodeIds ?? [])
      for (const aNode of aNodes) {
        for (const reached of network.adjacentStationNodeIds(aNode)) {
          if (bNodes.has(reached)) {
            return [aNode, reached]
          }
        }
      }

      return null
    }

    const addStationNodeIds: string[] = []
    const seen = new Set<string>()
    const push = (id: null | string | undefined): void => {
      if (id && !seen.has(id)) {
        seen.add(id)
        addStationNodeIds.push(id)
      }
    }

    if (path.length >= 2) {
      const bootstrap = edgePair(path[0], path[1]) // real adjacent pair
      if (bootstrap) {
        push(bootstrap[0])
        push(bootstrap[1])
      }
      for (let i = 1; i < path.length - 1; i++) {
        // middles: both platforms
        (index.stationById.get(path[i])?.stNodeIds ?? []).forEach(push)
      }
      const farEnd = edgePair(path[path.length - 1], path[path.length - 2]) // facing node only
      if (farEnd) {
        push(farEnd[0])
      }
    }

    return addStationNodeIds
  }

  static corridor(network: TrackNetwork, index: StationIndex, stationIds: string[]): NewLineCorridor {
    const groupSet = new Set(stationIds)
    const adjacency = new Map<string, Set<string>>()
    for (const stationId of stationIds) {
      adjacency.set(stationId, network.directNeighborsWithin(stationId, groupSet))
    }
    let path = Corridor.longest(stationIds, adjacency)
    const forks: NewLineFork[] = []
    if (path.length >= 2) {
      // Resolve each end: a single continuation is folded straight into the
      // corridor (nothing to choose), only a real bifurcation (2+ branches)
      // becomes a fork the user picks.
      path = this.resolveEnd(network, index, groupSet, path, 'start', forks)
      path = this.resolveEnd(network, index, groupSet, path, 'end', forks)
    }

    return { forks, path }
  }

  // The effective ordered corridor once the chosen branches are attached at the
  // ends. De-duplicates defensively (a cyclic group could loop a branch back).
  static effectivePath(corridor: NewLineCorridor, choices: NewLineForkChoices): string[] {
    let path = corridor.path.slice()
    for (const fork of corridor.forks) {
      const branch = choices[fork.atStationId]
      if (!branch) {
        continue
      }
      path = this.attach(path, branch.stationIds, fork.end)
    }
    const seen = new Set<string>()

    return path.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
  }

  // Attaches a branch to one end of the path (reversed at the start so the far
  // terminus stays outermost).
  private static attach(path: string[], branch: string[], end: NewLineFork['end']): string[] {
    return end === 'start' ? [...branch.slice().reverse(), ...path] : [...path, ...branch]
  }

  // The branches into which the region past a junction splits — one per end of the
  // tracks (leaf), so a loop/triangle divides into its distinct destinations.
  // `baseNeighbor` is the junction's neighbor along the base corridor: a branch
  // whose first hop leaves the junction on that same side is dropped, since taking
  // it would fold the line back on itself at the junction.
  private static branchesFrom(
    network: TrackNetwork,
    index: StationIndex,
    groupSet: Set<string>,
    pathSet: Set<string>,
    junction: string,
    baseNeighbor: string,
  ): NewLineBranch[] {
    // A step folds if the line prev → current → next bends back at `current`. At
    // the junction the incoming side is the base corridor (baseNeighbor); deeper
    // in the branch it's the station we came from.
    const folds = (prev: null | string, current: string, next: string): boolean => {
      const from = current === junction ? baseNeighbor : prev

      return from !== null && network.bendsBack(current, from, next)
    }
    const paths = BranchExplorer.leafPaths(
      junction,
      (id) => network.directNeighborsWithin(id, groupSet),
      pathSet,
      folds,
    )

    return paths
      .filter((stationIds) => stationIds.length > 0)
      .map((stationIds) => {
        const leaf = stationIds[stationIds.length - 1]

        return { key: leaf, name: index.name(leaf), stationIds }
      })
  }

  // Resolves one end of the corridor. With a single non-folding continuation it
  // extends the path straight through (no choice to offer); with two or more it
  // records a fork for the user to pick; with none it leaves the end as is.
  private static resolveEnd(
    network: TrackNetwork,
    index: StationIndex,
    groupSet: Set<string>,
    path: string[],
    end: NewLineFork['end'],
    forks: NewLineFork[],
  ): string[] {
    const junction = end === 'start' ? path[0] : path[path.length - 1]
    const baseNeighbor = end === 'start' ? path[1] : path[path.length - 2]
    const options = this.branchesFrom(network, index, groupSet, new Set(path), junction, baseNeighbor)
    if (options.length === 1) {
      return this.attach(path, options[0].stationIds, end)
    }
    if (options.length >= 2) {
      forks.push({ atName: index.name(junction), atStationId: junction, end, options })
    }

    return path
  }
}
