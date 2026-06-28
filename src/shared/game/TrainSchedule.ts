// Train COUNTS per time-of-day demand tier (NOT headways), ordered
// high >= medium >= low >= veryLow. `veryLowDemand` (deep-night) is optional and
// falls back to `lowDemand` when the game reads it.
export interface TrainSchedule {
  highDemand: number
  mediumDemand: number
  lowDemand: number
  veryLowDemand?: number
}
