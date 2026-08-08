import { describe, expect, it } from 'vitest'

import { DEFAULT_CARS_PER_TRAIN, TrainLength } from '@/domain/fleet/TrainLength'

describe('TrainLength.forMaxCars', () => {
  it('puts a full ten-car train on a line the type can take it on', () => {
    expect(TrainLength.forMaxCars(15)).toBe(DEFAULT_CARS_PER_TRAIN)
  })

  // A light-rail unit tops out well under ten, and the game refuses a longer one.
  it('stops at what the train type takes', () => {
    expect(TrainLength.forMaxCars(6)).toBe(6)
  })

  it('takes the type at its word when it takes exactly ten', () => {
    expect(TrainLength.forMaxCars(10)).toBe(10)
  })

  // The catalog falls back to zeroes when the game exposes no stats for a type.
  it('falls back to the full train when the type reports no limit', () => {
    expect(TrainLength.forMaxCars(0)).toBe(DEFAULT_CARS_PER_TRAIN)
    expect(TrainLength.forMaxCars(-1)).toBe(DEFAULT_CARS_PER_TRAIN)
  })
})
