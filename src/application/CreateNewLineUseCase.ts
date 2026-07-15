import type { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import type { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'
import type { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import type { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import type { RoutePreviewEditor } from '@/infrastructure/routing/RoutePreviewEditor'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { TerminusCrossoverFactory } from '@/domain/crossover/TerminusCrossoverFactory'
import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { BulletSequence } from '@/domain/newline/BulletSequence'
import { NewLinePlanner } from '@/domain/newline/NewLinePlanner'
import { findRoute } from '@/shared/game/Route'
import { RouteShape } from '@/shared/game/RouteShape'

// Builds the largest valid single line from an orphan group and commits it. This
// is the only place a route/preview is created — browsing the group dropdown does
// not (see PreviewNewLineUseCase), so no ghost line appears until the user commits.
// Fabricates the turnaround crossovers, adds nodes ONE AT A TIME (findRoutePathOrder
// rejects an all-at-once dump; an empty route only bootstraps incrementally),
// confirms, and provisions demand-based service. Fully unwinds on failure.
export class CreateNewLineUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly guard: RouteEditGuard,
    private readonly maintenance: RouteMaintenance,
    private readonly crossovers: CrossoverInjector,
    private readonly previewEditor: RoutePreviewEditor,
    private readonly provisionService: ProvisionServiceUseCase,
  ) {}

  async execute(path: string[], color?: string): Promise<boolean> {
    if (path.length < 2) {
      return false
    }
    const initialState = this.store.state()
    const index = StationIndex.build(initialState)
    const network = new TrackNetwork(initialState, index)
    const addStationNodeIds = NewLinePlanner.addStationNodeIds(network, index, path)

    // Turnaround crossovers at both corridor ends BEFORE building, so the route's
    // reversal path resolves (setTracks rebuilds the trackGraph). A build that later
    // fails leaves them behind on purpose: injecting one is a no-op when it already
    // exists, so they cost nothing and the next attempt reuses them.
    this.crossovers.inject([
      TerminusCrossoverFactory.create(initialState, index, path[0], path[1]),
      TerminusCrossoverFactory.create(initialState, index, path[path.length - 1], path[path.length - 2]),
    ])

    const generated = this.store.state().generateRoute?.({})
    if (!generated) {
      throw new Error('generateRoute is unavailable')
    }
    const routeId = generated.id

    // generateRoute ignores customBullet (auto-assigns a letter) and picks a random
    // color; set our own sequential numeric bullet, a square bullet icon, and the
    // preview color on the route in state so they stick on commit — and so the
    // committed line matches the color shown in the preview.
    try {
      const bullet = BulletSequence.next(this.store.state().routes ?? [])
      const state = this.store.state()
      const overrides = color ? { bullet, color, shape: RouteShape.Square } : { bullet, shape: RouteShape.Square }
      state.setRoutes?.(
        (state.routes ?? []).map((route) =>
          route.id === routeId ? Object.assign({}, route, overrides) : route,
        ),
        false,
      )
    } catch {
      /* keep default bullet */
    }

    try {
      const routeClone = findRoute(this.store.state().routes, routeId)
      if (!routeClone) {
        this.discard(routeId)

        return false
      }

      const built = await this.previewEditor.growPreview(routeClone, addStationNodeIds)
      const coveredStations = new Set(
        (built?.stNodes ?? [])
          .map((stationNode) => index.stationOfNode.get(stationNode.id))
          .filter((sid): sid is string => !!sid),
      )
      if (coveredStations.size < 2) {
        this.discard(routeId)

        return false
      }

      this.store.state().confirmRouteChange?.()
      this.guard.end() // preview committed → release the guard

      // confirmRouteChange sits behind a licence gate that silently no-ops
      // (game-internals §5), so whether it took has to be read back rather than
      // assumed. Reporting success blind tells the player the line exists, gives it
      // trains, and leaves the preview open — the state that pops the game's
      // "Unsaved Route Changes" modal.
      const committed = findRoute(this.store.state().routes, routeId)
      if (new Set((committed?.stNodes ?? []).map((stationNode) => stationNode.id)).size < 2) {
        this.discard(routeId)

        return false
      }

      this.maintenance.stripTempRoutes()
      this.provisionService.execute(routeId) // trains + 5/10/15/30-min schedule

      return true
    } catch (error) {
      this.discard(routeId)
      throw error
    }
  }

  private discard(routeId: string): void {
    try {
      this.store.state().setPreviewRoute?.(null)
      this.guard.end()
      this.store.state().deleteRoute?.(routeId)
      this.maintenance.stripTempRoutes()
    } catch {
      /* best-effort cleanup */
    }
  }
}
