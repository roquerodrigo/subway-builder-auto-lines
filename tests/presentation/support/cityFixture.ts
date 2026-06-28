import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'
import type { Station } from '@/shared/game/Station'
import type { StationNode } from '@/shared/game/StationNode'
import type { Track, TrackGraphEdge } from '@/shared/game/Track'

export interface StationSpec {
  id: string
  name: string
  center: Coordinate
  routeIds?: string[]
}

export interface CitySpec {
  stations: StationSpec[]
  links: [string, string][]
  routes?: Route[]
}

// How far each of a station's two platforms sits from its center, in degrees of
// longitude. Only has to be big enough to give the two platforms distinct coord
// keys and a sane rail direction.
const PLATFORM_OFFSET_DEGREES = 0.001

const coordinateKey = (coordinate: Coordinate): string => 'S' + coordinate[0] + coordinate[1]

// Builds the GameState snapshot the domain reads: two platform nodes per station,
// a straight track per link, and the coord-keyed trackGraph the game exposes.
export function buildCity(spec: CitySpec): GameState {
  const stations: Station[] = []
  const stationNodes: StationNode[] = []
  const platformIdsByStation = new Map<string, [string, string]>()
  const centerByPlatform = new Map<string, Coordinate>()

  for (const station of spec.stations) {
    const platforms: [string, string] = [station.id + '-a', station.id + '-b']
    const centers: [Coordinate, Coordinate] = [
      [station.center[0] - PLATFORM_OFFSET_DEGREES, station.center[1]],
      [station.center[0] + PLATFORM_OFFSET_DEGREES, station.center[1]],
    ]
    platforms.forEach((platform, side) => {
      centerByPlatform.set(platform, centers[side])
      stationNodes.push({ center: centers[side], id: platform })
    })
    platformIdsByStation.set(station.id, platforms)
    stations.push({
      id: station.id,
      name: station.name,
      routeIds: station.routeIds ?? [],
      stNodeIds: platforms,
    })
  }

  // Platforms are handed out in link order — first link takes the inbound
  // platform, the rest share the outbound one. That is what makes a third link
  // read as a fork off one platform rather than an impossible third platform.
  const linksTaken = new Map<string, number>()
  const takePlatform = (stationId: string): string => {
    const taken = linksTaken.get(stationId) ?? 0
    linksTaken.set(stationId, taken + 1)
    const platforms = platformIdsByStation.get(stationId)
    if (!platforms) {
      throw new Error('Unknown station in link: ' + stationId)
    }
    return platforms[Math.min(taken, 1)]
  }

  const tracks: Track[] = []
  const trackGraph = new Map<string, TrackGraphEdge[]>()
  const connect = (from: Coordinate, to: Coordinate): void => {
    const key = coordinateKey(from)
    const edges = trackGraph.get(key) ?? []
    edges.push({ coordsString: coordinateKey(to) })
    trackGraph.set(key, edges)
  }

  spec.links.forEach(([fromStation, toStation], index) => {
    const from = centerByPlatform.get(takePlatform(fromStation)) as Coordinate
    const to = centerByPlatform.get(takePlatform(toStation)) as Coordinate
    tracks.push({ coords: [from, to], id: 'track-' + index })
    connect(from, to)
    connect(to, from)
  })

  return {
    money: 0,
    ownedTrainCount: 0,
    routes: spec.routes ?? [],
    stations,
    stNodes: stationNodes,
    trackGraph,
    tracks,
  }
}

// A route over the given platform nodes. Only their ids are read — the planner
// maps each back to its station — so the centers are placeholders.
export function buildRoute(id: string, bullet: string, color: string, stationNodeIds: string[]): Route {
  return {
    bullet,
    color,
    id,
    stNodes: stationNodeIds.map((stationNodeId) => ({ center: [0, 0], id: stationNodeId })),
  }
}

export function centerOf(spec: CitySpec, stationId: string): Coordinate {
  const station = spec.stations.find((candidate) => candidate.id === stationId)
  if (!station) {
    throw new Error('Unknown station: ' + stationId)
  }
  return station.center
}

export function nameById(spec: CitySpec): Record<string, string> {
  return Object.fromEntries(spec.stations.map((station) => [station.id, station.name]))
}

// Line 1 stops at Bravo, one hop short of the unserved Charlie–Delta corridor.
export const LINE_ONE = buildRoute('r1', '1', '#ff0000', ['s1-a', 's2-a'])

// Line 2 already covers the whole Golf–Hotel dead-end: nothing left to extend.
export const LINE_TWO = buildRoute('r2', '2', '#00ff00', ['s7-a', 's8-a'])

// One city that exercises both tabs. Line 1 can grow along Charlie–Delta up to
// the fork into Echo/Foxtrot; line 2 has nowhere to go. Charlie–Delta–Echo/Foxtrot
// and India–Juliett are unserved, so the new-line tab sees two groups.
export const CITY: CitySpec = {
  links: [
    ['s1', 's2'],
    ['s2', 's3'],
    ['s3', 's4'],
    ['s4', 's5'],
    ['s4', 's6'],
    ['s7', 's8'],
    ['s9', 's10'],
  ],
  routes: [LINE_ONE, LINE_TWO],
  stations: [
    { center: [1, 0], id: 's1', name: 'Alpha', routeIds: ['r1'] },
    { center: [2, 0], id: 's2', name: 'Bravo', routeIds: ['r1'] },
    { center: [3, 0], id: 's3', name: 'Charlie' },
    { center: [4, 0], id: 's4', name: 'Delta' },
    { center: [5, 0.1], id: 's5', name: 'Echo' },
    { center: [5, -0.1], id: 's6', name: 'Foxtrot' },
    { center: [8, 0], id: 's7', name: 'Golf', routeIds: ['r2'] },
    { center: [9, 0], id: 's8', name: 'Hotel', routeIds: ['r2'] },
    { center: [11, 0], id: 's9', name: 'India' },
    { center: [12, 0], id: 's10', name: 'Juliett' },
  ],
}

export const EMPTY_CITY: CitySpec = { links: [], routes: [], stations: [] }
