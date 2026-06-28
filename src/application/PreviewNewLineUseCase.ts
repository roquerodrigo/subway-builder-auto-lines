import type { NewLineCorridor } from '@/domain/newline/NewLinePlanner'
import type { GameStore } from '@/infrastructure/store/GameStore'
import type { Coordinate } from '@/shared/game/Coordinate'

import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { LineColorPalette } from '@/domain/newline/LineColorPalette'
import { NewLinePlanner } from '@/domain/newline/NewLinePlanner'

export interface NewLinePreview {
  corridor: NewLineCorridor // base path + the forks the user can continue into
  nameById: Record<string, string>
  coordById: Record<string, Coordinate>
  railPath: (stationIds: string[]) => Coordinate[]
  color: string // chosen here and passed to CreateNewLine, so preview == result
  groupSize: number
}

// Computes the line that would be built from an orphan group WITHOUT touching the
// game — no route is generated and nothing is drawn on the map, so browsing groups
// leaves no ghost line. The real route is only built on commit (CreateNewLine).
export class PreviewNewLineUseCase {
  constructor(private readonly store: GameStore) {}

  execute(stationIds: string[]): NewLinePreview {
    const state = this.store.state()
    const index = StationIndex.build(state)
    const network = new TrackNetwork(state, index)
    const corridor = NewLinePlanner.corridor(network, index, stationIds)
    const nameById: Record<string, string> = {}
    const coordById: Record<string, Coordinate> = {}
    for (const stationId of stationIds) {
      nameById[stationId] = index.stationById.get(stationId)?.name ?? '?'
      const coordinate = index.coordinate(stationId)
      if (coordinate) {
        coordById[stationId] = coordinate
      }
    }
    const usedColors = new Set((state.routes ?? []).map((route) => route.color ?? '').filter(Boolean))
    return {
      color: LineColorPalette.pick(usedColors, Math.random()),
      coordById,
      corridor,
      groupSize: stationIds.length,
      nameById,
      railPath: (ids) => network.railPath(ids),
    }
  }
}
