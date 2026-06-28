import type { Coordinate } from '@/shared/game/Coordinate'
import type { GameState } from '@/shared/game/GameState'

export type CoordinateKeyFn = (coord: Coordinate) => string

// trackGraph node keys (and edge coordsStrings) must match the game's format
// exactly or all adjacency comes back empty. The game has changed it three
// times: "S"+lng+lat (1.0, 1.4.10) and lng+"-"+lat (1.4.2). So the format is
// detected against the live graph rather than hardcoded.
const FORMATS: CoordinateKeyFn[] = [
  (c) => 'S' + c[0] + c[1],
  (c) => c[0] + '-' + c[1],
]

// How many station nodes to probe when detecting the format.
const DETECTION_SAMPLE_SIZE = 8

// Detect the coord-key format by probing the live trackGraph with the first few
// station nodes. Returns a bound key function; the default covers 1.0 / 1.4.10.
export function detectCoordinateKey(state: GameState): CoordinateKeyFn {
  const graph = state.trackGraph
  const nodes = state.stNodes ?? []
  if (graph && typeof graph.has === 'function') {
    for (const format of FORMATS) {
      for (let i = 0; i < nodes.length && i < DETECTION_SAMPLE_SIZE; i++) {
        if (graph.has(format(nodes[i].center))) {
          return format
        }
      }
    }
  }
  return FORMATS[0]
}
