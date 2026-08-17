import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Route } from '@/shared/game/Route'

import { SortLinesUseCase } from '@/application/SortLinesUseCase'
import { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'

import type { FakeGameStore } from '../infrastructure/fakeGameStore'

import { createFakeGameStore } from '../infrastructure/fakeGameStore'

function createFixture(routes: Route[]) {
  window.localStorage.clear()
  const fake: FakeGameStore = createFakeGameStore({ routes, setRoutes: vi.fn() })
  const settings = new ServiceSettingsStore()

  return { fake, settings, useCase: new SortLinesUseCase(fake.store, settings) }
}

function route(id: string, fullName: string, tempParentId?: string): Route {
  return { fullName, id, stNodes: [], tempParentId }
}

function sortedIds(fake: FakeGameStore): string[] {
  const setRoutes = fake.state.setRoutes as unknown as ReturnType<typeof vi.fn>

  return (setRoutes.mock.calls[0][0] as Route[]).map((line) => line.id)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('SortLinesUseCase', () => {
  it('writes the lines back in name order', () => {
    const { fake, useCase } = createFixture([route('b', 'Line 2'), route('a', 'Line 1')])

    expect(useCase.execute()).toBe(true)
    expect(sortedIds(fake)).toEqual(['a', 'b'])
  })

  // Reordering writes the whole array back, which the game reacts to — so a list
  // that is already in order is left alone.
  it('leaves a list that is already in order alone', () => {
    const { fake, useCase } = createFixture([route('a', 'Line 1'), route('b', 'Line 2')])

    expect(useCase.execute()).toBe(false)
    expect(fake.state.setRoutes).not.toHaveBeenCalled()
  })

  it('keeps the lines themselves untouched, ordering them only', () => {
    const { fake, useCase } = createFixture([route('b', 'Line 2'), route('a', 'Line 1')])
    useCase.execute()

    const setRoutes = fake.state.setRoutes as unknown as ReturnType<typeof vi.fn>
    expect(setRoutes.mock.calls[0][1]).toBe(false)
  })

  it('does nothing while the player has sorting switched off', () => {
    const { fake, settings, useCase } = createFixture([route('b', 'Line 2'), route('a', 'Line 1')])
    settings.save({ ...settings.current(), sortLinesByName: false })

    expect(useCase.execute()).toBe(false)
    expect(fake.state.setRoutes).not.toHaveBeenCalled()
  })

  it('sorts a city that has no lines yet without touching the game', () => {
    const { fake, useCase } = createFixture([])

    expect(useCase.execute()).toBe(false)
    expect(fake.state.setRoutes).not.toHaveBeenCalled()
  })

  it('sorts nothing into a game version that cannot write routes', () => {
    const { fake, useCase } = createFixture([route('b', 'Line 2'), route('a', 'Line 1')])
    delete fake.state.setRoutes

    expect(useCase.execute()).toBe(true)
  })
})
