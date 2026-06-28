import type { StationIndex } from '@/domain/network/StationIndex'
import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'

const METERS_PER_DEGREE_LONGITUDE = 102_000
const METERS_PER_DEGREE_LATITUDE = 111_000
const PAIR_SEPARATOR = '|'
// A corridor hop whose rails run this many times longer than the straight line
// between its stations is a chord across a triangle (its apex sits off the group,
// e.g. a station already on another line): using it folds the line back on itself.
const MAX_DETOUR_RATIO = 1.6
// How far along the rails (meters) to sample a hop's leaving direction, so a tiny
// first segment doesn't skew it.
const DIRECTION_SAMPLE_METERS = 120

// Graph queries over the trackGraph for a given state + index. Pure reads; no
// mutation of the game. Both the coord-key format and every lookup come from the
// index, so there is no shared mutable state.
export class TrackNetwork {
  // Lazy caches for rail-geometry reconstruction (built once per network).
  private segmentByPair: Map<string, Coordinate[]> | null = null
  private stationKeys: null | Set<string> = null

  constructor(
    private readonly state: GameState,
    private readonly index: StationIndex,
  ) {}

  // Great-circle-ish planar distance in meters between two coords (lng/lat →
  // meters via fixed scale factors; good enough for terminus geometry).
  static distance(a: Coordinate, b: Coordinate): number {
    const dx = (a[0] - b[0]) * METERS_PER_DEGREE_LONGITUDE
    const dy = (a[1] - b[1]) * METERS_PER_DEGREE_LATITUDE
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Station nodes track-adjacent to a station node: BFS through plain track,
  // stopping at the first station node on each branch. Returns their ids.
  adjacentStationNodeIds(stationNodeId: string): string[] {
    const startStationNode = this.index.stationNodeById.get(stationNodeId)
    const graph = this.state.trackGraph
    if (!startStationNode || !graph || typeof graph.get !== 'function') {
      return []
    }

    const start = this.index.coordKey(startStationNode.center)
    const seen = new Set<string>([start])
    const queue: string[] = [start]
    const found: string[] = []

    while (queue.length) {
      const current = queue.shift() as string
      for (const edge of graph.get(current) ?? []) {
        const nextCoord = edge.coordsString
        if (seen.has(nextCoord)) {
          continue
        }
        seen.add(nextCoord)
        const stationNode = this.index.stationNodeByCoord.get(nextCoord)
        if (stationNode && stationNode.id !== stationNodeId) {
          found.push(stationNode.id)
        } else {
          queue.push(nextCoord)
        }
      }
    }
    return Array.from(new Set(found))
  }

  // True when a line running baseNeighbor → junction → forkNeighbor would bend
  // back on itself at the junction: both rails leave it on nearly the same
  // bearing, so the path folds instead of running through. Rejects fold-back forks.
  bendsBack(junction: string, baseNeighbor: string, forkNeighbor: string): boolean {
    const base = this.outboundDirection(junction, baseNeighbor)
    const fork = this.outboundDirection(junction, forkNeighbor)
    if (!base || !fork) {
      return false
    }
    return base[0] * fork[0] + base[1] * fork[1] > 0
  }

  // Neighbors within `within`, minus the ones only reachable by a big detour —
  // so a corridor built from this adjacency never folds back over a triangle.
  directNeighborsWithin(stationId: string, within: Set<string>): Set<string> {
    const result = new Set<string>()
    for (const neighbor of this.neighborStationsWithin(stationId, within)) {
      if (!this.isDetour(stationId, neighbor)) {
        result.add(neighbor)
      }
    }
    return result
  }

  // True when the rails between two adjacent stations run far longer than the
  // straight line between them — a fold-back chord (see MAX_DETOUR_RATIO).
  isDetour(stationIdA: string, stationIdB: string): boolean {
    const rail = this.railBetween(stationIdA, stationIdB)
    if (!rail || rail.length < 2) {
      return false
    }
    let length = 0
    for (let i = 0; i < rail.length - 1; i++) {
      length += TrackNetwork.distance(rail[i], rail[i + 1])
    }
    const direct = TrackNetwork.distance(rail[0], rail[rail.length - 1])
    return direct > 0 && length > direct * MAX_DETOUR_RATIO
  }

  // Stations reachable in one hop from `stationId` (via any of its platforms),
  // each mapped to the neighbor platform node that faces this station (first
  // wins). Callers restrict/exclude by their own station sets.
  neighborStationNodes(stationId: string): Map<string, string> {
    const station = this.index.stationById.get(stationId)
    const map = new Map<string, string>()
    for (const stationNodeId of station?.stNodeIds ?? []) {
      for (const adjacent of this.adjacentStationNodeIds(stationNodeId)) {
        const neighbor = this.index.stationOfNode.get(adjacent)
        if (neighbor && neighbor !== stationId && !map.has(neighbor)) {
          map.set(neighbor, adjacent)
        }
      }
    }
    return map
  }

  // Just the neighbor station ids that fall within `within`.
  neighborStationsWithin(stationId: string, within: Set<string>): Set<string> {
    const result = new Set<string>()
    for (const neighbor of this.neighborStationNodes(stationId).keys()) {
      if (within.has(neighbor)) {
        result.add(neighbor)
      }
    }
    return result
  }

  // The unit direction the rails leave `from` heading toward `to`, sampled a short
  // way along the path (DIRECTION_SAMPLE_METERS). Null if unknown.
  outboundDirection(from: string, to: string): [number, number] | null {
    const rail = this.railBetween(from, to)
    if (!rail || rail.length < 2) {
      return null
    }
    const origin = rail[0]
    let far = rail[rail.length - 1]
    for (let i = 1; i < rail.length; i++) {
      if (TrackNetwork.distance(origin, rail[i]) >= DIRECTION_SAMPLE_METERS) {
        far = rail[i]
        break
      }
    }
    const dx = (far[0] - origin[0]) * METERS_PER_DEGREE_LONGITUDE
    const dy = (far[1] - origin[1]) * METERS_PER_DEGREE_LATITUDE
    const magnitude = Math.hypot(dx, dy)
    return magnitude > 0 ? [dx / magnitude, dy / magnitude] : null
  }

  // The rail geometry between two adjacent stations: the real track coordinates
  // (curves included) along the graph path from a platform of A to a platform of
  // B, threading through the intermediate non-station track nodes. Null when no
  // such path exists (then callers fall back to a straight hop).
  //
  // A single BFS seeded from ALL of A's platforms at once finds the shortest path
  // to any of B's — so it can't pick a long way round from an arbitrary first
  // platform, which would make the result asymmetric (A→B ≠ B→A) and dodge the
  // detour test.
  railBetween(stationIdA: string, stationIdB: string): Coordinate[] | null {
    const graph = this.state.trackGraph
    if (!graph || typeof graph.get !== 'function') {
      return null
    }
    const starts = this.stationNodeKeysOf(stationIdA)
    const targets = this.stationNodeKeysOf(stationIdB)
    const stationKeys = this.allStationKeys()

    const parent = new Map<string, null | string>()
    const queue: string[] = []
    for (const start of starts) {
      parent.set(start, null)
      queue.push(start)
    }
    let reached: null | string = null

    while (queue.length) {
      const current = queue.shift() as string
      if (!starts.has(current) && targets.has(current)) {
        reached = current
        break
      }
      // Don't route through other stations — a corridor hop is A → track → B.
      if (!starts.has(current) && stationKeys.has(current)) {
        continue
      }
      for (const edge of graph.get(current) ?? []) {
        if (!parent.has(edge.coordsString)) {
          parent.set(edge.coordsString, current)
          queue.push(edge.coordsString)
        }
      }
    }

    if (reached === null) {
      return null
    }
    const keys: string[] = []
    for (let key: null | string = reached; key !== null; key = parent.get(key) ?? null) {
      keys.unshift(key)
    }
    return this.assembleGeometry(keys)
  }

  // The continuous rail polyline for an ordered list of stations: each adjacent
  // pair's real track geometry, joined end to end (straight hop as a fallback).
  railPath(stationIds: string[]): Coordinate[] {
    const polyline: Coordinate[] = []
    for (let i = 0; i < stationIds.length - 1; i++) {
      let segment = this.railBetween(stationIds[i], stationIds[i + 1])
      if (!segment || segment.length < 2) {
        const a = this.index.coordinate(stationIds[i])
        const b = this.index.coordinate(stationIds[i + 1])
        segment = a && b ? [a, b] : null
      }
      if (segment) {
        appendSegment(polyline, segment)
      }
    }
    return polyline
  }

  private allStationKeys(): Set<string> {
    if (!this.stationKeys) {
      this.stationKeys = new Set(this.index.stationNodeByCoord.keys())
    }
    return this.stationKeys
  }

  private assembleGeometry(keys: string[]): Coordinate[] {
    const segments = this.segments()
    const polyline: Coordinate[] = []
    for (let i = 0; i < keys.length - 1; i++) {
      const segment = segments.get(keys[i] + PAIR_SEPARATOR + keys[i + 1])
      if (segment) {
        appendSegment(polyline, segment)
      }
    }
    return polyline
  }

  // Track coordinates indexed by the ordered coord-key pair of their endpoints
  // (both directions), so a graph edge's real geometry is a direct lookup.
  private segments(): Map<string, Coordinate[]> {
    if (this.segmentByPair) {
      return this.segmentByPair
    }
    const map = new Map<string, Coordinate[]>()
    for (const track of this.state.tracks ?? []) {
      const coords = track.coords
      if (!coords || coords.length < 2) {
        continue
      }
      const from = this.index.coordKey(coords[0])
      const to = this.index.coordKey(coords[coords.length - 1])
      map.set(from + PAIR_SEPARATOR + to, coords)
      map.set(to + PAIR_SEPARATOR + from, [...coords].reverse())
    }
    this.segmentByPair = map
    return map
  }

  private stationNodeKeysOf(stationId: string): Set<string> {
    const keys = new Set<string>()
    for (const stationNodeId of this.index.stationById.get(stationId)?.stNodeIds ?? []) {
      const center = this.index.stationNodeById.get(stationNodeId)?.center
      if (center) {
        keys.add(this.index.coordKey(center))
      }
    }
    return keys
  }
}

// Appends a segment to a polyline, dropping the shared join point so the line
// stays a clean sequence with no doubled vertices.
function appendSegment(polyline: Coordinate[], segment: Coordinate[]): void {
  const last = polyline[polyline.length - 1]
  const start = last && last[0] === segment[0][0] && last[1] === segment[0][1] ? 1 : 0
  for (let i = start; i < segment.length; i++) {
    polyline.push(segment[i])
  }
}
