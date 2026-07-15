import type { StationIndex } from '@/domain/network/StationIndex'
import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'
import type { Track } from '@/shared/game/Track'

import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { DEFAULT_TRAIN_TYPE } from '@/shared/game/constants'

const CROSSOVER_TYPE = 'scissors-crossover'
const CROSSOVER_CONSTRUCTION = 'constructed'

interface FarEnd {
  coord: Coordinate
  elevation: number | undefined
  trackType: string | undefined
}

// Builds the terminus turnaround edge. Game 1.4.10 gates auto-crossovers behind a
// Settings toggle that ships OFF, so a freshly-drawn station has no reversal edge
// and a route's turnaround path fails. This fabricates a reversable scissors-
// crossover joining a terminus station's two platform tracks at their far-from-
// neighbor ends. Returns the track to inject, or null if impossible / already
// linked (so injecting it is a safe no-op when a crossover already exists).
export class TerminusCrossoverFactory {
  static create(
    state: GameState,
    index: StationIndex,
    terminusStationId: string,
    neighborStationId: string,
  ): null | Track {
    const station = index.stationById.get(terminusStationId)
    const neighbor = index.stationById.get(neighborStationId)
    if (!station || !neighbor) {
      return null
    }

    const neighborNode = index.stationNodeById.get((neighbor.stNodeIds ?? [])[0])
    if (!neighborNode) {
      return null
    }
    const neighborCoord = neighborNode.center

    const trackById = new Map(state.tracks.map((track) => [track.id, track] as const))
    const fars: FarEnd[] = []
    for (const stationNodeId of station.stNodeIds ?? []) {
      const stationNode = index.stationNodeById.get(stationNodeId)
      if (!stationNode) {
        continue
      }
      const halves = (stationNode.trackIds ?? [])
        .map((id) => trackById.get(id))
        .filter((track): track is Track => !!track)
      if (!halves.length) {
        continue
      }
      const ends: Coordinate[] = []
      for (const half of halves) {
        ends.push(half.coords[0])
        ends.push(half.coords[half.coords.length - 1])
      }
      // farthest from the neighbor first
      ends.sort((p, q) => TrackNetwork.distance(q, neighborCoord) - TrackNetwork.distance(p, neighborCoord))
      fars.push({ coord: ends[0], elevation: halves[0].startElevation, trackType: halves[0].trackType })
    }
    if (fars.length < 2) {
      return null
    }

    const c1 = fars[0].coord
    const c2 = fars[1].coord
    if (c1[0] === c2[0] && c1[1] === c2[1]) {
      return null
    }

    const key1 = index.coordKey(c1)
    const key2 = index.coordKey(c2)
    const graph = state.trackGraph
    if (graph && (graph.get(key1) ?? []).some((edge) => edge.coordsString === key2)) {
      return null
    } // already linked

    const distance = TrackNetwork.distance(c1, c2)
    const uid =
      typeof crypto !== 'undefined' && crypto.randomUUID ?
          crypto.randomUUID() :
        'xover-' + Date.now() + '-' + Math.floor(distance * 1000)

    return {
      buildType: CROSSOVER_CONSTRUCTION,
      coords: [c1, c2],
      createdAt: Date.now(),
      displayType: CROSSOVER_CONSTRUCTION,
      endElevation: fars[1].elevation ?? 0,
      id: uid,
      interactable: false,
      length: Math.max(1, distance),
      reversable: true,
      startElevation: fars[0].elevation ?? 0,
      trackType: fars[0].trackType || DEFAULT_TRAIN_TYPE,
      type: CROSSOVER_TYPE,
      waterIntersectionPercentage: 0,
    }
  }
}
