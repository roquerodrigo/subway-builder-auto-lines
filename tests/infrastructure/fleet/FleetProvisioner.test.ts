import type { MockInstance } from 'vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Route } from '@/shared/game/Route'
import type { StationNode } from '@/shared/game/StationNode'
import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'
import type { TrainTypeStats } from '@/shared/game/TrainType'

import { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { DEFAULT_CAR_COST, DEFAULT_TRAIN_TYPE } from '@/shared/game/constants'

import type { FakeGameStore } from '../fakeGameStore'

import { createFakeGameStore } from '../fakeGameStore'

const HEAVY_METRO_STATS: TrainTypeStats = { carCost: 2_700_000, carsPerCarSet: 5, maxCars: 15 }
const SCHEDULE: TrainSchedule = { highDemand: 4, lowDemand: 1, mediumDemand: 2 }
const HOUR = 3600
const MORNING_RUSH = 8 * HOUR
const MIDDAY = 12 * HOUR
const DEEP_NIGHT = HOUR

function makeRoute(overrides: Partial<Route> = {}): Route {
  return { id: 'route-1', stNodes: nodes(4), trainSchedule: SCHEDULE, ...overrides }
}

function nodes(count: number): StationNode[] {
  return Array.from({ length: count }, (_, index) => ({ center: [index, 0], id: `node-${index}` }))
}

describe('FleetProvisioner', () => {
  let stats: TrainTypeStats

  function makeProvisioner(fake: FakeGameStore): FleetProvisioner {
    const api: SubwayBuilderApi = { trains: { getTrainType: () => ({ stats }) } }

    return new FleetProvisioner(fake.store, new TrainTypeCatalog(api))
  }

  beforeEach(() => {
    stats = { ...HEAVY_METRO_STATS }
  })

  describe('ensureCarInventory', () => {
    let fake: FakeGameStore

    beforeEach(() => {
      fake = createFakeGameStore({
        buyTrains: vi.fn(),
        money: 1_000,
        ownedCarsByType: { 'heavy-metro': 30 },
        ownedTrainCount: 30,
        routes: [makeRoute()],
        setMoney: vi.fn((amount: number): void => {
          fake.state.money = amount
        }),
        setOwnedTrainCount: vi.fn(),
      })
    })

    // The peak the game gates on is 4 trains at rush × maxCars 15 = 60 cars, so a
    // stock inventory of 30 is 30 short.
    it('buys the cars the peak schedule needs at full train length', () => {
      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.buyTrains).toHaveBeenCalledWith(30, DEFAULT_TRAIN_TYPE)
    })

    it('lends itself the money to afford the cars and refunds it, so the cars are free', () => {
      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.setMoney).toHaveBeenNthCalledWith(1, 1_000 + 30 * 2_700_000 + 1)
      expect(fake.state.setMoney).toHaveBeenNthCalledWith(2, 1_000)
      expect(fake.state.money).toBe(1_000)
    })

    // The bump exists only to clear the game's affordability check. Leaving it in
    // place when the purchase throws hands the player the difference — a stock
    // 30-car top-up is ~$81M — and the game autosaves it.
    it('refunds the money it lent itself even when the purchase throws', () => {
      fake.state.buyTrains = vi.fn((): never => {
        throw new Error('the game refused the purchase')
      })

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.money).toBe(1_000)
    })

    it('bumps the money before buying and refunds only after', () => {
      const seen: number[] = []
      fake.state.buyTrains = vi.fn((): void => {
        seen.push(fake.state.money)
      })

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(seen).toEqual([1_000 + 30 * 2_700_000 + 1])
    })

    it('buys cars of the route’s own train type', () => {
      fake.state.routes = [makeRoute({ trainType: 'light-rail' })]
      fake.state.ownedCarsByType = { 'light-rail': 0 }

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.buyTrains).toHaveBeenCalledWith(60, 'light-rail')
    })

    it('buys nothing when the inventory already covers the peak', () => {
      fake.state.ownedCarsByType = { 'heavy-metro': 60 }

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.buyTrains).not.toHaveBeenCalled()
      expect(fake.state.setMoney).not.toHaveBeenCalled()
    })

    it('treats an absent car inventory as owning none', () => {
      delete fake.state.ownedCarsByType

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.buyTrains).toHaveBeenCalledWith(60, DEFAULT_TRAIN_TYPE)
    })

    it('falls back to the default car set, length and price when the type reports none', () => {
      stats = { carCost: 0, carsPerCarSet: 0, maxCars: 0 }
      fake.state.ownedCarsByType = { 'heavy-metro': 0 }

      makeProvisioner(fake).ensureCarInventory('route-1')

      // No maxCars to aim for, so the route falls back to the default 5-car set:
      // 4 trains at rush × 5 = 20 cars, priced at the default car cost.
      expect(fake.state.buyTrains).toHaveBeenCalledWith(20, DEFAULT_TRAIN_TYPE)
      expect(fake.state.setMoney).toHaveBeenNthCalledWith(1, 1_000 + 20 * DEFAULT_CAR_COST + 1)
    })

    it('counts the cars every other line of the type already claims at peak', () => {
      fake.state.routes = [
        makeRoute(),
        { carsPerTrain: 10, id: 'route-2', stNodes: nodes(2), trainSchedule: { highDemand: 2, lowDemand: 1, mediumDemand: 1 } },
      ]

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.buyTrains).toHaveBeenCalledWith(50, DEFAULT_TRAIN_TYPE)
    })

    it('buys without lending money when the game exposes no setMoney', () => {
      delete fake.state.setMoney

      makeProvisioner(fake).ensureCarInventory('route-1')

      expect(fake.state.buyTrains).toHaveBeenCalledWith(30, DEFAULT_TRAIN_TYPE)
    })

    it('does nothing for a line that no longer exists', () => {
      makeProvisioner(fake).ensureCarInventory('gone')

      expect(fake.state.buyTrains).not.toHaveBeenCalled()
    })

    describe('when the game cannot sell cars', () => {
      beforeEach(() => {
        delete fake.state.buyTrains
      })

      it('raises the fleet cap instead, as the best it can do', () => {
        makeProvisioner(fake).ensureCarInventory('route-1')

        expect(fake.state.setOwnedTrainCount).toHaveBeenCalledWith(60)
      })

      it('leaves an already-high fleet cap alone', () => {
        fake.state.ownedTrainCount = 100

        makeProvisioner(fake).ensureCarInventory('route-1')

        expect(fake.state.setOwnedTrainCount).not.toHaveBeenCalled()
      })

      it('does nothing when the game exposes no fleet cap setter either', () => {
        delete fake.state.setOwnedTrainCount

        expect(() => makeProvisioner(fake).ensureCarInventory('route-1')).not.toThrow()
      })
    })

    describe('when the store throws', () => {
      let warn: MockInstance<typeof console.warn>

      beforeEach(() => {
        warn = vi.spyOn(console, 'warn').mockImplementation((): void => {})
      })

      afterEach(() => {
        warn.mockRestore()
      })

      it('warns instead of breaking the caller', () => {
        fake.getState.mockImplementation((): never => {
          throw new Error('store is gone')
        })

        expect(() => makeProvisioner(fake).ensureCarInventory('route-1')).not.toThrow()
        expect(warn).toHaveBeenCalledWith('[AutoLines]', 'ensureCarInventory', expect.any(Error))
      })

      it('warns when buying the cars fails', () => {
        fake.state.buyTrains = vi.fn((): never => {
          throw new Error('purchase rejected')
        })

        expect(() => makeProvisioner(fake).ensureCarInventory('route-1')).not.toThrow()
        expect(warn).toHaveBeenCalledWith('[AutoLines]', 'ensureCarInventory', expect.any(Error))
      })
    })
  })

  describe('spawnForSchedule', () => {
    let fake: FakeGameStore

    beforeEach(() => {
      fake = createFakeGameStore({
        generateTrain: vi.fn(),
        ownedTrainCount: 30,
        routes: [makeRoute()],
        spawnTrainAtStation: vi.fn(),
        timeConfig: { elapsedSeconds: MORNING_RUSH },
        trains: [],
      })
    })

    it('spawns the current demand tier’s trains spaced across the line', () => {
      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(4)
      expect(fake.state.spawnTrainAtStation).toHaveBeenNthCalledWith(1, 'route-1', 0)
      expect(fake.state.spawnTrainAtStation).toHaveBeenNthCalledWith(2, 'route-1', 1)
      expect(fake.state.spawnTrainAtStation).toHaveBeenNthCalledWith(3, 'route-1', 2)
      expect(fake.state.spawnTrainAtStation).toHaveBeenNthCalledWith(4, 'route-1', 3)
    })

    it('spawns the midday count outside rush hour', () => {
      fake.state.timeConfig = { elapsedSeconds: MIDDAY }

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(2)
    })

    it('falls back to the low-demand count for a tier the schedule omits', () => {
      fake.state.timeConfig = { elapsedSeconds: DEEP_NIGHT }

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(SCHEDULE.lowDemand)
    })

    it('honours the deep-night count when the schedule carries one', () => {
      fake.state.timeConfig = { elapsedSeconds: DEEP_NIGHT }

      makeProvisioner(fake).spawnForSchedule('route-1', { ...SCHEDULE, veryLowDemand: 3 })

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(3)
    })

    it('reads the clock as midnight when the game reports no time', () => {
      delete fake.state.timeConfig

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(SCHEDULE.lowDemand)
    })

    it('stops at the fleet cap, re-reading the live train list as it spawns', () => {
      fake.state.ownedTrainCount = 2
      fake.state.spawnTrainAtStation = vi.fn((routeId: string): void => {
        fake.state.trains = [...fake.state.trains ?? [], { id: `train-${routeId}`, routeId }]
      })

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(2)
    })

    it('treats an absent train list as an empty fleet', () => {
      delete fake.state.trains

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(4)
    })

    it('falls back to a plain spawn when the game cannot place a train at a station', () => {
      delete fake.state.spawnTrainAtStation

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.generateTrain).toHaveBeenCalledTimes(4)
      expect(fake.state.generateTrain).toHaveBeenCalledWith('route-1')
    })

    it('does nothing when the game can spawn no trains at all', () => {
      delete fake.state.spawnTrainAtStation
      delete fake.state.generateTrain

      expect(() => makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)).not.toThrow()
    })

    it('skips a station that rejects the spawn and keeps going', () => {
      fake.state.spawnTrainAtStation = vi.fn((_routeId: string, index: number): void => {
        if (index === 1) {
          throw new Error('platform conflict')
        }
      })

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(4)
    })

    it('spawns at the only index a line with no stations can offer', () => {
      fake.state.routes = [makeRoute({ stNodes: [] })]

      makeProvisioner(fake).spawnForSchedule('route-1', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).toHaveBeenCalledTimes(4)
      expect(fake.state.spawnTrainAtStation).toHaveBeenNthCalledWith(4, 'route-1', 0)
    })

    it('does nothing for a line that no longer exists', () => {
      makeProvisioner(fake).spawnForSchedule('gone', SCHEDULE)

      expect(fake.state.spawnTrainAtStation).not.toHaveBeenCalled()
    })
  })
})
