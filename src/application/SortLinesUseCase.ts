import type { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { LineOrder } from '@/domain/line/LineOrder'

// Puts the game's line list back in name order after the mod has changed the
// network. The panel's own list follows the same routes array, so both end up
// sorted. Off unless the player asked for it in Settings, and a no-op when the
// lines are already in order — reordering writes the whole array back.
export class SortLinesUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly settings: ServiceSettingsStore,
  ) {}

  execute(): boolean {
    if (!this.settings.current().sortLinesByName) {
      return false
    }
    const state = this.store.state()
    const routes = state.routes ?? []
    const sorted = LineOrder.byName(routes)
    if (LineOrder.sameOrder(routes, sorted)) {
      return false
    }
    // regen:false — the lines themselves are untouched, only their order is.
    state.setRoutes?.(sorted, false)

    return true
  }
}
