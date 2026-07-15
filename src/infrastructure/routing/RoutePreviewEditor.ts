import type { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import type { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { PreviewRouteAction } from '@/shared/game/PreviewRouteAction'
import { findRoute, type Route } from '@/shared/game/Route'

interface ApplyResult {
  committed: boolean
}

// Drives the game's preview flow to add stNodes to a route. Both building the
// preview (growPreview) and committing an existing route's additions
// (applyAdditions) go through here.
export class RoutePreviewEditor {
  constructor(
    private readonly store: GameStore,
    private readonly guard: RouteEditGuard,
    private readonly maintenance: RouteMaintenance,
  ) {}

  async applyAdditions(routeId: string, addStationNodeIds: string[]): Promise<ApplyResult> {
    const route = findRoute(this.store.state().routes, routeId)
    if (!route) {
      throw new Error('line not found')
    }

    try {
      const grown = await this.growPreview(route, addStationNodeIds)
      if (!grown) {
        this.abandonPreview()

        return { committed: false }
      }

      const before = new Set(route.stNodes.map((n) => n.id)).size
      this.store.state().confirmRouteChange?.()
      this.guard.end() // preview committed → release the guard
      const after = findRoute(this.store.state().routes, routeId)
      const grew = !!after && new Set(after.stNodes.map((n) => n.id)).size > before
      this.maintenance.stripTempRoutes()

      return { committed: grew }
    } catch (error) {
      // This method opens the preview and takes the guard, so it owns unwinding
      // them: a throw that left both held is what pops the game's "Unsaved Route
      // Changes" modal, and the caller has no handle on the preview to undo it.
      this.abandonPreview()
      throw error
    }
  }

  // Opens a preview off `route` and adds each node ONE AT A TIME, keeping only the
  // additions that grow the line: findRoutePathOrder rejects an all-at-once dump,
  // and an empty route only bootstraps incrementally. Do not "optimise" this into
  // a batch — it is load-bearing. Leaves the built preview active with the guard
  // held; the caller commits (confirmRouteChange) or discards. Returns the grown
  // preview, or null when nothing could be added.
  async growPreview(route: Route, addStationNodeIds: string[]): Promise<null | Route> {
    this.guard.begin() // satisfy the 1.4.10 route-edit guard (no "Unsaved changes" modal)
    this.store.state().setPreviewRoute?.(Object.assign({}, route))
    const ordering = this.store.state()
    if (typeof ordering.setManualRouteOrdering === 'function') {
      ordering.setManualRouteOrdering(false)
    }

    let good: null | Route = this.store.state().previewRoute ?? null
    let added = 0
    for (const id of addStationNodeIds) {
      const state = this.store.state()
      if (typeof state.clearPendingStNodeChanges === 'function') {
        state.clearPendingStNodeChanges()
      }
      state.changePreviewRoute?.({ action: PreviewRouteAction.Add, stNodeId: id })
      try {
        await this.store.state().batchPreviewRouteUpdates?.()
        const preview = this.store.state().previewRoute
        if (preview && good && preview.stNodes.length > good.stNodes.length) {
          good = preview
          added++
        } else {
          this.store.state().setPreviewRoute?.(good)
        }
      } catch {
        this.store.state().setPreviewRoute?.(good)
      }
    }

    return added > 0 ? good : null
  }

  // Close the preview, release the guard, and clear what the abandoned attempt left
  // behind — the game autosaves, so a half-built state outlives the failure.
  // Best-effort on purpose: this runs on the failure path, where the store is
  // already unhappy and throwing here would bury the error that actually matters.
  private abandonPreview(): void {
    try {
      this.store.state().setPreviewRoute?.(null)
      this.maintenance.stripTempRoutes()
    } catch {
      /* the preview is the game's to lose at this point */
    }
    this.guard.end()
  }
}
