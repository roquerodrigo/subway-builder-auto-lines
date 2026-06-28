import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GameState } from '@/shared/game/GameState'
import type { Route, StComboTiming } from '@/shared/game/Route'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

import { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { GameStore } from '@/infrastructure/store/GameStore'
import { logger } from '@/shared/Logger'

const ROUTE_ID = 'route-1'
// A half-hour round trip: 6 trains at the 5-min peak headway, 1 at the 30-min night one.
const CYCLE_SECONDS = 1800
const SCHEDULE_FOR_CYCLE: TrainSchedule = {
  highDemand: 6,
  mediumDemand: 3,
  lowDemand: 2,
  veryLowDemand: 1,
}

function routeWithTimings(stComboTimings: StComboTiming[] | undefined): Route {
  return { id: ROUTE_ID, stNodes: [{ id: 'node-1', center: [0, 0] }], stComboTimings }
}

function createFixture(overrides: Partial<GameState> = {}) {
  const updateRouteProperty = vi.fn()
  const state: GameState = {
    money: 0,
    ownedTrainCount: 0,
    routes: [routeWithTimings([{ departureTime: CYCLE_SECONDS }])],
    tracks: [],
    updateRouteProperty,
    ...overrides,
  }
  const store = new GameStore({ getState: () => state })
  const fleet = new FleetProvisioner(store, new TrainTypeCatalog({}))
  const ensureCarInventory = vi.spyOn(fleet, 'ensureCarInventory').mockImplementation(() => {})
  const spawnForSchedule = vi.spyOn(fleet, 'spawnForSchedule').mockImplementation(() => {})
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  return {
    ensureCarInventory,
    spawnForSchedule,
    state,
    updateRouteProperty,
    warn,
    useCase: new ProvisionServiceUseCase(store, fleet),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProvisionServiceUseCase', () => {
  it('sets a train schedule derived from the route round-trip cycle', () => {
    const { updateRouteProperty, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(updateRouteProperty).toHaveBeenCalledWith(ROUTE_ID, 'trainSchedule', SCHEDULE_FOR_CYCLE)
  })

  it('reads the cycle off the last stop timing, not the first', () => {
    const { updateRouteProperty, useCase } = createFixture({
      routes: [routeWithTimings([{ departureTime: 60 }, { departureTime: CYCLE_SECONDS }])],
    })
    useCase.execute(ROUTE_ID)
    expect(updateRouteProperty).toHaveBeenCalledWith(ROUTE_ID, 'trainSchedule', SCHEDULE_FOR_CYCLE)
  })

  it('grants the car inventory the line needs to run and to be lengthened', () => {
    const { ensureCarInventory, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory).toHaveBeenCalledWith(ROUTE_ID)
  })

  it('spawns the trains the schedule calls for right away', () => {
    const { spawnForSchedule, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(spawnForSchedule).toHaveBeenCalledWith(ROUTE_ID, SCHEDULE_FOR_CYCLE)
  })

  // The game gates spawning on the car inventory, so the cars have to land first.
  it('grants the cars before spawning the trains that need them', () => {
    const { ensureCarInventory, spawnForSchedule, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory.mock.invocationCallOrder[0])
      .toBeLessThan(spawnForSchedule.mock.invocationCallOrder[0])
  })

  it('provisions nothing when the line is not in the game', () => {
    const { ensureCarInventory, updateRouteProperty, useCase } = createFixture()
    useCase.execute('no-such-route')
    expect(updateRouteProperty).not.toHaveBeenCalled()
    expect(ensureCarInventory).not.toHaveBeenCalled()
  })

  it('provisions nothing when the game holds no lines at all', () => {
    const { ensureCarInventory, useCase } = createFixture({ routes: undefined })
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory).not.toHaveBeenCalled()
  })

  // A route the game has not timed yet has no cycle to derive a headway from.
  it('provisions nothing when the line has no timings yet', () => {
    const { ensureCarInventory, updateRouteProperty, useCase } = createFixture({
      routes: [routeWithTimings(undefined)],
    })
    useCase.execute(ROUTE_ID)
    expect(updateRouteProperty).not.toHaveBeenCalled()
    expect(ensureCarInventory).not.toHaveBeenCalled()
  })

  it('provisions nothing when the line timings are empty', () => {
    const { ensureCarInventory, useCase } = createFixture({ routes: [routeWithTimings([])] })
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory).not.toHaveBeenCalled()
  })

  it('provisions nothing when the round-trip cycle is zero', () => {
    const { ensureCarInventory, useCase } = createFixture({
      routes: [routeWithTimings([{ departureTime: 0 }])],
    })
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory).not.toHaveBeenCalled()
  })

  it('provisions nothing when the round-trip cycle is negative', () => {
    const { ensureCarInventory, useCase } = createFixture({
      routes: [routeWithTimings([{ departureTime: -1 }])],
    })
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory).not.toHaveBeenCalled()
  })

  it('still provisions the fleet when the game exposes no updateRouteProperty', () => {
    const { ensureCarInventory, spawnForSchedule, useCase } = createFixture({
      updateRouteProperty: undefined,
    })
    useCase.execute(ROUTE_ID)
    expect(ensureCarInventory).toHaveBeenCalledWith(ROUTE_ID)
    expect(spawnForSchedule).toHaveBeenCalledWith(ROUTE_ID, SCHEDULE_FOR_CYCLE)
  })

  it('warns and carries on when the game rejects the schedule', () => {
    const rejection = new Error('schedule rejected')
    const { useCase, warn } = createFixture({
      updateRouteProperty: () => {
        throw rejection
      },
    })
    expect(() => useCase.execute(ROUTE_ID)).not.toThrow()
    expect(warn).toHaveBeenCalledWith('provisionService', rejection)
  })

  it('warns and carries on when the fleet cannot be provisioned', () => {
    const { ensureCarInventory, useCase, warn } = createFixture()
    const rejection = new Error('no cars')
    ensureCarInventory.mockImplementation(() => {
      throw rejection
    })
    expect(() => useCase.execute(ROUTE_ID)).not.toThrow()
    expect(warn).toHaveBeenCalledWith('provisionService', rejection)
  })
})
