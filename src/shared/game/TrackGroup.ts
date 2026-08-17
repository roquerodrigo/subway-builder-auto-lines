import type { Coordinate } from '@/shared/game/Coordinate'

// The construction unit that owns tracks: a station, a run of parallel track, a
// scissors crossover. Game 1.6.0 drops any track no group lists when a save is
// loaded, so every track the mod fabricates needs one of these.
export interface TrackGroup {
  centerLine: Coordinate[]
  id: string
  trackIds: string[]
  trackLanesType?: string
  trackType?: string
  type?: string
}
