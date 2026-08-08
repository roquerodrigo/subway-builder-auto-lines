import { describe, expect, it } from 'vitest'

import type { HeadwayMinutes } from '@/domain/settings/ServiceSettings'

import { ServiceSchedule } from '@/domain/fleet/ServiceSchedule'
import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'

const HEADWAYS = DEFAULT_SERVICE_SETTINGS.headwayMinutes

function headways(overrides: Partial<HeadwayMinutes> = {}): HeadwayMinutes {
  return { ...HEADWAYS, ...overrides }
}

describe('ServiceSchedule.forCycleSeconds', () => {
  // Counts, not headways: the game reads trainSchedule as how many trains to run
  // in each period, and count = cycle / headway.
  it('turns an hour-long round trip into the default 5/15/30/60-minute headways', () => {
    expect(ServiceSchedule.forCycleSeconds(3600, HEADWAYS)).toEqual({
      highDemand: 12,
      lowDemand: 2,
      mediumDemand: 4,
      veryLowDemand: 1,
    })
  })

  it('scales every period with the length of the round trip', () => {
    expect(ServiceSchedule.forCycleSeconds(7200, HEADWAYS)).toEqual({
      highDemand: 24,
      lowDemand: 4,
      mediumDemand: 8,
      veryLowDemand: 2,
    })
  })

  it('serves each period at the headway the player set', () => {
    expect(ServiceSchedule.forCycleSeconds(3600, headways({ midday: 10, night: 30, offPeak: 20, peak: 4 }))).toEqual({
      highDemand: 15,
      lowDemand: 3,
      mediumDemand: 6,
      veryLowDemand: 2,
    })
  })

  it('rounds to the nearest whole train', () => {
    expect(ServiceSchedule.forCycleSeconds(1000, HEADWAYS).highDemand).toBe(3)
    expect(ServiceSchedule.forCycleSeconds(1400, HEADWAYS).highDemand).toBe(5)
  })

  // A line always gets at least one train, however short its loop.
  it('never leaves a period without a train', () => {
    expect(ServiceSchedule.forCycleSeconds(60, HEADWAYS)).toEqual({
      highDemand: 1,
      lowDemand: 1,
      mediumDemand: 1,
      veryLowDemand: 1,
    })
  })

  it('still runs one train for a cycle the game has not timed yet', () => {
    expect(ServiceSchedule.forCycleSeconds(0, HEADWAYS).highDemand).toBe(1)
  })

  // The game hard-requires high >= medium >= low >= veryLow.
  it('never puts fewer trains on a busier period, at any cycle length', () => {
    for (let cycleSeconds = 0; cycleSeconds <= 10_000; cycleSeconds += 37) {
      const schedule = ServiceSchedule.forCycleSeconds(cycleSeconds, HEADWAYS)
      expect(schedule.highDemand).toBeGreaterThanOrEqual(schedule.mediumDemand)
      expect(schedule.mediumDemand).toBeGreaterThanOrEqual(schedule.lowDemand)
      expect(schedule.lowDemand).toBeGreaterThanOrEqual(schedule.veryLowDemand ?? 0)
    }
  })

  // A player is free to ask for a quieter peak than off-peak; the game is not free
  // to take it, so the quieter period is held to the busier one's count.
  it('flattens headways the player ordered upside down', () => {
    expect(ServiceSchedule.forCycleSeconds(3600, headways({ midday: 5, night: 1, offPeak: 2, peak: 60 }))).toEqual({
      highDemand: 1,
      lowDemand: 1,
      mediumDemand: 1,
      veryLowDemand: 1,
    })
  })

  it('runs a peak train every five minutes of the round trip', () => {
    expect(ServiceSchedule.forCycleSeconds(1800, HEADWAYS).highDemand).toBe(6)
  })

  // Nothing writes a zero headway (the settings clamp it), but a division by one
  // would run away with the fleet if one ever got through.
  it('treats a headway below a minute as a minute', () => {
    expect(ServiceSchedule.forCycleSeconds(3600, headways({ peak: 0 })).highDemand).toBe(60)
  })
})
