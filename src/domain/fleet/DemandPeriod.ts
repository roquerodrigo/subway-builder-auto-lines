import { DemandTier } from '@/domain/fleet/DemandTier'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86_400

// The game's HOUR_DEMAND_LEVELS, indexed by hour of day (0–23). Rush 7–9 / 16–18
// = high; midday shoulders = medium; early/late = low; deep night = veryLow.
const TIER_BY_HOUR: DemandTier[] = [
  DemandTier.VeryLow, // 0
  DemandTier.VeryLow, // 1
  DemandTier.VeryLow, // 2
  DemandTier.Low, //     3
  DemandTier.Low, //     4
  DemandTier.Low, //     5
  DemandTier.Medium, //  6
  DemandTier.High, //    7
  DemandTier.High, //    8
  DemandTier.High, //    9
  DemandTier.Medium, //  10
  DemandTier.Medium, //  11
  DemandTier.Medium, //  12
  DemandTier.Medium, //  13
  DemandTier.Medium, //  14
  DemandTier.Medium, //  15
  DemandTier.High, //    16
  DemandTier.High, //    17
  DemandTier.High, //    18
  DemandTier.Medium, //  19
  DemandTier.Low, //     20
  DemandTier.Low, //     21
  DemandTier.Low, //     22
  DemandTier.VeryLow, // 23
]

// Maps a time of day to a demand tier (the game keys train counts by tier, not by
// ridership — so a brand-new line needs no history).
export class DemandPeriod {
  static tierForElapsedSeconds(elapsedSeconds: number): DemandTier {
    return this.tierForHour(Math.floor((elapsedSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR))
  }

  private static tierForHour(hour: number): DemandTier {
    return TIER_BY_HOUR[hour] ?? DemandTier.Low
  }
}
