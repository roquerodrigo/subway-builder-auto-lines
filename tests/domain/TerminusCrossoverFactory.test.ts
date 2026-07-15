import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'
import type { StationNode } from '@/shared/game/StationNode'
import type { Track, TrackGraphEdge } from '@/shared/game/Track'

import { TerminusCrossoverFactory } from '@/domain/crossover/TerminusCrossoverFactory'
import { StationIndex } from '@/domain/network/StationIndex'

const PLATFORM_HALF_LENGTH = 0.0005
const PLATFORM_OFFSET = 0.00002

interface TerminusSpec {
  ghostPlatform?: boolean
  linkFarEnds?: boolean
  neighborAt?: Coordinate
  platforms?: number
  platformSpread?: number
  startElevation?: number | undefined
  tracklessPlatform?: boolean
  trackType?: null | string
}

function crossoverFor(state: GameState, terminus = 'terminus', neighbor = 'neighbor'): null | Track {
  return TerminusCrossoverFactory.create(state, StationIndex.build(state), terminus, neighbor)
}

// A terminus station at the origin with two platform tracks running east–west, and
// a neighbor station the crossover has to orient itself against.
function terminusState(spec: TerminusSpec = {}): GameState {
  const neighborCenter = spec.neighborAt ?? [0.01, 0]
  const spread = spec.platformSpread ?? PLATFORM_OFFSET
  const tracks: Track[] = []
  const stationNodes: StationNode[] = []
  const platformIds: string[] = []

  for (let side = 0; side < (spec.platforms ?? 2); side++) {
    const lat = side === 0 ? spread : -spread
    const trackId = 'platform-' + side + '@@1'
    if (!spec.tracklessPlatform) {
      tracks.push({
        coords: [[-PLATFORM_HALF_LENGTH, lat], [PLATFORM_HALF_LENGTH, lat]],
        id: trackId,
        startElevation: spec.startElevation,
        trackType: spec.trackType === null ? undefined : spec.trackType ?? 'heavy-metro',
        type: 'station',
      })
    }
    platformIds.push('t#' + side)
    stationNodes.push({ center: [0, lat], id: 't#' + side, trackIds: [trackId] })
  }
  if (spec.ghostPlatform) {
    platformIds.push('t#gone')
  }

  stationNodes.push({ center: neighborCenter, id: 'n#0', trackIds: [] })

  const graph = new Map<string, TrackGraphEdge[]>()
  if (spec.linkFarEnds) {
    const key = (coord: Coordinate): string => 'S' + coord[0] + coord[1]
    graph.set(key([-PLATFORM_HALF_LENGTH, spread]), [{ coordsString: key([-PLATFORM_HALF_LENGTH, -spread]) }])
  }

  return {
    money: 0,
    ownedTrainCount: 0,
    stations: [
      { id: 'terminus', name: 'Terminus', stNodeIds: platformIds },
      { id: 'neighbor', name: 'Neighbor', stNodeIds: ['n#0'] },
    ],
    stNodes: stationNodes,
    trackGraph: graph,
    tracks,
  }
}

function withNeighborPlatforms(state: GameState, stNodeIds: string[] | undefined): GameState {
  return {
    ...state,
    stations: (state.stations ?? []).map((station) =>
      station.id === 'neighbor' ? { ...station, stNodeIds } : station),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TerminusCrossoverFactory.create', () => {
  // Without this edge a train can't cross from the inbound to the outbound track,
  // and the route's turnaround path fails outright.
  it('joins the two platform ends that face away from the neighbor', () => {
    const crossover = crossoverFor(terminusState())
    expect(crossover?.coords).toEqual([
      [-PLATFORM_HALF_LENGTH, PLATFORM_OFFSET],
      [-PLATFORM_HALF_LENGTH, -PLATFORM_OFFSET],
    ])
  })

  it('swings to the other end when the neighbor sits on the other side', () => {
    const crossover = crossoverFor(terminusState({ neighborAt: [-0.01, 0] }))
    expect(crossover?.coords).toEqual([
      [PLATFORM_HALF_LENGTH, PLATFORM_OFFSET],
      [PLATFORM_HALF_LENGTH, -PLATFORM_OFFSET],
    ])
  })

  // The pathfinder only needs a reversable edge whose endpoints land exactly on
  // the existing track ends; the scissors shape itself is cosmetic.
  it('builds a reversable, non-interactable scissors crossover', () => {
    const crossover = crossoverFor(terminusState())
    expect(crossover?.type).toBe('scissors-crossover')
    expect(crossover?.reversable).toBe(true)
    expect(crossover?.interactable).toBe(false)
    expect(crossover?.buildType).toBe('constructed')
    expect(crossover?.displayType).toBe('constructed')
  })

  it('carries the elevation and track type of the platform it springs from', () => {
    const crossover = crossoverFor(terminusState({ startElevation: 12, trackType: 'light-rail' }))
    expect(crossover?.startElevation).toBe(12)
    expect(crossover?.endElevation).toBe(12)
    expect(crossover?.trackType).toBe('light-rail')
  })

  it('falls back to ground level and the default train type', () => {
    const crossover = crossoverFor(terminusState({ startElevation: undefined, trackType: null }))
    expect(crossover?.startElevation).toBe(0)
    expect(crossover?.endElevation).toBe(0)
    expect(crossover?.trackType).toBe('heavy-metro')
  })

  it('measures its own length', () => {
    const crossover = crossoverFor(terminusState({ platformSpread: 0.001 }))
    expect(crossover?.length).toBeCloseTo(0.002 * 111_000, 0)
  })

  // The game reads `length` for pathing cost, and platforms drawn almost on top
  // of each other would otherwise hand it a zero-length edge.
  it('never reports a length below one metre', () => {
    expect(crossoverFor(terminusState({ platformSpread: 0.000002 }))?.length).toBe(1)
  })

  it('is null for a terminus the index has never seen', () => {
    expect(crossoverFor(terminusState(), 'nowhere')).toBeNull()
  })

  it('is null for a neighbor the index has never seen', () => {
    expect(crossoverFor(terminusState(), 'terminus', 'nowhere')).toBeNull()
  })

  it('is null when the neighbor has no platform to orient against', () => {
    expect(crossoverFor(withNeighborPlatforms(terminusState(), []))).toBeNull()
  })

  it('is null when the neighbor lists no platforms at all', () => {
    expect(crossoverFor(withNeighborPlatforms(terminusState(), undefined))).toBeNull()
  })

  it('is null when the terminus has only one platform to join', () => {
    expect(crossoverFor(terminusState({ platforms: 1 }))).toBeNull()
  })

  it('is null when the terminus has an empty platform list', () => {
    expect(crossoverFor(terminusState({ platforms: 0 }))).toBeNull()
  })

  it('is null when the terminus lists no platforms at all', () => {
    const state = terminusState()
    const stations = (state.stations ?? []).map((station) =>
      station.id === 'terminus' ? { ...station, stNodeIds: undefined } : station)
    expect(crossoverFor({ ...state, stations })).toBeNull()
  })

  it('is null when the terminus platforms carry no tracks', () => {
    expect(crossoverFor(terminusState({ tracklessPlatform: true }))).toBeNull()
  })

  it('is null when the terminus platforms name no tracks at all', () => {
    const state = terminusState()
    const stNodes = (state.stNodes ?? []).map((node) => ({ ...node, trackIds: undefined }))
    expect(crossoverFor({ ...state, stNodes })).toBeNull()
  })

  it('is null when both platform ends sit on the very same spot', () => {
    expect(crossoverFor(terminusState({ platformSpread: 0 }))).toBeNull()
  })

  // Injecting where the game (or the "Auto Crossover" setting) already placed one
  // has to be a no-op, not a duplicate.
  it('is null when the two ends are already linked in the track graph', () => {
    expect(crossoverFor(terminusState({ linkFarEnds: true }))).toBeNull()
  })

  it('still builds one when the state carries no track graph to check', () => {
    expect(crossoverFor({ ...terminusState(), trackGraph: undefined })).not.toBeNull()
  })

  it('skips a platform the state no longer holds', () => {
    const crossover = crossoverFor(terminusState({ ghostPlatform: true }))
    expect(crossover?.coords).toHaveLength(2)
  })

  it('gives every crossover its own id', () => {
    let issued = 0
    vi.stubGlobal('crypto', { randomUUID: (): string => 'uuid-' + issued++ })
    expect(crossoverFor(terminusState())?.id).toBe('uuid-0')
    expect(crossoverFor(terminusState())?.id).toBe('uuid-1')
  })

  it('falls back to a generated id where the platform has no crypto', () => {
    vi.stubGlobal('crypto', undefined)
    expect(crossoverFor(terminusState())?.id).toMatch(/^xover-/)
    vi.stubGlobal('crypto', {})
    expect(crossoverFor(terminusState())?.id).toMatch(/^xover-/)
  })

  it('stamps the moment it was built', () => {
    const now = Date.now()
    expect(crossoverFor(terminusState())?.createdAt).toBeGreaterThanOrEqual(now)
  })
})
