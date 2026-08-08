import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

import { FleetCapacityPolicy } from '@/domain/fleet/FleetCapacityPolicy'

function route(overrides: Partial<Route> = {}): Route {
  return { id: 'route-1', stNodes: [], ...overrides }
}

function schedule(overrides: Partial<TrainSchedule> = {}): TrainSchedule {
  return { highDemand: 6, lowDemand: 2, mediumDemand: 3, veryLowDemand: 1, ...overrides }
}

describe('FleetCapacityPolicy.requiredTrains', () => {
  it('needs no cap for a city with no lines', () => {
    expect(FleetCapacityPolicy.requiredTrains([], 0)).toBe(0)
  })

  it('is the busiest period, not the sum of them all', () => {
    expect(FleetCapacityPolicy.requiredTrains([route({ trainSchedule: schedule() })], 0)).toBe(6)
  })

  // The cap is one number for the whole city, whatever a line's train type.
  it('adds up every line in the city, of every type', () => {
    const lines = [
      route({ id: 'a', trainSchedule: schedule({ highDemand: 6 }) }),
      route({ id: 'b', trainSchedule: schedule({ highDemand: 4 }), trainType: 'light-metro' }),
    ]

    expect(FleetCapacityPolicy.requiredTrains(lines, 0)).toBe(10)
  })

  it('counts a line the mod has not scheduled yet as needing nothing', () => {
    expect(FleetCapacityPolicy.requiredTrains([route()], 0)).toBe(0)
  })

  // Dropping the cap below the trains already out there would strand them.
  it('never asks for less than the trains already running', () => {
    expect(FleetCapacityPolicy.requiredTrains([route({ trainSchedule: schedule() })], 40)).toBe(40)
  })

  it('falls back to the off-peak count for a schedule with no deep-night one', () => {
    const lines = [route({ trainSchedule: { highDemand: 2, lowDemand: 9, mediumDemand: 3 } })]

    expect(FleetCapacityPolicy.requiredTrains(lines, 0)).toBe(9)
  })
})
