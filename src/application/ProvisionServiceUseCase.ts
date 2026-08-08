import type { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import type { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { ServiceSchedule } from '@/domain/fleet/ServiceSchedule'
import { ServiceSettingsPolicy } from '@/domain/settings/ServiceSettings'
import { cycleSecondsOf, findRoute } from '@/shared/game/Route'
import { logger } from '@/shared/Logger'

// Gives a route demand-based service: trains as long as the player asked for, a
// schedule built from its round-trip cycle and the service that line is on (its
// own when it has been given one), enough car inventory and fleet cap to run
// and lengthen it (granted for free where the game falls short), and the current
// period's trains spawned now. The player can switch the whole thing off, in which
// case a line the mod builds is left without trains for them to service by hand.
export class ProvisionServiceUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly fleet: FleetProvisioner,
    private readonly settings: ServiceSettingsStore,
  ) {}

  execute(routeId: string): void {
    try {
      const settings = this.settings.current()
      if (!settings.autoTrains) {
        return
      }

      const route = findRoute(this.store.state().routes, routeId)
      if (!route || cycleSecondsOf(route) <= 0) {
        return
      }

      const service = ServiceSettingsPolicy.serviceFor(settings, routeId)
      this.fleet.setTrainLength(routeId, service.carsPerTrain)

      // Read the cycle back after the trains were lengthened, not before: the game
      // has just recomputed the round trip the schedule is derived from.
      const lengthened = findRoute(this.store.state().routes, routeId)
      const cycleSeconds = (lengthened && cycleSecondsOf(lengthened)) || cycleSecondsOf(route)

      this.fleet.applySchedule(
        routeId,
        ServiceSchedule.forCycleSeconds(cycleSeconds, service.headwayMinutes),
      )
    } catch (error) {
      logger.warn('provisionService', error)
    }
  }
}
