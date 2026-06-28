import type { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import type { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import type { GameStore } from '@/infrastructure/store/GameStore'

// Discards an uncommitted new-line preview: clears the preview, releases the
// route-edit guard, deletes the temp route, and sweeps orphans. Called on tab
// switch, new selection, or panel close (unmount).
export class DiscardNewLinePreviewUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly guard: RouteEditGuard,
    private readonly maintenance: RouteMaintenance,
  ) {}

  execute(tempRouteId: null | string): void {
    try {
      this.store.state().setPreviewRoute?.(null)
    } catch {
      /* ignore */
    }
    this.guard.end() // release the guard taken in PreviewNewLineUseCase
    try {
      if (tempRouteId) {
        this.store.state().deleteRoute?.(tempRouteId)
      }
    } catch {
      /* ignore */
    }
    this.maintenance.stripTempRoutes()
  }
}
