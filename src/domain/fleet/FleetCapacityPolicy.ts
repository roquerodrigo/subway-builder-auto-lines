import type { Route } from '@/shared/game/Route'

import { PeakDemand } from '@/domain/fleet/PeakDemand'

// The game also caps how many trains can exist at all (ownedTrainCount) — one
// number across every line, whatever their type. Spawning stops dead at it, so a
// cap left behind by an older save silently starves the schedules of the lines
// the mod builds. This is how high it has to be for every line to run its busiest
// period, with room for the trains already out there.
export class FleetCapacityPolicy {
  static requiredTrains(routes: Route[], runningTrains: number): number {
    return Math.max(runningTrains, Math.ceil(PeakDemand.across(routes, () => 1)))
  }
}
