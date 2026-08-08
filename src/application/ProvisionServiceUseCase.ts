import type { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import type { GameStore } from '@/infrastructure/store/GameStore'
import type { Route } from '@/shared/game/Route'

import { ServiceSchedule } from '@/domain/fleet/ServiceSchedule'
import { findRoute } from '@/shared/game/Route'
import { logger } from '@/shared/Logger'

// Gives a route demand-based service: full-length trains, a 5/15/30/60-min schedule
// from its round-trip cycle, enough car inventory to run and lengthen it, and the
// current period's trains spawned now.
export class ProvisionServiceUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly fleet: FleetProvisioner,
  ) {}

  execute(routeId: string): void {
    try {
      const route = findRoute(this.store.state().routes, routeId)
      if (!route || cycleSecondsOf(route) <= 0) {
        return
      }

      this.fleet.setTrainLength(routeId)

      // Read the cycle back after the trains were lengthened, not before: the game
      // has just recomputed the round trip the schedule is derived from.
      const lengthened = findRoute(this.store.state().routes, routeId)
      const cycleSeconds = (lengthened && cycleSecondsOf(lengthened)) || cycleSecondsOf(route)

      const schedule = ServiceSchedule.forCycleSeconds(cycleSeconds)
      this.store.state().updateRouteProperty?.(routeId, 'trainSchedule', schedule)
      this.fleet.ensureCarInventory(routeId)
      this.fleet.spawnForSchedule(routeId, schedule)
    } catch (error) {
      logger.warn('provisionService', error)
    }
  }
}

// The last stop's departure time is the full round trip; a line the game has not
// timed yet has none.
function cycleSecondsOf(route: Route): number {
  const timings = route.stComboTimings

  return timings && timings.length ? timings[timings.length - 1].departureTime : 0
}
