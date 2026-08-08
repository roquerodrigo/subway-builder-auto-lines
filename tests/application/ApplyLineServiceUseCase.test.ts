import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import type { LineService } from '@/domain/settings/ServiceSettings'
import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { ApplyLineServiceUseCase } from '@/application/ApplyLineServiceUseCase'
import { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import { GameStore } from '@/infrastructure/store/GameStore'
import { logger } from '@/shared/Logger'

const ROUTE_ID = 'route-1'
const HALF_HOUR = 1800
const OWN_SERVICE: LineService = {
  carsPerTrain: 6,
  headwayMinutes: { midday: 10, night: 30, offPeak: 20, peak: 3 },
}

function createFixture(routes: Route[] = [route()]) {
  window.localStorage.clear()
  const state: GameState = { money: 0, ownedTrainCount: 0, routes, tracks: [] }
  const provision = { execute: vi.fn() }
  const settings = new ServiceSettingsStore()

  return {
    provision,
    settings,
    useCase: new ApplyLineServiceUseCase(
      new GameStore({ getState: () => state }),
      settings,
      provision as unknown as ProvisionServiceUseCase,
    ),
  }
}

function route(overrides: Partial<Route> = {}): Route {
  return { id: ROUTE_ID, stComboTimings: [{ departureTime: HALF_HOUR }], stNodes: [], ...overrides }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApplyLineServiceUseCase', () => {
  it('puts the line on the service it was given', () => {
    const { provision, useCase } = createFixture()

    expect(useCase.execute(ROUTE_ID, OWN_SERVICE)).toBe(true)
    expect(provision.execute).toHaveBeenCalledWith(ROUTE_ID)
  })

  // So extending the line later keeps the service the player picked for it.
  it('remembers it as that line’s own service', () => {
    const { settings, useCase } = createFixture()
    useCase.execute(ROUTE_ID, OWN_SERVICE)

    expect(settings.current().serviceByRoute).toEqual({ [ROUTE_ID]: OWN_SERVICE })
    expect(new ServiceSettingsStore().current().serviceByRoute).toEqual({ [ROUTE_ID]: OWN_SERVICE })
  })

  it('remembers it before provisioning, so the line is built on it', () => {
    const { provision, settings, useCase } = createFixture()
    provision.execute.mockImplementation(() => {
      expect(settings.current().serviceByRoute[ROUTE_ID]).toEqual(OWN_SERVICE)
    })

    useCase.execute(ROUTE_ID, OWN_SERVICE)

    expect(provision.execute).toHaveBeenCalled()
  })

  it('puts the line back on the city-wide settings when given those', () => {
    const { settings, useCase } = createFixture()
    useCase.execute(ROUTE_ID, OWN_SERVICE)

    const cityWide = settings.current()
    useCase.execute(ROUTE_ID, { carsPerTrain: cityWide.carsPerTrain, headwayMinutes: cityWide.headwayMinutes })

    expect(settings.current().serviceByRoute).toEqual({})
  })

  it('forgets the service of lines that have since been deleted', () => {
    const { settings, useCase } = createFixture()
    settings.save({ ...settings.current(), serviceByRoute: { 'gone-route': OWN_SERVICE } })

    useCase.execute(ROUTE_ID, OWN_SERVICE)

    expect(settings.current().serviceByRoute).toEqual({ [ROUTE_ID]: OWN_SERVICE })
  })

  it('does nothing for a line that is not in the game', () => {
    const { provision, settings, useCase } = createFixture()

    expect(useCase.execute('no-such-route', OWN_SERVICE)).toBe(false)
    expect(provision.execute).not.toHaveBeenCalled()
    expect(settings.current().serviceByRoute).toEqual({})
  })

  // Nothing to divide into headways yet — but the line keeps the service for when
  // the game has timed it.
  it('remembers the service of a line the game has not timed yet', () => {
    const { provision, settings, useCase } = createFixture([route({ stComboTimings: [] })])

    expect(useCase.execute(ROUTE_ID, OWN_SERVICE)).toBe(false)
    expect(provision.execute).not.toHaveBeenCalled()
    expect(settings.current().serviceByRoute).toEqual({ [ROUTE_ID]: OWN_SERVICE })
  })

  it('warns and carries on when the game rejects the service', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { provision, useCase } = createFixture()
    const rejection = new Error('rejected')
    provision.execute.mockImplementation(() => {
      throw rejection
    })

    expect(useCase.execute(ROUTE_ID, OWN_SERVICE)).toBe(false)
    expect(warn).toHaveBeenCalledWith('applyLineService', rejection)
  })
})
