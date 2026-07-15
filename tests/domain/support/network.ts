import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'
import type { Station } from '@/shared/game/Station'
import type { StationNode } from '@/shared/game/StationNode'
import type { Track, TrackGraphEdge } from '@/shared/game/Track'

import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'

// The two trackGraph key formats the game has shipped (see domain/network/CoordinateKey).
export type CoordinateKeyFormat = 'dashed' | 'prefixed'

export interface LinkSpec {
  between: [string, string]
  // Plain (non-station) graph vertices the rails run through, so one hop becomes
  // several graph edges — the game's track-level junctions.
  junctions?: Coordinate[]
  // Track-shape vertices: they bend the rail geometry without becoming graph
  // vertices, so the hop stays a single graph edge — how a curve or a detour is
  // modelled. Ignored when `junctions` is given.
  shape?: Coordinate[]
}

export interface NetworkFixture {
  index: StationIndex
  network: TrackNetwork
  state: GameState
}

export interface NetworkSpec {
  // Stations whose two platforms are joined by a turnaround edge.
  crossovers?: string[]
  keyFormat?: CoordinateKeyFormat
  links?: LinkSpec[]
  stations: StationSpec[]
}

export interface StationSpec {
  at: Coordinate
  id: string
  name?: string
  routeIds?: string[]
}

// Half the gap between a station's two platform nodes, in degrees (~2 m) — small
// enough that it never disturbs the geometry under test, large enough that the two
// platforms never share a coord key.
const PLATFORM_OFFSET_DEGREES = 0.00002

// One grid unit, in degrees: ~1.0 km east / ~1.1 km north. Far past the 120 m the
// direction sampler needs, so every bearing in a fixture is unambiguous.
const GRID_UNIT_DEGREES = 0.01

// A GameState whose stations each own two platform nodes ('<id>#1' / '<id>#2'),
// joined by one track per platform side, with a trackGraph in the game's own key
// format. Everything the domain reads is real data — nothing is stubbed.
export function buildNetwork(spec: NetworkSpec): GameState {
  const keyOf = coordinateKey(spec.keyFormat)
  const stations: Station[] = []
  const stationNodes: StationNode[] = []
  const platformsByStation = new Map<string, Coordinate[]>()

  for (const station of spec.stations) {
    const platforms: Coordinate[] = [
      [station.at[0], station.at[1] + PLATFORM_OFFSET_DEGREES],
      [station.at[0], station.at[1] - PLATFORM_OFFSET_DEGREES],
    ]
    platformsByStation.set(station.id, platforms)
    const nodeIds = [station.id + '#1', station.id + '#2']
    nodeIds.forEach((id, side) => stationNodes.push({ center: platforms[side], id, trackIds: [] }))
    stations.push({
      id: station.id,
      name: station.name ?? station.id.toUpperCase(),
      routeIds: station.routeIds ?? [],
      stNodeIds: nodeIds,
    })
  }

  const tracks: Track[] = []
  const graph = new Map<string, TrackGraphEdge[]>()
  const built = new Set<string>()

  const connect = (coords: Coordinate[]): void => {
    const from = keyOf(coords[0])
    const to = keyOf(coords[coords.length - 1])
    if (built.has(from + '>' + to)) {
      return
    }
    built.add(from + '>' + to)
    built.add(to + '>' + from)
    tracks.push({ coords, id: 'track-' + tracks.length, reversable: true })
    for (const [tail, head] of [[from, to], [to, from]]) {
      const edges = graph.get(tail) ?? []
      edges.push({ coordsString: head })
      graph.set(tail, edges)
    }
  }

  const platformsOf = (stationId: string): Coordinate[] => {
    const found = platformsByStation.get(stationId)
    if (!found) {
      throw new Error('the spec links an unknown station: ' + stationId)
    }

    return found
  }

  for (const link of spec.links ?? []) {
    const [from, to] = link.between
    for (const side of [0, 1]) {
      const offset = side === 0 ? PLATFORM_OFFSET_DEGREES : -PLATFORM_OFFSET_DEGREES
      const lift = (coord: Coordinate): Coordinate => [coord[0], coord[1] + offset]
      const stops = [platformsOf(from)[side], ...(link.junctions ?? []).map(lift), platformsOf(to)[side]]
      const shape = link.junctions?.length ? [] : (link.shape ?? []).map(lift)
      for (let i = 0; i < stops.length - 1; i++) {
        connect([stops[i], ...(i === 0 ? shape : []), stops[i + 1]])
      }
    }
  }

  for (const stationId of spec.crossovers ?? []) {
    const platforms = platformsOf(stationId)
    connect([platforms[0], platforms[1]])
  }

  return {
    money: 0,
    ownedTrainCount: 30,
    routes: [],
    stations,
    stNodes: stationNodes,
    trackGraph: graph,
    tracks,
  }
}

export function coordinateKey(format: CoordinateKeyFormat = 'prefixed'): (coord: Coordinate) => string {
  return format === 'prefixed' ?
      (coord): string => 'S' + coord[0] + coord[1] :
      (coord): string => coord[0] + '-' + coord[1]
}

export function networkOf(spec: NetworkSpec): NetworkFixture {
  const state = buildNetwork(spec)
  const index = StationIndex.build(state)

  return { index, network: new TrackNetwork(state, index), state }
}

// A point on the fixture grid: `east`/`north` in grid units (~1 km each).
export function point(east: number, north: number): Coordinate {
  return [east * GRID_UNIT_DEGREES, north * GRID_UNIT_DEGREES]
}
