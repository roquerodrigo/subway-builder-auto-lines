import { describe, expect, it, vi } from 'vitest'

import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'
import type { TrainTypeStats } from '@/shared/game/TrainType'

import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { FALLBACK_TRAIN_TYPE_STATS } from '@/shared/game/constants'

const LIGHT_RAIL_STATS: TrainTypeStats = { carCost: 900_000, carsPerCarSet: 2, maxCars: 6 }

function makeCatalog(api: SubwayBuilderApi): TrainTypeCatalog {
  return new TrainTypeCatalog(api)
}

describe('TrainTypeCatalog', () => {
  it('reads the stats the game publishes for the type', () => {
    const getTrainType = vi.fn(() => ({ stats: LIGHT_RAIL_STATS }))

    const stats = makeCatalog({ trains: { getTrainType } }).stats('light-rail')

    expect(stats).toBe(LIGHT_RAIL_STATS)
    expect(getTrainType).toHaveBeenCalledWith('light-rail')
  })

  it('falls back to the heavy-metro defaults for a type the game does not know', () => {
    const catalog = makeCatalog({ trains: { getTrainType: () => undefined } })

    expect(catalog.stats('made-up')).toBe(FALLBACK_TRAIN_TYPE_STATS)
  })

  it('falls back when the game answers with a type that carries no stats', () => {
    const catalog = makeCatalog({ trains: { getTrainType: () => ({} as { stats: TrainTypeStats }) } })

    expect(catalog.stats('heavy-metro')).toBe(FALLBACK_TRAIN_TYPE_STATS)
  })

  it('falls back when the lookup throws', () => {
    const catalog = makeCatalog({
      trains: {
        getTrainType: (): never => {
          throw new Error('catalog is not loaded')
        },
      },
    })

    expect(catalog.stats('heavy-metro')).toBe(FALLBACK_TRAIN_TYPE_STATS)
  })

  it('falls back when the game version has no train lookup', () => {
    expect(makeCatalog({ trains: {} }).stats('heavy-metro')).toBe(FALLBACK_TRAIN_TYPE_STATS)
  })

  it('falls back when the api has no trains namespace at all', () => {
    expect(makeCatalog({}).stats('heavy-metro')).toBe(FALLBACK_TRAIN_TYPE_STATS)
  })
})
