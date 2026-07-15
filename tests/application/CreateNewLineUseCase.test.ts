import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'
import type { StationNode } from '@/shared/game/StationNode'
import type { SetTracksArg, Track } from '@/shared/game/Track'

import { CreateNewLineUseCase } from '@/application/CreateNewLineUseCase'
import { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import { TerminusCrossoverFactory } from '@/domain/crossover/TerminusCrossoverFactory'
import { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'
import { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import { RoutePreviewEditor } from '@/infrastructure/routing/RoutePreviewEditor'
import { GameStore } from '@/infrastructure/store/GameStore'
import { findRoute } from '@/shared/game/Route'

import { buildNetwork, point } from '../domain/support/network'

const ROUTE_ID = 'route-1'
const CYCLE_SECONDS = 1800
// What generateRoute hands back: an auto-assigned letter bullet and a random color,
// both of which the mod overwrites.
const GENERATED_BULLET = 'A'
const GENERATED_COLOR = '#123456'

function crossover(id: string): Track {
  return { id, coords: [[0, 0], [0, 1]], reversable: true, type: 'scissors-crossover' }
}

// A straight three-station corridor with a turnaround at each end.
function corridorNetwork(): GameState {
  return buildNetwork({
    stations: [
      { id: 'a', at: point(0, 0) },
      { id: 'b', at: point(1, 0) },
      { id: 'c', at: point(2, 0) },
    ],
    links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
    crossovers: ['a', 'c'],
  })
}

// A fake game modelling the store's real route-building flow (game-internals §5):
// generateRoute adds an EMPTY route, the preview grows one node at a time, each
// batch publishes a NEW preview object (the mod detects an addition by comparing
// node counts against the preview it kept), and only ids present in state.stNodes
// are honoured.
function createFixture() {
  const network = corridorNetwork()
  const stationNodeById = new Map((network.stNodes ?? []).map((node) => [node.id, node]))
  let pendingStationNodeIds: string[] = []
  let generatedRoutes = 0

  const generateRoute = vi.fn((): Route => {
    generatedRoutes++
    const route: Route = {
      id: `route-${generatedRoutes}`,
      bullet: GENERATED_BULLET,
      color: GENERATED_COLOR,
      stNodes: [],
    }
    state.routes = [...(state.routes ?? []), route]
    return route
  })
  // The game's deleteRoute drops the route AND its trains — unlike setRoutes, which
  // is why the mod must never delete a route through the latter.
  const deleteRoute = vi.fn((routeId: string): void => {
    state.routes = (state.routes ?? []).filter((route) => route.id !== routeId)
    state.trains = (state.trains ?? []).filter((train) => train.routeId !== routeId)
  })
  const setTracks = vi.fn((arg: SetTracksArg): void => {
    state.tracks = arg.newTracks
  })
  const setPreviewRoute = vi.fn((route: null | Route): void => {
    state.previewRoute = route
  })
  const confirmRouteChange = vi.fn((): void => {
    const preview = state.previewRoute
    if (!preview) {
      return
    }
    state.routes = (state.routes ?? []).map((route) => {
      if (route.id !== preview.id) {
        return route
      }
      return { ...route, stNodes: preview.stNodes, stComboTimings: [{ departureTime: CYCLE_SECONDS }] }
    })
    state.previewRoute = null
  })

  const state: GameState = {
    ...network,
    previewRoute: null,
    trains: [],
    confirmRouteChange,
    deleteRoute,
    generateRoute,
    setPreviewRoute,
    setTracks,
    clearPendingStNodeChanges: () => {
      pendingStationNodeIds = []
    },
    changePreviewRoute: (change) => {
      pendingStationNodeIds.push(change.stNodeId)
    },
    batchPreviewRouteUpdates: () => {
      const preview = state.previewRoute
      const added = pendingStationNodeIds
        .map((id) => stationNodeById.get(id))
        .filter((node): node is StationNode => !!node)
      pendingStationNodeIds = []
      if (preview) {
        state.previewRoute = { ...preview, stNodes: [...preview.stNodes, ...added] }
      }
      return Promise.resolve()
    },
    setManualRouteOrdering: () => {},
    setRoutes: (routes) => {
      state.routes = routes
    },
    setTrains: (trains) => {
      state.trains = trains
    },
    updateRouteProperty: vi.fn(),
  }

  const store = new GameStore({ getState: () => state })
  const guard = new RouteEditGuard()
  const guardEnd = vi.spyOn(guard, 'end')
  const maintenance = new RouteMaintenance(store)
  const previewEditor = new RoutePreviewEditor(store, guard, maintenance)
  const provisionService = new ProvisionServiceUseCase(store, new FleetProvisioner(store, new TrainTypeCatalog({})))
  const provision = vi.spyOn(provisionService, 'execute').mockImplementation(() => {})
  const useCase = new CreateNewLineUseCase(
    store,
    guard,
    maintenance,
    new CrossoverInjector(store),
    previewEditor,
    provisionService,
  )
  return {
    deleteRoute,
    generateRoute,
    guardEnd,
    previewEditor,
    provision,
    setPreviewRoute,
    setTracks,
    state,
    useCase,
    builtRoute: () => findRoute(state.routes, ROUTE_ID),
  }
}

function stationNodeIdsOf(route: Route | undefined): string[] {
  return (route?.stNodes ?? []).map((node) => node.id)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CreateNewLineUseCase', () => {
  describe('a path that cannot be a line', () => {
    it('refuses a single station', async () => {
      const { generateRoute, useCase } = createFixture()
      expect(await useCase.execute(['a'])).toBe(false)
      expect(generateRoute).not.toHaveBeenCalled()
    })

    it('refuses an empty path', async () => {
      const { generateRoute, useCase } = createFixture()
      expect(await useCase.execute([])).toBe(false)
      expect(generateRoute).not.toHaveBeenCalled()
    })
  })

  describe('building the line', () => {
    // Both platforms of every through-station, but at each terminus only the one
    // facing into the corridor.
    it('commits the line and reports success', async () => {
      const { builtRoute, useCase } = createFixture()
      expect(await useCase.execute(['a', 'b', 'c'])).toBe(true)
      expect(stationNodeIdsOf(builtRoute())).toEqual(['a#1', 'b#1', 'b#2', 'c#1'])
    })

    // Adding a terminus' second node closes the loop twice and makes a station
    // appear 3× in the route — the corruption signature (game-internals §5).
    it('adds each station node exactly once', async () => {
      const { builtRoute, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      const ids = stationNodeIdsOf(builtRoute())
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('leaves no preview behind once the line is committed', async () => {
      const { state, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(state.previewRoute).toBeNull()
    })

    it('releases the route-edit guard once the preview is committed', async () => {
      const { guardEnd, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(guardEnd).toHaveBeenCalled()
    })

    it('provisions demand-based service on the line it built', async () => {
      const { provision, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(provision).toHaveBeenCalledWith(ROUTE_ID)
    })
  })

  // confirmRouteChange sits behind a licence gate that silently no-ops
  // (game-internals §5), so a commit that never happened looks exactly like one
  // that did unless the route is read back.
  describe('a commit the game silently refuses', () => {
    function refusingFixture(): ReturnType<typeof createFixture> {
      const fixture = createFixture()
      fixture.state.confirmRouteChange = vi.fn()
      return fixture
    }

    it('reports failure rather than claiming the line was built', async () => {
      const { useCase } = refusingFixture()
      expect(await useCase.execute(['a', 'b', 'c'])).toBe(false)
    })

    it('does not provision service for a line that was never committed', async () => {
      const { provision, useCase } = refusingFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(provision).not.toHaveBeenCalled()
    })

    // A preview left open with the guard released is what pops the game's
    // "Unsaved Route Changes" modal.
    it('clears the preview it opened', async () => {
      const { state, useCase } = refusingFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(state.previewRoute).toBeNull()
    })
  })

  describe('the line label', () => {
    it('replaces the auto-assigned letter with the next sequential number', async () => {
      const { builtRoute, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(builtRoute()?.bullet).toBe('1')
    })

    it('numbers the new line after the highest one already built', async () => {
      const { builtRoute, state, useCase } = createFixture()
      const [existingNode] = state.stNodes ?? []
      state.routes = [{ id: 'route-existing', bullet: '3', stNodes: [existingNode] }]
      await useCase.execute(['a', 'b', 'c'])
      expect(builtRoute()?.bullet).toBe('4')
    })

    it('gives the new line a square bullet', async () => {
      const { builtRoute, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(builtRoute()?.shape).toBe('square')
    })

    it('paints the line the color the preview showed', async () => {
      const { builtRoute, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'], '#ff0000')
      expect(builtRoute()?.color).toBe('#ff0000')
    })

    it('keeps the color the game picked when none is given', async () => {
      const { builtRoute, useCase } = createFixture()
      await useCase.execute(['a', 'b', 'c'])
      expect(builtRoute()?.color).toBe(GENERATED_COLOR)
    })

    it('builds the line anyway, on the default bullet, when the game rejects the rewrite', async () => {
      const { builtRoute, state, useCase } = createFixture()
      vi.spyOn(state, 'setRoutes').mockImplementationOnce(() => {
        throw new Error('routes rejected')
      })
      expect(await useCase.execute(['a', 'b', 'c'])).toBe(true)
      expect(builtRoute()?.bullet).toBe(GENERATED_BULLET)
    })
  })

  describe('turnaround crossovers', () => {
    it('builds one at each corridor end, facing the station next to it', async () => {
      const { state, useCase } = createFixture()
      const create = vi.spyOn(TerminusCrossoverFactory, 'create').mockReturnValue(null)
      await useCase.execute(['a', 'b', 'c'])
      expect(create).toHaveBeenCalledTimes(2)
      expect(create).toHaveBeenCalledWith(state, expect.anything(), 'a', 'b')
      expect(create).toHaveBeenCalledWith(state, expect.anything(), 'c', 'b')
    })

    it('writes them into the game alongside the existing tracks', async () => {
      const { setTracks, state, useCase } = createFixture()
      const existing = state.tracks
      vi.spyOn(TerminusCrossoverFactory, 'create')
        .mockReturnValueOnce(crossover('start'))
        .mockReturnValueOnce(crossover('end'))
      await useCase.execute(['a', 'b', 'c'])
      expect(setTracks).toHaveBeenCalledWith({
        newTracks: [...existing, crossover('start'), crossover('end')],
        regenStations: false,
        regenRoutesWithTrackIDs: [],
      })
    })

    // setTracks rebuilds the whole trackGraph, so the reversal edge must exist before
    // the route resolves its turnaround path.
    it('injects them before the route is generated', async () => {
      const { generateRoute, setTracks, useCase } = createFixture()
      vi.spyOn(TerminusCrossoverFactory, 'create').mockReturnValue(crossover('start'))
      await useCase.execute(['a', 'b', 'c'])
      expect(setTracks.mock.invocationCallOrder[0])
        .toBeLessThan(generateRoute.mock.invocationCallOrder[0])
    })

    it('writes nothing when both termini are already turnaround-linked', async () => {
      const { setTracks, useCase } = createFixture()
      vi.spyOn(TerminusCrossoverFactory, 'create').mockReturnValue(null)
      await useCase.execute(['a', 'b', 'c'])
      expect(setTracks).not.toHaveBeenCalled()
    })
  })

  describe('when the game will not build the line', () => {
    it('fails loudly when the game exposes no generateRoute', async () => {
      const { state, useCase } = createFixture()
      state.generateRoute = undefined
      await expect(useCase.execute(['a', 'b', 'c'])).rejects.toThrow('generateRoute is unavailable')
    })

    it('fails loudly when generateRoute hands back nothing', async () => {
      const { generateRoute, useCase } = createFixture()
      // The store's contract says a Route comes back; the mod guards the value
      // anyway, and this is the only way to reach that guard.
      generateRoute.mockReturnValue(undefined as unknown as Route)
      await expect(useCase.execute(['a', 'b', 'c'])).rejects.toThrow('generateRoute is unavailable')
    })

    it('discards and reports failure when the generated route is not in the game', async () => {
      const { deleteRoute, generateRoute, useCase } = createFixture()
      generateRoute.mockReturnValue({ id: 'route-ghost', stNodes: [] })
      expect(await useCase.execute(['a', 'b', 'c'])).toBe(false)
      expect(deleteRoute).toHaveBeenCalledWith('route-ghost')
    })

    // Every route read is guarded because the store contract makes `routes`
    // optional — a snapshot taken before a city is loaded carries none.
    it('discards and reports failure when the snapshot carries no routes at all', async () => {
      const { deleteRoute, generateRoute, state, useCase } = createFixture()
      state.routes = undefined
      generateRoute.mockReturnValue({ id: 'route-ghost', stNodes: [] })
      expect(await useCase.execute(['a', 'b', 'c'])).toBe(false)
      expect(deleteRoute).toHaveBeenCalledWith('route-ghost')
    })

    // Two stations with no track between them: nothing can be added, so the empty
    // route the mod generated must not survive as an autosaved ghost.
    it('discards the empty route when nothing could be added to the preview', async () => {
      const { deleteRoute, state, useCase } = createFixture()
      expect(await useCase.execute(['a', 'c'])).toBe(false)
      expect(deleteRoute).toHaveBeenCalledWith(ROUTE_ID)
      expect(state.routes).toEqual([])
    })

    it('discards a preview that came back covering fewer than two stations', async () => {
      const { deleteRoute, previewEditor, state, useCase } = createFixture()
      const [firstNode] = state.stNodes ?? []
      vi.spyOn(previewEditor, 'growPreview').mockResolvedValue({ id: ROUTE_ID, stNodes: [firstNode] })
      expect(await useCase.execute(['a', 'b', 'c'])).toBe(false)
      expect(deleteRoute).toHaveBeenCalledWith(ROUTE_ID)
    })

    it('clears the preview and releases the guard when it discards', async () => {
      const { guardEnd, setPreviewRoute, state, useCase } = createFixture()
      await useCase.execute(['a', 'c'])
      expect(setPreviewRoute).toHaveBeenLastCalledWith(null)
      expect(state.previewRoute).toBeNull()
      expect(guardEnd).toHaveBeenCalled()
    })

    it('unwinds and rethrows when the preview flow fails', async () => {
      const { deleteRoute, previewEditor, useCase } = createFixture()
      const failure = new Error('No valid path found between station tracks')
      vi.spyOn(previewEditor, 'growPreview').mockRejectedValue(failure)
      await expect(useCase.execute(['a', 'b', 'c'])).rejects.toThrow(failure)
      expect(deleteRoute).toHaveBeenCalledWith(ROUTE_ID)
    })

    it('reports failure even when the cleanup itself fails', async () => {
      const { deleteRoute, useCase } = createFixture()
      deleteRoute.mockImplementation(() => {
        throw new Error('route is gone')
      })
      expect(await useCase.execute(['a', 'c'])).toBe(false)
    })
  })
})
