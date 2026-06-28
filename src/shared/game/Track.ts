import type { Coordinate } from '@/shared/game/Coordinate'

// A physical track segment. The extra optional fields are the ones a fabricated
// terminus scissors-crossover carries (see TerminusCrossoverFactory).
export interface Track {
  id: string
  coords: Coordinate[]
  trackType?: string
  startElevation?: number
  endElevation?: number
  type?: string
  reversable?: boolean
  buildType?: string
  displayType?: string
  interactable?: boolean
  length?: number
  createdAt?: number
  waterIntersectionPercentage?: number
}

// A trackGraph edge: only `coordsString` (the far node's coord key) is read.
export interface TrackGraphEdge {
  coordsString: string
}

// The adjacency graph keyed by coord string. A live Map in the store.
export interface TrackGraph {
  has(key: string): boolean
  get(key: string): TrackGraphEdge[] | undefined
}

// Argument shape for setTracks (regenStations:false preserves station-node ids).
export interface SetTracksArg {
  newTracks: Track[]
  regenStations: boolean
  regenRoutesWithTrackIDs: string[]
}
