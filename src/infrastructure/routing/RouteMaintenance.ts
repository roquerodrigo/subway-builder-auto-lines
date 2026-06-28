import type { GameStore } from '@/infrastructure/store/GameStore'

// Keeps routes and trains consistent after mutations.
export class RouteMaintenance {
  constructor(private readonly store: GameStore) {}

  // Drop trains whose route no longer exists. An orphaned train makes the game
  // loop throw "Route not found for train …" every tick (and corrupts the
  // autosave). Routes vanish under us — stripTempRoutes, the game's own
  // route-edit/merge when the player removes a station, confirmRouteChange
  // consolidation — so sweep after every route mutation. Always safe.
  purgeOrphanTrains(): void {
    const state = this.store.state()
    if (typeof state.setTrains !== 'function') {
      return
    }
    const routeIds = new Set((state.routes ?? []).map((route) => route.id))
    const trains = state.trains ?? []
    const keep = trains.filter((train) => routeIds.has(train.routeId))
    if (keep.length !== trains.length) {
      state.setTrains(keep)
    }
  }

  // Drop preview/temp routes (tempParentId set) and any leaked empty routes (0
  // stations) — an uncommitted new-line preview the game autosaved would
  // otherwise persist as junk. A route mid-build already has stations, so it's
  // safe. Always purges orphan trains afterwards.
  stripTempRoutes(): void {
    const state = this.store.state()
    const routes = state.routes ?? []
    const clean = routes.filter(
      (route) => route.tempParentId == null && route.stNodes && route.stNodes.length > 0,
    )
    if (clean.length !== routes.length) {
      state.setRoutes?.(clean, true)
    }
    this.purgeOrphanTrains()
  }
}
