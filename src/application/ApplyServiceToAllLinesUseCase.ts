import type { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import type { SortLinesUseCase } from '@/application/SortLinesUseCase'
import type { GameStore } from '@/infrastructure/store/GameStore'

// Brings every line in the city onto the current settings — the same service a
// line gets when the mod builds it, for the ones built before the player settled
// on their numbers. Lines with headways of their own keep them.
export class ApplyServiceToAllLinesUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly provisionService: ProvisionServiceUseCase,
    private readonly sortLines: SortLinesUseCase,
  ) {}

  execute(): number {
    const routes = (this.store.state().routes ?? []).filter((route) => route.tempParentId == null)
    for (const route of routes) {
      this.provisionService.execute(route.id)
    }
    this.sortLines.execute()

    return routes.length
  }
}
