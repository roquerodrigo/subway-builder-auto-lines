import type { Route } from '@/shared/game/Route'

import { PeakDemand } from '@/domain/fleet/PeakDemand'

// The game gates every "add a train" and "increase cars per train" on the car
// inventory (ownedCarsByType[type]) — not on the train cap. This computes what
// that inventory must be so a mod-built line runs, and can be lengthened, without
// hitting the native "Not enough train cars to increase cars per train" wall.
export class CarInventoryPolicy {
  // Peak cars a train type needs: per demand period, sum trainSchedule[period] ×
  // carsPerTrain across all routes of the type, then the max period. `carsFor`
  // supplies the cars-per-train to assume for each route.
  static peakCars(
    routes: Route[],
    trainType: string,
    defaultType: string,
    carsFor: (route: Route) => number,
  ): number {
    const ofType = routes.filter((route) => (route.trainType ?? defaultType) === trainType)

    return PeakDemand.across(ofType, carsFor)
  }

  // Target inventory so `routeId` can run and lengthen up to maxCars: the peak
  // cars needed with this route at maxCars and every other route at its current
  // cars/train.
  static requiredCars(
    routes: Route[],
    routeId: string,
    trainType: string,
    defaultType: string,
    carSet: number,
    maxCars: number,
  ): number {
    return Math.ceil(
      this.peakCars(routes, trainType, defaultType, (route) =>
        (route.id === routeId ? maxCars || (route.carsPerTrain ?? carSet) : route.carsPerTrain ?? carSet),
      ),
    )
  }
}
