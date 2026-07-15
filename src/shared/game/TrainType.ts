export interface TrainType {
  stats: TrainTypeStats
}

// A train type and the subset of its stats the mod reads. `carsPerCarSet` is the
// purchase/lengthen increment; `maxCars` the per-train ceiling; `carCost` the
// price used to compute (and refund) the temporary money bump when buying cars.
export interface TrainTypeStats {
  carCost: number
  carsPerCarSet: number
  maxCars: number
}
