import type { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import type { LineService } from '@/domain/settings/ServiceSettings'
import type { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { ServiceSettingsPolicy } from '@/domain/settings/ServiceSettings'
import { cycleSecondsOf, findRoute } from '@/shared/game/Route'
import { logger } from '@/shared/Logger'

// Serves one line on numbers of its own: remembers them, so extending the line
// later keeps them rather than falling back to the city-wide settings, and puts
// them on the line right away.
export class ApplyLineServiceUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly settings: ServiceSettingsStore,
    private readonly provisionService: ProvisionServiceUseCase,
  ) {}

  execute(routeId: string, service: LineService): boolean {
    try {
      const routes = this.store.state().routes ?? []
      const route = findRoute(routes, routeId)
      if (!route) {
        return false
      }

      const withService = ServiceSettingsPolicy.withRouteService(this.settings.current(), routeId, service)
      this.settings.save(ServiceSettingsPolicy.keepingRoutes(withService, routes.map((line) => line.id)))

      if (cycleSecondsOf(route) <= 0) {
        return false // the game has not timed this line yet — nothing to divide
      }
      this.provisionService.execute(routeId)

      return true
    } catch (error) {
      logger.warn('applyLineService', error)

      return false
    }
  }
}
