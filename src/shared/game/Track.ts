import type { Coordinate } from '@/shared/game/Coordinate'

// Argument shape for setTracks (regenStations:false preserves station-node ids).
export interface SetTracksArg {
  newTracks: Track[]
  regenRoutesWithTrackIDs: string[]
  regenStations: boolean
}

// A physical track segment. The extra optional fields are the ones a fabricated
// terminus scissors-crossover carries (see TerminusCrossoverFactory).
export interface Track {
  buildType?: string
  coords: Coordinate[]
  createdAt?: number
  displayType?: string
  endElevation?: number
  id: string
  interactable?: boolean
  length?: number
  reversable?: boolean
  startElevation?: number
  trackType?: string
  type?: string
  waterIntersectionPercentage?: number
}

// The adjacency graph keyed by coord string. A live Map in the store.
export interface TrackGraph {
  get(key: string): TrackGraphEdge[] | undefined
  has(key: string): boolean
}

// A trackGraph edge: only `coordsString` (the far node's coord key) is read.
export interface TrackGraphEdge {
  coordsString: string
}
