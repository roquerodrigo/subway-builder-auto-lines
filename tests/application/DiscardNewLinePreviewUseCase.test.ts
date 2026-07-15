import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { DiscardNewLinePreviewUseCase } from '@/application/DiscardNewLinePreviewUseCase'
import { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import { GameStore } from '@/infrastructure/store/GameStore'

const TEMP_ROUTE_ID = 'route-temp'

function committedRoute(): Route {
  return { id: 'route-1', stNodes: [{ center: [0, 0], id: 'node-1' }] }
}

// The use case is exercised against the real guard and the real maintenance over a
// fake store: the order it unwinds in (clear preview → release guard → delete →
// sweep) is only meaningful against collaborators that touch the game for real.
function createFixture(overrides: Partial<GameState> = {}) {
  const setPreviewRoute = vi.fn((route: null | Route): void => {
    state.previewRoute = route
  })
  // The game's deleteRoute drops the route AND its trains — unlike setRoutes, which
  // is why the mod must never delete a route through the latter.
  const deleteRoute = vi.fn((routeId: string): void => {
    state.routes = (state.routes ?? []).filter((route) => route.id !== routeId)
    state.trains = (state.trains ?? []).filter((train) => train.routeId !== routeId)
  })
  const setRoutes = vi.fn((routes: Route[]): void => {
    state.routes = routes
  })
  const state: GameState = {
    deleteRoute,
    money: 0,
    ownedTrainCount: 0,
    previewRoute: tempRoute(),
    routes: [committedRoute(), tempRoute()],
    setPreviewRoute,
    setRoutes,
    setTrains: (trains) => {
      state.trains = trains
    },
    tracks: [],
    trains: [{ id: 'train-1', routeId: TEMP_ROUTE_ID }],
    ...overrides,
  }
  const store = new GameStore({ getState: () => state })
  const guard = new RouteEditGuard()
  const guardEnd = vi.spyOn(guard, 'end')
  const useCase = new DiscardNewLinePreviewUseCase(store, guard, new RouteMaintenance(store))

  return { deleteRoute, guardEnd, setPreviewRoute, setRoutes, state, useCase }
}

function tempRoute(): Route {
  return { id: TEMP_ROUTE_ID, stNodes: [], tempParentId: 'route-1' }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DiscardNewLinePreviewUseCase', () => {
  it('clears the preview the game is showing', () => {
    const { setPreviewRoute, state, useCase } = createFixture()
    useCase.execute(TEMP_ROUTE_ID)
    expect(setPreviewRoute).toHaveBeenCalledWith(null)
    expect(state.previewRoute).toBeNull()
  })

  it('releases the route-edit guard, so the game stops treating the preview as an unsaved change', () => {
    const { guardEnd, useCase } = createFixture()
    useCase.execute(TEMP_ROUTE_ID)
    expect(guardEnd).toHaveBeenCalledTimes(1)
  })

  it('deletes the temp route it is given', () => {
    const { deleteRoute, useCase } = createFixture()
    useCase.execute(TEMP_ROUTE_ID)
    expect(deleteRoute).toHaveBeenCalledWith(TEMP_ROUTE_ID)
  })

  it('deletes nothing when there is no temp route to discard', () => {
    const { deleteRoute, useCase } = createFixture()
    useCase.execute(null)
    expect(deleteRoute).not.toHaveBeenCalled()
  })

  it('sweeps the temp routes the game left behind', () => {
    const { setRoutes, state, useCase } = createFixture()
    useCase.execute(null)
    expect(setRoutes).toHaveBeenCalled()
    expect(state.routes).toEqual([committedRoute()])
  })

  // A train left pointing at a route that no longer exists throws
  // "Route not found for train …" on every game tick, and the game autosaves it.
  it('purges the trains the swept temp route leaves orphaned', () => {
    const { state, useCase } = createFixture()
    useCase.execute(null)
    expect(state.trains).toEqual([])
  })

  it('still unwinds the rest when clearing the preview throws', () => {
    const { deleteRoute, guardEnd, useCase } = createFixture({
      setPreviewRoute: () => {
        throw new Error('preview rejected')
      },
    })
    useCase.execute(TEMP_ROUTE_ID)
    expect(guardEnd).toHaveBeenCalledTimes(1)
    expect(deleteRoute).toHaveBeenCalledWith(TEMP_ROUTE_ID)
  })

  it('still sweeps the temp routes when deleting throws', () => {
    const { setRoutes, useCase } = createFixture({
      deleteRoute: () => {
        throw new Error('route is gone')
      },
    })
    useCase.execute(TEMP_ROUTE_ID)
    expect(setRoutes).toHaveBeenCalled()
  })

  it('does nothing at all when the game exposes none of the route actions', () => {
    const { useCase } = createFixture({
      deleteRoute: undefined,
      setPreviewRoute: undefined,
      setRoutes: undefined,
      setTrains: undefined,
    })
    expect(() => useCase.execute(TEMP_ROUTE_ID)).not.toThrow()
  })
})
