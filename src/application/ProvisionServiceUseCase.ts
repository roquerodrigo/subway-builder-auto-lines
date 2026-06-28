import type { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { ServiceSchedule } from '@/domain/fleet/ServiceSchedule'
import { findRoute } from '@/shared/game/Route'
import { logger } from '@/shared/Logger'

// Gives a route demand-based service: a 5/10/15-min schedule from its round-trip
// cycle, enough car inventory to run and lengthen it, and the current period's
// trains spawned now.
export class ProvisionServiceUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly fleet: FleetProvisioner,
  ) {}

  execute(routeId: string): void {
    try {
      const route = findRoute(this.store.state().routes, routeId)
      if (!route) {
        return
      }
      const timings = route.stComboTimings
      const cycleSeconds = timings && timings.length ? timings[timings.length - 1].departureTime : 0
      if (!cycleSeconds || cycleSeconds <= 0) {
        return
      }

      const schedule = ServiceSchedule.forCycleSeconds(cycleSeconds)
      this.store.state().updateRouteProperty?.(routeId, 'trainSchedule', schedule)
      this.fleet.ensureCarInventory(routeId)
      this.fleet.spawnForSchedule(routeId, schedule)
    } catch (error) {
      logger.warn('provisionService', error)
    }
  }
}
