import type { Mock, MockInstance } from 'vitest'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewRouteChange } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import { RoutePreviewEditor } from '@/infrastructure/routing/RoutePreviewEditor'

import type { FakeGameStore } from '../fakeGameStore'

import { createFakeGameStore } from '../fakeGameStore'

interface PreviewGame extends FakeGameStore {
  ordered: string[]
}

interface PreviewGameOptions {
  // Ids the game's own pool knows: an id absent here is silently ignored, the way
  // changePreviewRoute drops an stNode that isn't in state.stNodes.
  knownStNodeIds?: string[]
  routes?: Route[]
  // Ids the path solver can't reach, which makes batchPreviewRouteUpdates throw
  // "No valid path found between station tracks" (usually a missing crossover).
  unpathableStNodeIds?: string[]
}

function makeRoute(overrides: Partial<Route> = {}): Route {
  return { id: 'route-1', stNodes: [{ id: 'node-a', center: [0, 0] }], ...overrides }
}

function idsOf(route: null | Route | undefined): string[] {
  return (route?.stNodes ?? []).map((node) => node.id)
}

// Models the game's preview flow closely enough to exercise the editor's
// contract: a preview opened off a route, one queued change at a time, an async
// batch that either grows the preview or throws, and a commit that writes back.
function createPreviewGame(options: PreviewGameOptions = {}): PreviewGame {
  const known = new Set(options.knownStNodeIds ?? ['node-b', 'node-c'])
  const unpathable = new Set(options.unpathableStNodeIds ?? [])
  const ordered: string[] = []
  let pending: PreviewRouteChange[] = []

  const fake = createFakeGameStore({
    previewRoute: null,
    routes: options.routes ?? [makeRoute()],

    setPreviewRoute: vi.fn((route: null | Route): void => {
      fake.state.previewRoute = route
    }),

    setManualRouteOrdering: vi.fn(),

    clearPendingStNodeChanges: vi.fn((): void => {
      pending = []
    }),

    changePreviewRoute: vi.fn((change: PreviewRouteChange): void => {
      pending.push(change)
    }),

    batchPreviewRouteUpdates: vi.fn((): Promise<void> => {
      const changes = pending
      pending = []
      for (const change of changes) {
        if (unpathable.has(change.stNodeId)) {
          return Promise.reject(new Error('No valid path found between station tracks'))
        }
        const preview = fake.state.previewRoute
        if (!preview || !known.has(change.stNodeId)) {
          continue
        }
        ordered.push(change.stNodeId)
        fake.state.previewRoute = {
          ...preview,
          stNodes: [...preview.stNodes, { id: change.stNodeId, center: [0, 0] }],
        }
      }
      return Promise.resolve()
    }),

    confirmRouteChange: vi.fn((): void => {
      const preview = fake.state.previewRoute
      if (!preview) {
        return
      }
      fake.state.routes = (fake.state.routes ?? []).map((route) => (
        route.id === preview.id ? { ...preview } : route
      ))
      fake.state.previewRoute = null
    }),

    setRoutes: vi.fn((routes: Route[]): void => {
      fake.state.routes = routes
    }),

    setTrains: vi.fn(),
  })

  return { ...fake, ordered }
}

describe('RoutePreviewEditor', () => {
  let begin: MockInstance<() => void>
  let end: MockInstance<() => void>
  let game: PreviewGame
  let guard: RouteEditGuard
  let maintenance: RouteMaintenance
  let stripTempRoutes: MockInstance<() => void>

  function makeEditor(previewGame: PreviewGame): RoutePreviewEditor {
    game = previewGame
    maintenance = new RouteMaintenance(previewGame.store)
    stripTempRoutes = vi.spyOn(maintenance, 'stripTempRoutes')
    return new RoutePreviewEditor(previewGame.store, guard, maintenance)
  }

  function previewCalls(): Array<null | Route> {
    const setPreviewRoute = game.state.setPreviewRoute as Mock<(route: null | Route) => void>
    return setPreviewRoute.mock.calls.map(([route]) => route)
  }

  beforeEach(() => {
    guard = new RouteEditGuard()
    begin = vi.spyOn(guard, 'begin')
    end = vi.spyOn(guard, 'end')
  })

  describe('growPreview', () => {
    it('claims the route-edit guard before opening the preview', async () => {
      const editor = makeEditor(createPreviewGame())
      const order: string[] = []
      begin.mockImplementation((): void => {
        order.push('guard')
      })
      game.state.setPreviewRoute = vi.fn((route: null | Route): void => {
        order.push('preview')
        game.state.previewRoute = route
      })

      await editor.growPreview(makeRoute(), ['node-b'])

      expect(order[0]).toBe('guard')
      expect(order[1]).toBe('preview')
    })

    it('opens the preview off a copy of the line, not the stored object', async () => {
      const editor = makeEditor(createPreviewGame())
      const route = makeRoute()

      await editor.growPreview(route, [])

      expect(previewCalls()[0]).toEqual(route)
      expect(previewCalls()[0]).not.toBe(route)
    })

    it('hands the ordering back to the game', async () => {
      const editor = makeEditor(createPreviewGame())

      await editor.growPreview(makeRoute(), ['node-b'])

      expect(game.state.setManualRouteOrdering).toHaveBeenCalledWith(false)
    })

    it('builds the preview when the game cannot be told how to order it', async () => {
      const editor = makeEditor(createPreviewGame())
      delete game.state.setManualRouteOrdering

      const grown = await editor.growPreview(makeRoute(), ['node-b'])

      expect(idsOf(grown)).toEqual(['node-a', 'node-b'])
    })

    // findRoutePathOrder rejects an all-at-once dump, and an empty route only
    // bootstraps incrementally — so this must stay one node per batch.
    it('adds one node at a time, batching after each', async () => {
      const editor = makeEditor(createPreviewGame())

      await editor.growPreview(makeRoute(), ['node-b', 'node-c'])

      expect(game.state.changePreviewRoute).toHaveBeenCalledTimes(2)
      expect(game.state.batchPreviewRouteUpdates).toHaveBeenCalledTimes(2)
      expect(game.state.changePreviewRoute).toHaveBeenNthCalledWith(1, { stNodeId: 'node-b', action: 'add' })
      expect(game.state.changePreviewRoute).toHaveBeenNthCalledWith(2, { stNodeId: 'node-c', action: 'add' })
      expect(game.ordered).toEqual(['node-b', 'node-c'])
    })

    it('clears the queued changes before each node, so none is applied twice', async () => {
      const editor = makeEditor(createPreviewGame())

      await editor.growPreview(makeRoute(), ['node-b', 'node-c'])

      expect(game.state.clearPendingStNodeChanges).toHaveBeenCalledTimes(2)
    })

    it('adds the nodes when the game exposes no queue reset', async () => {
      const editor = makeEditor(createPreviewGame())
      delete game.state.clearPendingStNodeChanges

      const grown = await editor.growPreview(makeRoute(), ['node-b'])

      expect(idsOf(grown)).toEqual(['node-a', 'node-b'])
    })

    it('returns the grown preview', async () => {
      const editor = makeEditor(createPreviewGame())

      const grown = await editor.growPreview(makeRoute(), ['node-b', 'node-c'])

      expect(idsOf(grown)).toEqual(['node-a', 'node-b', 'node-c'])
    })

    it('returns nothing when it is asked to add no nodes', async () => {
      const editor = makeEditor(createPreviewGame())

      expect(await editor.growPreview(makeRoute(), [])).toBeNull()
    })

    it('rolls the preview back to the last good one when a node cannot be pathed', async () => {
      const editor = makeEditor(createPreviewGame({ unpathableStNodeIds: ['node-c'] }))

      const grown = await editor.growPreview(makeRoute(), ['node-b', 'node-c'])

      expect(idsOf(grown)).toEqual(['node-a', 'node-b'])
      expect(idsOf(game.state.previewRoute)).toEqual(['node-a', 'node-b'])
    })

    it('rolls the preview back when the game silently ignores a node', async () => {
      const editor = makeEditor(createPreviewGame({ knownStNodeIds: ['node-b'] }))

      const grown = await editor.growPreview(makeRoute(), ['node-b', 'node-c'])

      expect(idsOf(grown)).toEqual(['node-a', 'node-b'])
      expect(game.state.setPreviewRoute).toHaveBeenLastCalledWith(grown)
    })

    it('returns nothing when no node could be added at all', async () => {
      const editor = makeEditor(createPreviewGame({ knownStNodeIds: [] }))

      expect(await editor.growPreview(makeRoute(), ['node-b'])).toBeNull()
    })

    it('returns nothing when the game accepts no preview to grow', async () => {
      const editor = makeEditor(createPreviewGame())
      game.state.setPreviewRoute = vi.fn()

      expect(await editor.growPreview(makeRoute(), ['node-b'])).toBeNull()
    })
  })

  describe('applyAdditions', () => {
    it('commits the grown preview onto the line', async () => {
      const editor = makeEditor(createPreviewGame())

      const result = await editor.applyAdditions('route-1', ['node-b', 'node-c'])

      expect(result).toEqual({ committed: true })
      expect(idsOf(game.state.routes?.[0])).toEqual(['node-a', 'node-b', 'node-c'])
    })

    // This method opens the preview and takes the guard, so it owns unwinding them.
    // A throw that left both held is what pops the game's "Unsaved Route Changes"
    // modal, and the caller has no handle on the preview to clean up itself.
    describe('when the commit throws', () => {
      function throwingEditor(): RoutePreviewEditor {
        const editor = makeEditor(createPreviewGame())
        game.state.confirmRouteChange = vi.fn((): never => {
          throw new Error('the game rejected the change')
        })
        return editor
      }

      it('lets the failure through', async () => {
        await expect(throwingEditor().applyAdditions('route-1', ['node-b'])).rejects.toThrow()
      })

      it('closes the preview it opened', async () => {
        const editor = throwingEditor()
        await editor.applyAdditions('route-1', ['node-b']).catch(() => {})
        const calls = previewCalls()
        expect(calls[calls.length - 1]).toBeNull()
      })

      it('releases the route-edit guard', async () => {
        const editor = throwingEditor()
        await editor.applyAdditions('route-1', ['node-b']).catch(() => {})
        expect(end).toHaveBeenCalled()
      })
    })

    it('releases the route-edit guard once the preview is committed', async () => {
      const editor = makeEditor(createPreviewGame())

      await editor.applyAdditions('route-1', ['node-b'])

      expect(begin).toHaveBeenCalledTimes(1)
      expect(end).toHaveBeenCalledTimes(1)
    })

    it('cleans up the temp routes the commit leaves behind', async () => {
      const editor = makeEditor(createPreviewGame())

      await editor.applyAdditions('route-1', ['node-b'])

      expect(stripTempRoutes).toHaveBeenCalledTimes(1)
    })

    it('refuses a line that is not in the game', async () => {
      const editor = makeEditor(createPreviewGame())

      await expect(editor.applyAdditions('gone', ['node-b'])).rejects.toThrow('line not found')
    })

    it('discards the preview and releases the guard when nothing could be added', async () => {
      const editor = makeEditor(createPreviewGame({ knownStNodeIds: [] }))

      const result = await editor.applyAdditions('route-1', ['node-b'])

      expect(result).toEqual({ committed: false })
      expect(game.state.setPreviewRoute).toHaveBeenLastCalledWith(null)
      expect(game.state.confirmRouteChange).not.toHaveBeenCalled()
      expect(end).toHaveBeenCalledTimes(1)
    })

    it('reports no commit when the line did not actually grow', async () => {
      const editor = makeEditor(createPreviewGame())
      delete game.state.confirmRouteChange

      const result = await editor.applyAdditions('route-1', ['node-b'])

      expect(result).toEqual({ committed: false })
      expect(stripTempRoutes).toHaveBeenCalledTimes(1)
    })

    it('reports no commit when the commit consolidated the line away', async () => {
      const editor = makeEditor(createPreviewGame())
      game.state.confirmRouteChange = vi.fn((): void => {
        game.state.routes = []
      })

      const result = await editor.applyAdditions('route-1', ['node-b'])

      expect(result).toEqual({ committed: false })
    })

    // The line's own stops repeat in the out-and-back sequence, so growth has to be
    // measured on distinct ids, not on the raw length.
    it('measures growth on distinct stations, not the out-and-back sequence', async () => {
      const outAndBack = makeRoute({
        stNodes: [
          { id: 'node-a', center: [0, 0] },
          { id: 'node-z', center: [1, 0] },
          { id: 'node-a', center: [0, 0] },
        ],
      })
      const editor = makeEditor(createPreviewGame({ routes: [outAndBack] }))

      const result = await editor.applyAdditions('route-1', ['node-b'])

      expect(result).toEqual({ committed: true })
    })
  })
})
