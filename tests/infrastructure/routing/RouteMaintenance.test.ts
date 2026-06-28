import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Route } from '@/shared/game/Route'
import type { Train } from '@/shared/game/Train'

import { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'

import type { FakeGameStore } from '../fakeGameStore'

import { createFakeGameStore } from '../fakeGameStore'

function makeRoute(overrides: Partial<Route> = {}): Route {
  return { id: 'route-1', stNodes: [{ id: 'node-1', center: [0, 0] }], ...overrides }
}

function makeTrain(routeId: string): Train {
  return { id: `train-of-${routeId}`, routeId }
}

describe('RouteMaintenance', () => {
  let fake: FakeGameStore
  let maintenance: RouteMaintenance

  beforeEach(() => {
    fake = createFakeGameStore({
      routes: [makeRoute()],
      trains: [makeTrain('route-1')],
      setRoutes: vi.fn(),
      setTrains: vi.fn(),
    })
    maintenance = new RouteMaintenance(fake.store)
  })

  describe('purgeOrphanTrains', () => {
    // An orphaned train makes the game loop throw "Route not found for train …"
    // every tick, and the game autosaves that state.
    it('drops a train whose line is gone and keeps the rest', () => {
      fake.state.trains = [makeTrain('route-1'), makeTrain('deleted-route')]

      maintenance.purgeOrphanTrains()

      expect(fake.state.setTrains).toHaveBeenCalledWith([makeTrain('route-1')])
    })

    it('leaves the fleet untouched when every train still has its line', () => {
      maintenance.purgeOrphanTrains()

      expect(fake.state.setTrains).not.toHaveBeenCalled()
    })

    it('drops every train when no line survives', () => {
      delete fake.state.routes

      maintenance.purgeOrphanTrains()

      expect(fake.state.setTrains).toHaveBeenCalledWith([])
    })

    it('does nothing when the game has no trains', () => {
      delete fake.state.trains

      maintenance.purgeOrphanTrains()

      expect(fake.state.setTrains).not.toHaveBeenCalled()
    })

    it('does nothing when the game exposes no train setter', () => {
      delete fake.state.setTrains
      fake.state.trains = [makeTrain('deleted-route')]

      expect(() => maintenance.purgeOrphanTrains()).not.toThrow()
    })
  })

  describe('stripTempRoutes', () => {
    it('drops a preview/temp route and keeps the real lines', () => {
      fake.state.routes = [makeRoute(), makeRoute({ id: 'temp-1', tempParentId: 'route-1' })]

      maintenance.stripTempRoutes()

      expect(fake.state.setRoutes).toHaveBeenCalledWith([makeRoute()], true)
    })

    it('drops a leaked empty route the game would otherwise autosave as junk', () => {
      fake.state.routes = [makeRoute(), makeRoute({ id: 'ghost', stNodes: [] })]

      maintenance.stripTempRoutes()

      expect(fake.state.setRoutes).toHaveBeenCalledWith([makeRoute()], true)
    })

    it('drops a route with no station list at all', () => {
      fake.state.routes = [{ id: 'ghost' } as Route]

      maintenance.stripTempRoutes()

      expect(fake.state.setRoutes).toHaveBeenCalledWith([], true)
    })

    it('leaves the lines untouched when there is nothing to strip', () => {
      maintenance.stripTempRoutes()

      expect(fake.state.setRoutes).not.toHaveBeenCalled()
    })

    // The game moves a line's train onto the temp route it spawns when a stop is
    // dropped, so stripping that route is exactly what orphans the train.
    it('purges the trains the stripped route leaves behind, after dropping it', () => {
      const calls: string[] = []
      fake.state.routes = [makeRoute(), makeRoute({ id: 'temp-1', tempParentId: 'route-1' })]
      fake.state.trains = [makeTrain('route-1'), makeTrain('temp-1')]
      fake.state.setRoutes = vi.fn((routes: Route[]): void => {
        calls.push('setRoutes')
        fake.state.routes = routes
      })
      fake.state.setTrains = vi.fn((): void => {
        calls.push('setTrains')
      })

      maintenance.stripTempRoutes()

      expect(calls).toEqual(['setRoutes', 'setTrains'])
      expect(fake.state.setTrains).toHaveBeenCalledWith([makeTrain('route-1')])
    })

    it('still purges orphan trains when there is nothing to strip', () => {
      fake.state.trains = [makeTrain('deleted-route')]

      maintenance.stripTempRoutes()

      expect(fake.state.setTrains).toHaveBeenCalledWith([])
    })

    it('purges orphan trains even when the game exposes no route setter', () => {
      delete fake.state.setRoutes
      fake.state.routes = [makeRoute({ id: 'temp-1', tempParentId: 'route-1' })]

      maintenance.stripTempRoutes()

      expect(fake.state.setTrains).toHaveBeenCalledWith([])
    })

    it('strips nothing when the game reports no routes', () => {
      delete fake.state.routes

      maintenance.stripTempRoutes()

      expect(fake.state.setRoutes).not.toHaveBeenCalled()
    })
  })
})
