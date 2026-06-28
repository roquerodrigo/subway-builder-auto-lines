import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

import { CarInventoryPolicy } from '@/domain/fleet/CarInventoryPolicy'

const DEFAULT_TYPE = 'heavy-metro'
const CAR_SET = 5

function route(overrides: Partial<Route> = {}): Route {
  return { id: 'route-1', stNodes: [], ...overrides }
}

function schedule(overrides: Partial<TrainSchedule> = {}): TrainSchedule {
  return { highDemand: 4, lowDemand: 1, mediumDemand: 2, veryLowDemand: 1, ...overrides }
}

const carsPerTrain = (line: Route): number => line.carsPerTrain ?? CAR_SET

describe('CarInventoryPolicy.peakCars', () => {
  it('needs no cars for a city with no lines', () => {
    expect(CarInventoryPolicy.peakCars([], DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(0)
  })

  it('is the busiest period, not the sum of them all', () => {
    const lines = [route({ carsPerTrain: 5, trainSchedule: schedule() })]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(20)
  })

  it('adds up every line of the type running in the same period', () => {
    const lines = [
      route({ carsPerTrain: 5, id: 'route-1', trainSchedule: schedule({ highDemand: 4 }) }),
      route({ carsPerTrain: 10, id: 'route-2', trainSchedule: schedule({ highDemand: 3 }) }),
    ]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(50)
  })

  // Each type has its own inventory, so another type's fleet must not inflate it.
  it('ignores lines running a different train type', () => {
    const lines = [
      route({ carsPerTrain: 5, id: 'route-1', trainSchedule: schedule({ highDemand: 4 }) }),
      route({ carsPerTrain: 5, id: 'route-2', trainSchedule: schedule({ highDemand: 9 }), trainType: 'light-rail' }),
    ]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(20)
  })

  it('treats a line with no train type of its own as running the default one', () => {
    const lines = [route({ carsPerTrain: 5, trainSchedule: schedule({ highDemand: 4 }) })]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(20)
    expect(CarInventoryPolicy.peakCars(lines, 'light-rail', DEFAULT_TYPE, carsPerTrain)).toBe(0)
  })

  it('ignores a line with no schedule to run', () => {
    expect(CarInventoryPolicy.peakCars([route()], DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(0)
  })

  // The game reads deep-night as `veryLowDemand ?? lowDemand`, so the policy has
  // to budget for the same thing the game will run.
  it('falls back to the off-peak count for a schedule with no deep-night entry', () => {
    const lines = [route({
      carsPerTrain: 5,
      trainSchedule: { highDemand: 1, lowDemand: 6, mediumDemand: 1 },
    })]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(30)
  })

  it('budgets the deep-night count a schedule does carry', () => {
    const lines = [route({
      carsPerTrain: 5,
      trainSchedule: { highDemand: 1, lowDemand: 1, mediumDemand: 1, veryLowDemand: 9 },
    })]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(45)
  })

  it('takes the cars per train from the caller, not from the route', () => {
    const lines = [route({ carsPerTrain: 5, trainSchedule: schedule({ highDemand: 4 }) })]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, () => 15)).toBe(60)
  })

  it('lets a period with no trains at all cost nothing', () => {
    const lines = [route({
      carsPerTrain: 5,
      trainSchedule: { highDemand: 0, lowDemand: 0, mediumDemand: 0, veryLowDemand: 0 },
    })]
    expect(CarInventoryPolicy.peakCars(lines, DEFAULT_TYPE, DEFAULT_TYPE, carsPerTrain)).toBe(0)
  })
})

describe('CarInventoryPolicy.requiredCars', () => {
  // The target has to leave room for the player to lengthen this line all the way
  // to maxCars, or the game blocks it with "Not enough train cars to increase".
  it('budgets the new line at its longest, not at its current length', () => {
    const lines = [route({ carsPerTrain: 5, trainSchedule: schedule({ highDemand: 4 }) })]
    expect(CarInventoryPolicy.requiredCars(lines, 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 15)).toBe(60)
  })

  it('leaves every other line at the length it runs today', () => {
    const lines = [
      route({ carsPerTrain: 5, id: 'route-1', trainSchedule: schedule({ highDemand: 4 }) }),
      route({ carsPerTrain: 5, id: 'route-2', trainSchedule: schedule({ highDemand: 2 }) }),
    ]
    expect(CarInventoryPolicy.requiredCars(lines, 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 15)).toBe(70)
  })

  it('falls back to the car-set size for a line that has no cars per train yet', () => {
    const lines = [
      route({ id: 'route-1', trainSchedule: schedule({ highDemand: 4 }) }),
      route({ id: 'route-2', trainSchedule: schedule({ highDemand: 2 }) }),
    ]
    expect(CarInventoryPolicy.requiredCars(lines, 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 15)).toBe(70)
  })

  it('keeps the line at its own length when there is no maximum to reach for', () => {
    const lines = [route({ carsPerTrain: 8, trainSchedule: schedule({ highDemand: 4 }) })]
    expect(CarInventoryPolicy.requiredCars(lines, 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 0)).toBe(32)
  })

  it('falls back to the car-set size for a brand-new line with no maximum either', () => {
    const lines = [route({ trainSchedule: schedule({ highDemand: 4 }) })]
    expect(CarInventoryPolicy.requiredCars(lines, 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 0)).toBe(20)
  })

  it('needs no cars for a line that is not there', () => {
    expect(CarInventoryPolicy.requiredCars([], 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 15)).toBe(0)
  })

  it('rounds a fractional car budget up to a whole car', () => {
    const lines = [route({ carsPerTrain: 2.5, id: 'route-2', trainSchedule: schedule({ highDemand: 3 }) })]
    expect(CarInventoryPolicy.requiredCars(lines, 'route-1', DEFAULT_TYPE, DEFAULT_TYPE, CAR_SET, 15)).toBe(8)
  })
})
