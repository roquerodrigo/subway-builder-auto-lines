import type { Route } from '@/shared/game/Route'

// The busiest demand period across a set of lines: per period, sum
// trainSchedule[period] × weightFor(route), then take the largest period. Both
// fleet budgets are shaped this way — the weight is what differs (one per train
// for the cap, cars per train for the inventory).
export class PeakDemand {
  static across(routes: Route[], weightFor: (route: Route) => number): number {
    let high = 0
    let mid = 0
    let low = 0
    let veryLow = 0
    for (const route of routes) {
      const schedule = route.trainSchedule
      if (!schedule) {
        continue
      }
      const weight = weightFor(route)
      high += (schedule.highDemand || 0) * weight
      mid += (schedule.mediumDemand || 0) * weight
      low += (schedule.lowDemand || 0) * weight
      veryLow += ((schedule.veryLowDemand ?? schedule.lowDemand) || 0) * weight
    }

    return Math.max(high, mid, low, veryLow)
  }
}
