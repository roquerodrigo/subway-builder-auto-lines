import type { HeadwayMinutes } from '@/domain/settings/ServiceSettings'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

const SECONDS_PER_MINUTE = 60

// Builds a demand-based train schedule from a route's round-trip cycle and the
// player's headways. Counts, not headways: count = round(cycleSeconds /
// headwaySeconds), min 1, across the game's four demand tiers. The game requires
// high >= medium >= low >= veryLow, so each quieter period is held to the busier
// one's count — a player who asks for a longer peak headway than off-peak gets a
// flat service, never an inverted one the game would choke on.
export class ServiceSchedule {
  static forCycleSeconds(cycleSeconds: number, headwayMinutes: HeadwayMinutes): TrainSchedule {
    const countForHeadway = (minutes: number): number =>
      Math.max(1, Math.round(cycleSeconds / (Math.max(1, minutes) * SECONDS_PER_MINUTE)))

    const highDemand = countForHeadway(headwayMinutes.peak)
    const mediumDemand = Math.min(highDemand, countForHeadway(headwayMinutes.midday))
    const lowDemand = Math.min(mediumDemand, countForHeadway(headwayMinutes.offPeak))

    return {
      highDemand,
      lowDemand,
      mediumDemand,
      veryLowDemand: Math.min(lowDemand, countForHeadway(headwayMinutes.night)),
    }
  }
}
