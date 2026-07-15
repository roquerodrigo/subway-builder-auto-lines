import type { Route } from '@/shared/game/Route'

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
    let high = 0
    let mid = 0
    let low = 0
    let veryLow = 0
    for (const route of routes) {
      if ((route.trainType ?? defaultType) !== trainType) {
        continue
      }
      const schedule = route.trainSchedule
      if (!schedule) {
        continue
      }
      const cars = carsFor(route)
      high += (schedule.highDemand || 0) * cars
      mid += (schedule.mediumDemand || 0) * cars
      low += (schedule.lowDemand || 0) * cars
      veryLow += ((schedule.veryLowDemand ?? schedule.lowDemand) || 0) * cars
    }

    return Math.max(high, mid, low, veryLow)
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
