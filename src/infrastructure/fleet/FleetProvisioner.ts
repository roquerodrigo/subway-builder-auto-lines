import type { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import type { GameStore } from '@/infrastructure/store/GameStore'
import type { TrainSchedule } from '@/shared/game/TrainSchedule'

import { CarInventoryPolicy } from '@/domain/fleet/CarInventoryPolicy'
import { DemandPeriod } from '@/domain/fleet/DemandPeriod'
import { DEFAULT_CAR_COST, DEFAULT_CARS_PER_CAR_SET, DEFAULT_TRAIN_TYPE } from '@/shared/game/constants'
import { findRoute } from '@/shared/game/Route'
import { logger } from '@/shared/Logger'

// Applies fleet side effects for a route: car inventory and train spawning. The
// mod raises the train cap and spawns trains for free, but the inventory the game
// actually charges for is CARS (ownedCarsByType). Grant enough via the game's own
// buyTrains (which raises ownedCarsByType AND ownedTrainCount together) with the
// money refunded, so it stays free while keeping the game's count/cars invariant.
export class FleetProvisioner {
  constructor(
    private readonly store: GameStore,
    private readonly catalog: TrainTypeCatalog,
  ) {}

  ensureCarInventory(routeId: string): void {
    try {
      const state = this.store.state()
      const route = findRoute(state.routes, routeId)
      if (!route) {
        return
      }

      const trainType = route.trainType ?? DEFAULT_TRAIN_TYPE
      const stats = this.catalog.stats(trainType)
      const carSet = stats.carsPerCarSet || DEFAULT_CARS_PER_CAR_SET
      const target = CarInventoryPolicy.requiredCars(
        state.routes ?? [],
        routeId,
        trainType,
        DEFAULT_TRAIN_TYPE,
        carSet,
        stats.maxCars,
      )
      const have = (state.ownedCarsByType && state.ownedCarsByType[trainType]) || 0
      const delta = target - have
      if (delta <= 0) {
        return
      }

      if (typeof state.buyTrains === 'function') {
        const money = state.money
        state.setMoney?.(money + delta * (stats.carCost || DEFAULT_CAR_COST) + 1) // ensure affordable
        try {
          state.buyTrains(delta, trainType)
        } finally {
          // The bump only exists to clear the game's affordability check, so it has
          // to come back even when the purchase throws — otherwise the player keeps
          // it (a stock top-up is tens of millions) and the game autosaves that.
          state.setMoney?.(money)
        }
      } else if (typeof state.setOwnedTrainCount === 'function' && state.ownedTrainCount < have + delta) {
        state.setOwnedTrainCount(have + delta) // fleet cap only — better than nothing
      }
    } catch (error) {
      logger.warn('ensureCarInventory', error)
    }
  }

  // Spawn the current demand period's trains now, spaced across stations. The
  // game also auto-spawns to match the schedule while the sim runs.
  spawnForSchedule(routeId: string, schedule: TrainSchedule): void {
    const state = this.store.state()
    const route = findRoute(state.routes, routeId)
    if (!route) {
      return
    }

    const elapsed = state.timeConfig?.elapsedSeconds ?? 0
    const want = schedule[DemandPeriod.tierForElapsedSeconds(elapsed)] || schedule.lowDemand
    const stationCount = Math.max(1, route.stNodes.length)

    for (let i = 0; i < want; i++) {
      const current = this.store.state()
      if ((current.trains ? current.trains.length : 0) >= current.ownedTrainCount) {
        break
      }
      const index = Math.floor((i * stationCount) / want) % stationCount
      try {
        if (typeof current.spawnTrainAtStation === 'function') {
          current.spawnTrainAtStation(routeId, index)
        } else if (typeof current.generateTrain === 'function') {
          current.generateTrain(routeId)
        }
      } catch {
        /* platform conflict at that index — skip */
      }
    }
  }
}
