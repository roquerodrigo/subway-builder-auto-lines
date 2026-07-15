import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'
import type { TrainTypeStats } from '@/shared/game/TrainType'

import { FALLBACK_TRAIN_TYPE_STATS } from '@/shared/game/constants'

// Resolves a train type's stats via the public API, with a safe fallback.
export class TrainTypeCatalog {
  constructor(private readonly api: SubwayBuilderApi) {}

  stats(trainType: string): TrainTypeStats {
    try {
      const type = this.api.trains?.getTrainType?.(trainType)
      if (type && type.stats) {
        return type.stats
      }
    } catch {
      /* fall through to defaults */
    }

    return FALLBACK_TRAIN_TYPE_STATS
  }
}
