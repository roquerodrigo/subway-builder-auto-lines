import type { TrainTypeStats } from '@/shared/game/TrainType'

// How long a train the mod puts on a line it builds: the player's cars-per-train
// setting, held to what the train type actually takes. A line is built for
// capacity, and a full train carries twice what a half one does at the same
// operating cost per car — so the setting defaults to the full 10 (see
// DEFAULT_SERVICE_SETTINGS).
export class TrainLength {
  static carsFor(desiredCars: number, stats: TrainTypeStats): number {
    const capped = stats.maxCars > 0 ? Math.min(desiredCars, stats.maxCars) : desiredCars

    return stats.minCars > 0 ? Math.max(capped, stats.minCars) : capped
  }
}
