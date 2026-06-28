import { describe, expect, it } from 'vitest'

import { DemandPeriod } from '@/domain/fleet/DemandPeriod'
import { DemandTier } from '@/domain/fleet/DemandTier'
import { ServiceSchedule } from '@/domain/fleet/ServiceSchedule'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86_400

function tierAtHour(hour: number): DemandTier {
  return DemandPeriod.tierForElapsedSeconds(hour * SECONDS_PER_HOUR)
}

// The game's own HOUR_DEMAND_LEVELS: the tier is the time of day, not ridership,
// so a brand-new line is served from its first minute.
const HOURS_BY_TIER: [DemandTier, number[]][] = [
  [DemandTier.VeryLow, [0, 1, 2, 23]],
  [DemandTier.Low, [3, 4, 5, 20, 21, 22]],
  [DemandTier.Medium, [6, 10, 11, 12, 13, 14, 15, 19]],
  [DemandTier.High, [7, 8, 9, 16, 17, 18]],
]

describe('DemandPeriod.tierForElapsedSeconds', () => {
  it.each(HOURS_BY_TIER)('reads %s off the hours the game marks it', (tier, hours) => {
    expect(hours.map(tierAtHour)).toEqual(hours.map(() => tier))
  })

  it('covers all twenty-four hours of the day', () => {
    expect(HOURS_BY_TIER.flatMap(([, hours]) => hours).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 24 }, (_, hour) => hour))
  })

  it('holds a tier for the whole hour it belongs to', () => {
    expect(DemandPeriod.tierForElapsedSeconds(7 * SECONDS_PER_HOUR)).toBe(DemandTier.High)
    expect(DemandPeriod.tierForElapsedSeconds(8 * SECONDS_PER_HOUR - 1)).toBe(DemandTier.High)
  })

  it('turns over to the next tier exactly on the hour', () => {
    expect(DemandPeriod.tierForElapsedSeconds(7 * SECONDS_PER_HOUR - 1)).toBe(DemandTier.Medium)
    expect(DemandPeriod.tierForElapsedSeconds(7 * SECONDS_PER_HOUR)).toBe(DemandTier.High)
  })

  // Elapsed time only grows, so day two has to read like day one.
  it('wraps around to the same hour on the next day', () => {
    expect(DemandPeriod.tierForElapsedSeconds(SECONDS_PER_DAY + 8 * SECONDS_PER_HOUR)).toBe(DemandTier.High)
    expect(DemandPeriod.tierForElapsedSeconds(400 * SECONDS_PER_DAY + SECONDS_PER_HOUR)).toBe(DemandTier.VeryLow)
  })

  it('reads midnight itself as the deep of the night', () => {
    expect(DemandPeriod.tierForElapsedSeconds(0)).toBe(DemandTier.VeryLow)
    expect(DemandPeriod.tierForElapsedSeconds(SECONDS_PER_DAY)).toBe(DemandTier.VeryLow)
  })

  it('falls back to off-peak for a clock that has run backwards', () => {
    expect(DemandPeriod.tierForElapsedSeconds(-SECONDS_PER_HOUR)).toBe(DemandTier.Low)
  })
})

// Every tier names the schedule field it indexes, so a tier can read a train count
// straight off a schedule with no mapping in between.
describe('DemandTier', () => {
  it('names a field of the schedule the mod builds', () => {
    const schedule = ServiceSchedule.forCycleSeconds(3600)
    for (const tier of Object.values(DemandTier)) {
      expect(schedule[tier]).toBeTypeOf('number')
    }
  })
})
