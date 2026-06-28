import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Endpoint, ForkOption } from '@/domain/line/ExpansionPlan'
import type { GameState } from '@/shared/game/GameState'
import type { SetTracksArg, Track } from '@/shared/game/Track'

import { ExtendLineUseCase } from '@/application/ExtendLineUseCase'
import { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import { TerminusCrossoverFactory } from '@/domain/crossover/TerminusCrossoverFactory'
import { ExpansionPlan } from '@/domain/line/ExpansionPlan'
import { StationIndex } from '@/domain/network/StationIndex'
import { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'
import { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import { RoutePreviewEditor } from '@/infrastructure/routing/RoutePreviewEditor'
import { GameStore } from '@/infrastructure/store/GameStore'

const ROUTE_ID = 'route-1'

function crossover(id: string): Track {
  return { id, coords: [[0, 0], [0, 1]], reversable: true, type: 'scissors-crossover' }
}

function endpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    stationId: 'A',
    name: 'A Station',
    autoStationNodeIds: [],
    autoNames: [],
    autoStationIds: [],
    fork: null,
    ...overrides,
  }
}

function forkTo(stationIds: string[], applyStationNodeIds: string[]): ForkOption {
  const terminus = stationIds[stationIds.length - 1]
  return { stationId: terminus, name: `${terminus} Station`, stationIds, applyStationNodeIds }
}

// The use case is exercised against the real crossover injector and the real store
// handle: what it writes into the game (setTracks) is the point, and a plan is a
// pure value object, so the real one stands in for the planner's output.
function createFixture() {
  const setTracks = vi.fn((arg: SetTracksArg): void => {
    state.tracks = arg.newTracks
  })
  const state: GameState = {
    money: 0,
    ownedTrainCount: 0,
    routes: [{ id: ROUTE_ID, stNodes: [] }],
    setTracks,
    tracks: [],
  }
  const store = new GameStore({ getState: () => state })
  const guard = new RouteEditGuard()
  const previewEditor = new RoutePreviewEditor(store, guard, new RouteMaintenance(store))
  const applyAdditions = vi.spyOn(previewEditor, 'applyAdditions').mockResolvedValue({ committed: true })
  const provisionService = new ProvisionServiceUseCase(store, new FleetProvisioner(store, new TrainTypeCatalog({})))
  const provision = vi.spyOn(provisionService, 'execute').mockImplementation(() => {})
  const createCrossover = vi.spyOn(TerminusCrossoverFactory, 'create').mockReturnValue(crossover('crossover-1'))
  const index = StationIndex.build(state)
  return {
    applyAdditions,
    createCrossover,
    index,
    provision,
    setTracks,
    state,
    plan: (endpoints: Endpoint[]) => new ExpansionPlan(index, new Set(), new Set(), endpoints),
    useCase: new ExtendLineUseCase(store, new CrossoverInjector(store), previewEditor, provisionService),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ExtendLineUseCase', () => {
  describe('when the plan has nothing to add', () => {
    // A fork the user has not resolved yet is the everyday case: the panel offers
    // the choice, and until one is made the line has nowhere to grow.
    it('reports that there were no additions', async () => {
      const { plan, useCase } = createFixture()
      const unresolved = endpoint({ fork: { atName: 'A Station', options: [forkTo(['B'], ['B-node'])] } })
      expect(await useCase.execute(ROUTE_ID, plan([unresolved]), {})).toEqual({
        committed: false,
        hadAdditions: false,
      })
    })

    it('leaves the game untouched — no crossover, no preview, no service', async () => {
      const { applyAdditions, plan, provision, setTracks, useCase } = createFixture()
      await useCase.execute(ROUTE_ID, plan([endpoint()]), {})
      expect(setTracks).not.toHaveBeenCalled()
      expect(applyAdditions).not.toHaveBeenCalled()
      expect(provision).not.toHaveBeenCalled()
    })
  })

  describe('additions', () => {
    it('applies every station node the plan resolves for the given choices', async () => {
      const { applyAdditions, plan, useCase } = createFixture()
      const choice = forkTo(['C', 'D'], ['C-node', 'D-node'])
      const growable = endpoint({
        autoStationIds: ['B'],
        autoStationNodeIds: ['B-node'],
        fork: { atName: 'B Station', options: [choice] },
      })
      await useCase.execute(ROUTE_ID, plan([growable]), { A: choice })
      expect(applyAdditions).toHaveBeenCalledWith(ROUTE_ID, ['B-node', 'C-node', 'D-node'])
    })

    it('reports the commit the preview flow made', async () => {
      const { plan, useCase } = createFixture()
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      expect(await useCase.execute(ROUTE_ID, plan([growable]), {})).toEqual({
        committed: true,
        hadAdditions: true,
      })
    })

    it('reports the additions even when the preview flow refused to commit them', async () => {
      const { applyAdditions, plan, useCase } = createFixture()
      applyAdditions.mockResolvedValue({ committed: false })
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      expect(await useCase.execute(ROUTE_ID, plan([growable]), {})).toEqual({
        committed: false,
        hadAdditions: true,
      })
    })
  })

  describe('service', () => {
    it('provisions demand-based service on the line it grew', async () => {
      const { plan, provision, useCase } = createFixture()
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(provision).toHaveBeenCalledWith(ROUTE_ID)
    })

    it('provisions no service when the line did not actually grow', async () => {
      const { applyAdditions, plan, provision, useCase } = createFixture()
      applyAdditions.mockResolvedValue({ committed: false })
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(provision).not.toHaveBeenCalled()
    })
  })

  describe('turnaround crossovers', () => {
    it('builds one at the far end of the auto chain, facing the station before it', async () => {
      const { createCrossover, index, plan, state, useCase } = createFixture()
      const growable = endpoint({ autoStationIds: ['B', 'C'], autoStationNodeIds: ['B-node', 'C-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(createCrossover).toHaveBeenCalledTimes(1)
      expect(createCrossover).toHaveBeenCalledWith(state, index, 'C', 'B')
    })

    // A one-station extension has no station before the new terminus inside the
    // chain, so the endpoint the line already reaches is the neighbor.
    it('faces the crossover back at the old endpoint when the chain is a single station', async () => {
      const { createCrossover, index, plan, state, useCase } = createFixture()
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(createCrossover).toHaveBeenCalledWith(state, index, 'B', 'A')
    })

    it('follows the chosen fork out to its terminus', async () => {
      const { createCrossover, index, plan, state, useCase } = createFixture()
      const choice = forkTo(['C', 'D'], ['C-node', 'D-node'])
      const growable = endpoint({
        autoStationIds: ['B'],
        autoStationNodeIds: ['B-node'],
        fork: { atName: 'B Station', options: [choice] },
      })
      await useCase.execute(ROUTE_ID, plan([growable]), { A: choice })
      expect(createCrossover).toHaveBeenCalledWith(state, index, 'D', 'C')
    })

    it('stops at the auto chain when the user picked no fork', async () => {
      const { createCrossover, index, plan, state, useCase } = createFixture()
      const growable = endpoint({
        autoStationIds: ['B'],
        autoStationNodeIds: ['B-node'],
        fork: { atName: 'B Station', options: [forkTo(['C'], ['C-node'])] },
      })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(createCrossover).toHaveBeenCalledWith(state, index, 'B', 'A')
    })

    it('starts the chain at the chosen fork when the endpoint has no auto chain', async () => {
      const { createCrossover, index, plan, state, useCase } = createFixture()
      const choice = forkTo(['C', 'D'], ['C-node', 'D-node'])
      const growable = endpoint({
        fork: { atName: 'A Station', options: [choice] },
      })
      await useCase.execute(ROUTE_ID, plan([growable]), { A: choice })
      expect(createCrossover).toHaveBeenCalledWith(state, index, 'D', 'C')
    })

    it('builds one per growable endpoint and skips the endpoints that stay put', async () => {
      const { createCrossover, plan, useCase } = createFixture()
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      const stuck = endpoint({ stationId: 'Z', name: 'Z Station' })
      await useCase.execute(ROUTE_ID, plan([growable, stuck]), {})
      expect(createCrossover).toHaveBeenCalledTimes(1)
    })

    it('writes the fabricated crossovers into the game alongside the existing tracks', async () => {
      const { plan, setTracks, state, useCase } = createFixture()
      state.tracks = [crossover('existing')]
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(setTracks).toHaveBeenCalledWith({
        newTracks: [crossover('existing'), crossover('crossover-1')],
        regenStations: false,
        regenRoutesWithTrackIDs: [],
      })
    })

    it('writes nothing when every terminus is already turnaround-linked', async () => {
      const { createCrossover, plan, setTracks, useCase } = createFixture()
      createCrossover.mockReturnValue(null)
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(setTracks).not.toHaveBeenCalled()
    })

    // setTracks rebuilds the whole trackGraph, so the crossover has to be in place
    // before the route's turnaround path is resolved — otherwise the preview flow
    // fails with "No valid path found between station tracks".
    it('injects the crossovers before the additions are applied', async () => {
      const { applyAdditions, plan, setTracks, useCase } = createFixture()
      const growable = endpoint({ autoStationIds: ['B'], autoStationNodeIds: ['B-node'] })
      await useCase.execute(ROUTE_ID, plan([growable]), {})
      expect(setTracks.mock.invocationCallOrder[0])
        .toBeLessThan(applyAdditions.mock.invocationCallOrder[0])
    })
  })
})
