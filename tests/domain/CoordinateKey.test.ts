import { describe, expect, it } from 'vitest'

import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'
import type { TrackGraph } from '@/shared/game/Track'

import { detectCoordinateKey } from '@/domain/network/CoordinateKey'

import { buildNetwork, coordinateKey, point } from './support/network'

const PREFIXED = coordinateKey('prefixed')
const DASHED = coordinateKey('dashed')

function graphOver(keys: string[]): TrackGraph {
  const present = new Set(keys)

  return {
    get: (): undefined => undefined,
    has: (key): boolean => present.has(key),
  }
}

function stateWith(graph: TrackGraph | undefined, centers: Coordinate[]): GameState {
  return {
    money: 0,
    ownedTrainCount: 0,
    stNodes: centers.map((center, i) => ({ center, id: 'n' + i })),
    trackGraph: graph,
    tracks: [],
  }
}

describe('detectCoordinateKey', () => {
  it('detects the "S"-prefixed format the game ships in 1.0 and 1.4.10', () => {
    const state = buildNetwork({
      keyFormat: 'prefixed',
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
    })
    const key = detectCoordinateKey(state)
    expect(key([-46.63, -23.55])).toBe('S-46.63-23.55')
  })

  it('detects the dashed format the game shipped in 1.4.2', () => {
    const state = buildNetwork({
      keyFormat: 'dashed',
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
    })
    const key = detectCoordinateKey(state)
    expect(key([-46.63, -23.55])).toBe('-46.63--23.55')
  })

  // Every adjacency lookup keys off this, so guessing wrong silently empties the
  // whole graph — the mod would rather fall back than probe a graph it can't read.
  it('falls back to the prefixed format when there is no track graph', () => {
    const key = detectCoordinateKey(stateWith(undefined, [[1, 2]]))
    expect(key([1, 2])).toBe(PREFIXED([1, 2]))
  })

  it('falls back to the prefixed format when the track graph is not a live map', () => {
    const graph = { get: (): undefined => undefined } as unknown as TrackGraph
    const key = detectCoordinateKey(stateWith(graph, [[1, 2]]))
    expect(key([1, 2])).toBe(PREFIXED([1, 2]))
  })

  it('falls back to the prefixed format when there are no station nodes to probe', () => {
    const state: GameState = { money: 0, ownedTrainCount: 0, trackGraph: graphOver([]), tracks: [] }
    expect(detectCoordinateKey(state)([1, 2])).toBe(PREFIXED([1, 2]))
  })

  it('falls back to the prefixed format when no station node matches any format', () => {
    const key = detectCoordinateKey(stateWith(graphOver(['nothing-like-a-coord']), [[1, 2]]))
    expect(key([1, 2])).toBe(PREFIXED([1, 2]))
  })

  it('detects a format that only the last of the probed station nodes matches', () => {
    const centers: Coordinate[] = Array.from({ length: 8 }, (_, i) => [i, 0])
    const key = detectCoordinateKey(stateWith(graphOver([DASHED(centers[7])]), centers))
    expect(key([1, 2])).toBe(DASHED([1, 2]))
  })

  // The probe stops after 8 nodes, so a graph a mod only matches deeper than that
  // reads as undetectable rather than costing a walk of every station in the city.
  it('gives up rather than probing past the ninth station node', () => {
    const centers: Coordinate[] = Array.from({ length: 12 }, (_, i) => [i, 0])
    const key = detectCoordinateKey(stateWith(graphOver([DASHED(centers[8])]), centers))
    expect(key([1, 2])).toBe(PREFIXED([1, 2]))
  })

  it('prefers the prefixed format when a graph somehow answers to both', () => {
    const center: Coordinate = [1, 2]
    const graph = graphOver([PREFIXED(center), DASHED(center)])
    expect(detectCoordinateKey(stateWith(graph, [center]))([1, 2])).toBe(PREFIXED([1, 2]))
  })
})
