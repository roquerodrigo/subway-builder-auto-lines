import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'
import type { Station } from '@/shared/game/Station'
import type { StationNode } from '@/shared/game/StationNode'

import { type CoordinateKeyFn, detectCoordinateKey } from '@/domain/network/CoordinateKey'

// Lookup tables over a GameState snapshot: station nodes and stations by id,
// station node by coord key, and the station that owns each station node. Detects
// the coord-key format once at build time and carries it as `coordKey` — no hidden
// mutable module global.
export class StationIndex {
  private constructor(
    readonly coordKey: CoordinateKeyFn,
    readonly stationNodeById: Map<string, StationNode>,
    readonly stationNodeByCoord: Map<string, StationNode>,
    readonly stationOfNode: Map<string, string>,
    readonly stationById: Map<string, Station>,
  ) {}

  static build(state: GameState): StationIndex {
    const coordKey = detectCoordinateKey(state)
    const stationNodeById = new Map<string, StationNode>()
    const stationNodeByCoord = new Map<string, StationNode>()
    const stationOfNode = new Map<string, string>()
    const stationById = new Map<string, Station>()

    for (const stationNode of state.stNodes ?? []) {
      stationNodeById.set(stationNode.id, stationNode)
      stationNodeByCoord.set(coordKey(stationNode.center), stationNode)
    }
    for (const station of state.stations ?? []) {
      stationById.set(station.id, station)
      for (const stationNodeId of station.stNodeIds ?? []) {
        stationOfNode.set(stationNodeId, station.id)
      }
    }

    return new StationIndex(coordKey, stationNodeById, stationNodeByCoord, stationOfNode, stationById)
  }

  // A station's map position: the centroid of its platform nodes ([lng, lat]).
  coordinate(stationId: string): Coordinate | undefined {
    const centers = (this.stationById.get(stationId)?.stNodeIds ?? [])
      .map((id) => this.stationNodeById.get(id)?.center)
      .filter((c): c is Coordinate => !!c)
    if (!centers.length) {
      return undefined
    }
    const lng = centers.reduce((sum, c) => sum + c[0], 0) / centers.length
    const lat = centers.reduce((sum, c) => sum + c[1], 0) / centers.length
    return [lng, lat]
  }

  // A station's display name, or '?' when it is missing from the index.
  name(stationId: string): string {
    return this.stationById.get(stationId)?.name ?? '?'
  }
}
