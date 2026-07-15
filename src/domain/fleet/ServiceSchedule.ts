import type { TrainSchedule } from '@/shared/game/TrainSchedule'

const PEAK_HEADWAY_SECONDS = 300 // 5 min
const MIDDAY_HEADWAY_SECONDS = 600 // 10 min
const OFF_PEAK_HEADWAY_SECONDS = 900 // 15 min
const NIGHT_HEADWAY_SECONDS = 1800 // 30 min

// Builds a demand-based train schedule from a route's round-trip cycle. Counts,
// not headways: count = round(cycleSeconds / headwaySeconds), min 1, for
// 5/10/15/30-minute peak/midday/off-peak/night headways across the game's four
// demand tiers (high >= medium >= low >= veryLow).
export class ServiceSchedule {
  static forCycleSeconds(cycleSeconds: number): TrainSchedule {
    const countForHeadway = (headwaySeconds: number): number =>
      Math.max(1, Math.round(cycleSeconds / headwaySeconds))

    return {
      highDemand: countForHeadway(PEAK_HEADWAY_SECONDS),
      lowDemand: countForHeadway(OFF_PEAK_HEADWAY_SECONDS),
      mediumDemand: countForHeadway(MIDDAY_HEADWAY_SECONDS),
      veryLowDemand: countForHeadway(NIGHT_HEADWAY_SECONDS),
    }
  }
}
