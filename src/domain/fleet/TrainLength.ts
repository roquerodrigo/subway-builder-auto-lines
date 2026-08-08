// How long a train the mod puts on a line it builds. A line is built for capacity,
// and a full train carries twice what a half one does at the same operating cost per
// car — so the default is the full 10, or as many cars as the train type takes when
// it takes fewer. The player can always shorten a train afterwards.
export const DEFAULT_CARS_PER_TRAIN = 10

export class TrainLength {
  static forMaxCars(maxCars: number): number {
    return maxCars > 0 ? Math.min(DEFAULT_CARS_PER_TRAIN, maxCars) : DEFAULT_CARS_PER_TRAIN
  }
}
