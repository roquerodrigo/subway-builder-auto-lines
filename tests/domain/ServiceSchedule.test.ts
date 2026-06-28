import { describe, expect, it } from 'vitest'

import { ServiceSchedule } from '@/domain/fleet/ServiceSchedule'

describe('ServiceSchedule.forCycleSeconds', () => {
  // Counts, not headways: the game reads trainSchedule as how many trains to run
  // in each period, and count = cycle / headway.
  it('turns an hour-long round trip into 5/10/15/30-minute headways', () => {
    expect(ServiceSchedule.forCycleSeconds(3600)).toEqual({
      highDemand: 12,
      lowDemand: 4,
      mediumDemand: 6,
      veryLowDemand: 2,
    })
  })

  it('scales every period with the length of the round trip', () => {
    expect(ServiceSchedule.forCycleSeconds(7200)).toEqual({
      highDemand: 24,
      lowDemand: 8,
      mediumDemand: 12,
      veryLowDemand: 4,
    })
  })

  it('rounds to the nearest whole train', () => {
    expect(ServiceSchedule.forCycleSeconds(1000).highDemand).toBe(3)
    expect(ServiceSchedule.forCycleSeconds(1400).highDemand).toBe(5)
  })

  // A line always gets at least one train, however short its loop.
  it('never leaves a period without a train', () => {
    expect(ServiceSchedule.forCycleSeconds(60)).toEqual({
      highDemand: 1,
      lowDemand: 1,
      mediumDemand: 1,
      veryLowDemand: 1,
    })
  })

  it('still runs one train for a cycle the game has not timed yet', () => {
    expect(ServiceSchedule.forCycleSeconds(0).highDemand).toBe(1)
  })

  // The game hard-requires high >= medium >= low >= veryLow.
  it('never puts fewer trains on a busier period, at any cycle length', () => {
    for (let cycleSeconds = 0; cycleSeconds <= 10_000; cycleSeconds += 37) {
      const schedule = ServiceSchedule.forCycleSeconds(cycleSeconds)
      expect(schedule.highDemand).toBeGreaterThanOrEqual(schedule.mediumDemand)
      expect(schedule.mediumDemand).toBeGreaterThanOrEqual(schedule.lowDemand)
      expect(schedule.lowDemand).toBeGreaterThanOrEqual(schedule.veryLowDemand ?? 0)
    }
  })

  it('runs a peak train every five minutes of the round trip', () => {
    expect(ServiceSchedule.forCycleSeconds(1800).highDemand).toBe(6)
  })
})
