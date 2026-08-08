import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ServiceSettings } from '@/domain/settings/ServiceSettings'
import type { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import type { GameState } from '@/shared/game/GameState'
import type { Route, StComboTiming } from '@/shared/game/Route'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

import { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'
import { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { GameStore } from '@/infrastructure/store/GameStore'
import { logger } from '@/shared/Logger'

// The panel's settings, as the use case reads them.
function settingsStore(overrides: Partial<ServiceSettings> = {}): ServiceSettingsStore {
  return { current: () => ({ ...DEFAULT_SERVICE_SETTINGS, ...overrides }) } as ServiceSettingsStore
}

const ROUTE_ID = 'route-1'
// A half-hour round trip: 6 trains at the 5-min peak headway, 1 at the 60-min night one.
const CYCLE_SECONDS = 1800
const SCHEDULE_FOR_CYCLE: TrainSchedule = {
  highDemand: 6,
  lowDemand: 1,
  mediumDemand: 2,
  veryLowDemand: 1,
}

function createFixture(overrides: Partial<GameState> = {}, settings: Partial<ServiceSettings> = {}) {
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
  const ensureTrainCapacity = vi.spyOn(fleet, 'ensureTrainCapacity').mockImplementation(() => {})
  const setTrainLength = vi.spyOn(fleet, 'setTrainLength').mockImplementation(() => {})
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

  return {
    ensureCarInventory,
    ensureTrainCapacity,
    setTrainLength,
    spawnForSchedule,
    state,
    updateRouteProperty,
    useCase: new ProvisionServiceUseCase(store, fleet, settingsStore(settings)),
    warn,
  }
}

function routeWithTimings(stComboTimings: StComboTiming[] | undefined): Route {
  return { id: ROUTE_ID, stComboTimings, stNodes: [{ center: [0, 0], id: 'node-1' }] }
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

  it('puts trains as long as the player asked for on the line', () => {
    const { setTrainLength, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(setTrainLength).toHaveBeenCalledWith(ROUTE_ID, DEFAULT_SERVICE_SETTINGS.carsPerTrain)
  })

  it('runs the shorter trains the player settled on', () => {
    const { setTrainLength, useCase } = createFixture({}, { carsPerTrain: 4 })
    useCase.execute(ROUTE_ID)
    expect(setTrainLength).toHaveBeenCalledWith(ROUTE_ID, 4)
  })

  it('serves the line at the headways the player set', () => {
    const { updateRouteProperty, useCase } = createFixture(
      {},
      { headwayMinutes: { midday: 10, night: 30, offPeak: 15, peak: 5 } },
    )
    useCase.execute(ROUTE_ID)
    expect(updateRouteProperty).toHaveBeenCalledWith(ROUTE_ID, 'trainSchedule', {
      highDemand: 6,
      lowDemand: 2,
      mediumDemand: 3,
      veryLowDemand: 1,
    })
  })

  // With auto trains off the mod still builds the line, it just leaves the service
  // to the player.
  it('leaves the line without service when the player switched auto trains off', () => {
    const {
      ensureCarInventory,
      ensureTrainCapacity,
      setTrainLength,
      spawnForSchedule,
      updateRouteProperty,
      useCase,
    } = createFixture({}, { autoTrains: false })
    useCase.execute(ROUTE_ID)
    expect(setTrainLength).not.toHaveBeenCalled()
    expect(updateRouteProperty).not.toHaveBeenCalled()
    expect(ensureCarInventory).not.toHaveBeenCalled()
    expect(spawnForSchedule).not.toHaveBeenCalled()
    expect(ensureTrainCapacity).not.toHaveBeenCalled()
  })

  // A longer train dwells longer at every stop, so the game recomputes the round
  // trip from it — and the round trip is what the schedule divides.
  it('lengthens the trains before deriving the schedule from the round trip', () => {
    const { setTrainLength, updateRouteProperty, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(setTrainLength.mock.invocationCallOrder[0])
      .toBeLessThan(updateRouteProperty.mock.invocationCallOrder[0])
  })

  it('derives the schedule from the round trip the longer trains make', () => {
    const state: GameState = {
      money: 0,
      ownedTrainCount: 0,
      routes: [routeWithTimings([{ departureTime: CYCLE_SECONDS }])],
      tracks: [],
      updateRouteProperty: vi.fn(),
    }
    const store = new GameStore({ getState: () => state })
    const fleet = new FleetProvisioner(store, new TrainTypeCatalog({}))
    vi.spyOn(fleet, 'ensureCarInventory').mockImplementation(() => {})
    vi.spyOn(fleet, 'ensureTrainCapacity').mockImplementation(() => {})
    vi.spyOn(fleet, 'spawnForSchedule').mockImplementation(() => {})
    vi.spyOn(fleet, 'setTrainLength').mockImplementation(() => {
      state.routes = [routeWithTimings([{ departureTime: CYCLE_SECONDS * 2 }])]
    })

    new ProvisionServiceUseCase(store, fleet, settingsStore()).execute(ROUTE_ID)

    expect(state.updateRouteProperty).toHaveBeenCalledWith(ROUTE_ID, 'trainSchedule', {
      highDemand: 12,
      lowDemand: 2,
      mediumDemand: 4,
      veryLowDemand: 1,
    })
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

  // Spawning stops dead at the fleet cap, so it has to clear the schedule first.
  it('raises the fleet cap before spawning the trains it has to hold', () => {
    const { ensureTrainCapacity, spawnForSchedule, useCase } = createFixture()
    useCase.execute(ROUTE_ID)
    expect(ensureTrainCapacity).toHaveBeenCalled()
    expect(ensureTrainCapacity.mock.invocationCallOrder[0])
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
