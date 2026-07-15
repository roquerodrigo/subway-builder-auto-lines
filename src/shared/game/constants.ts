import type { TrainTypeStats } from '@/shared/game/TrainType'

// The game's default train type — the one a generated route uses and whose car
// inventory (ownedCarsByType["heavy-metro"]) starts non-zero.
export const DEFAULT_TRAIN_TYPE = 'heavy-metro'

// heavy-metro defaults, used when the public API can't resolve a train type.
export const DEFAULT_CARS_PER_CAR_SET = 5
export const DEFAULT_CAR_COST = 2_700_000
const DEFAULT_MAX_CARS = 15

export const FALLBACK_TRAIN_TYPE_STATS: TrainTypeStats = {
  carCost: DEFAULT_CAR_COST,
  carsPerCarSet: DEFAULT_CARS_PER_CAR_SET,
  maxCars: DEFAULT_MAX_CARS,
}
