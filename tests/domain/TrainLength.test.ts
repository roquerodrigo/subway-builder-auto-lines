import { describe, expect, it } from 'vitest'

import type { TrainTypeStats } from '@/shared/game/TrainType'

import { TrainLength } from '@/domain/fleet/TrainLength'
import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'

function stats(overrides: Partial<TrainTypeStats> = {}): TrainTypeStats {
  return { carCost: 2_700_000, carsPerCarSet: 1, maxCars: 15, minCars: 5, ...overrides }
}

describe('TrainLength.carsFor', () => {
  it('runs the full default train on a type that takes it', () => {
    expect(TrainLength.carsFor(DEFAULT_SERVICE_SETTINGS.carsPerTrain, stats())).toBe(10)
  })

  it('runs the shorter train the player asked for', () => {
    expect(TrainLength.carsFor(7, stats())).toBe(7)
  })

  // A light-rail unit tops out well under ten, and the game refuses a longer one.
  it('stops at what the train type takes', () => {
    expect(TrainLength.carsFor(10, stats({ maxCars: 6, minCars: 2 }))).toBe(6)
  })

  // The game refuses a train below the type's floor just as firmly.
  it('holds a train the player made too short up to the type floor', () => {
    expect(TrainLength.carsFor(2, stats({ minCars: 5 }))).toBe(5)
  })

  it('takes the type at its word when it takes exactly what was asked for', () => {
    expect(TrainLength.carsFor(10, stats({ maxCars: 10 }))).toBe(10)
  })

  // The catalog falls back to zeroes when the game exposes no stats for a type.
  it('runs what the player asked for when the type reports no limits', () => {
    expect(TrainLength.carsFor(10, stats({ maxCars: 0, minCars: 0 }))).toBe(10)
    expect(TrainLength.carsFor(10, stats({ maxCars: -1, minCars: -1 }))).toBe(10)
  })
})
