import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

import { LineHeadways } from '@/domain/fleet/LineHeadways'
import { DEFAULT_SERVICE_SETTINGS, MAX_HEADWAY_MINUTES } from '@/domain/settings/ServiceSettings'

const FALLBACK = DEFAULT_SERVICE_SETTINGS.headwayMinutes
const HALF_HOUR = 1800

function route(schedule?: TrainSchedule, cycleSeconds = HALF_HOUR): Route {
  return {
    id: 'route-1',
    stComboTimings: cycleSeconds ? [{ departureTime: cycleSeconds }] : [],
    stNodes: [],
    trainSchedule: schedule,
  }
}

describe('LineHeadways.forRoute', () => {
  // Six trains over a half-hour round trip is a train every five minutes — the
  // schedule the mod writes for the default headways, read back.
  it('reads a line’s schedule back as the headways it runs', () => {
    const schedule = { highDemand: 6, lowDemand: 1, mediumDemand: 2, veryLowDemand: 1 }

    expect(LineHeadways.forRoute(route(schedule), FALLBACK)).toEqual({
      midday: 15,
      night: 30,
      offPeak: 30,
      peak: 5,
    })
  })

  it('scales with the round trip, not with the counts alone', () => {
    const schedule = { highDemand: 6, lowDemand: 1, mediumDemand: 2 }

    expect(LineHeadways.forRoute(route(schedule, 3600), FALLBACK).peak).toBe(10)
  })

  it('serves the deep night at the off-peak count when the schedule has none', () => {
    const schedule = { highDemand: 6, lowDemand: 2, mediumDemand: 3 }

    expect(LineHeadways.forRoute(route(schedule), FALLBACK).night).toBe(15)
  })

  it('falls back for a line the game has not timed yet', () => {
    const schedule = { highDemand: 6, lowDemand: 1, mediumDemand: 2 }

    expect(LineHeadways.forRoute(route(schedule, 0), FALLBACK)).toEqual(FALLBACK)
  })

  it('falls back for a line with no schedule at all', () => {
    expect(LineHeadways.forRoute(route(undefined), FALLBACK)).toEqual(FALLBACK)
  })

  it('falls back per period for a period with no trains', () => {
    const schedule = { highDemand: 6, lowDemand: 0, mediumDemand: 2, veryLowDemand: 0 }
    const headways = LineHeadways.forRoute(route(schedule), FALLBACK)

    expect(headways.offPeak).toBe(FALLBACK.offPeak)
    expect(headways.night).toBe(FALLBACK.night)
  })

  // A single train on a very long round trip would otherwise read as hours.
  it('never reports a headway longer than the panel can hold', () => {
    const schedule = { highDemand: 1, lowDemand: 1, mediumDemand: 1 }

    expect(LineHeadways.forRoute(route(schedule, 86_400), FALLBACK).peak).toBe(MAX_HEADWAY_MINUTES)
  })

  it('never reports a headway shorter than a minute', () => {
    const schedule = { highDemand: 100, lowDemand: 1, mediumDemand: 1 }

    expect(LineHeadways.forRoute(route(schedule, 600), FALLBACK).peak).toBe(1)
  })
})
