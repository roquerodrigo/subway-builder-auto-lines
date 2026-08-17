import { describe, expect, it, vi } from 'vitest'

import type { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import type { SortLinesUseCase } from '@/application/SortLinesUseCase'
import type { GameState } from '@/shared/game/GameState'

import { ApplyServiceToAllLinesUseCase } from '@/application/ApplyServiceToAllLinesUseCase'
import { GameStore } from '@/infrastructure/store/GameStore'

function createFixture(routes: GameState['routes']) {
  const state: GameState = { money: 0, ownedTrainCount: 0, routes, tracks: [] }
  const provision = { execute: vi.fn() }
  const sortLines = { execute: vi.fn() }

  return {
    provision,
    sortLines,
    useCase: new ApplyServiceToAllLinesUseCase(
      new GameStore({ getState: () => state }),
      provision as unknown as ProvisionServiceUseCase,
      sortLines as unknown as SortLinesUseCase,
    ),
  }
}

describe('ApplyServiceToAllLinesUseCase', () => {
  it('provisions every line in the city', () => {
    const { provision, useCase } = createFixture([
      { id: 'r1', stNodes: [] },
      { id: 'r2', stNodes: [] },
    ])

    expect(useCase.execute()).toBe(2)
    expect(provision.execute).toHaveBeenCalledWith('r1')
    expect(provision.execute).toHaveBeenCalledWith('r2')
  })

  // A preview route is a half-built line the player never asked to run.
  it('leaves preview routes alone', () => {
    const { provision, useCase } = createFixture([
      { id: 'r1', stNodes: [] },
      { id: 'temp', stNodes: [], tempParentId: 'r1' },
    ])

    expect(useCase.execute()).toBe(1)
    expect(provision.execute).toHaveBeenCalledTimes(1)
    expect(provision.execute).toHaveBeenCalledWith('r1')
  })

  it('has nothing to provision in a city with no lines', () => {
    const { provision, useCase } = createFixture([])

    expect(useCase.execute()).toBe(0)
    expect(provision.execute).not.toHaveBeenCalled()
  })

  it('has nothing to provision when the game holds no lines at all', () => {
    const { provision, useCase } = createFixture(undefined)

    expect(useCase.execute()).toBe(0)
    expect(provision.execute).not.toHaveBeenCalled()
  })

  it('puts the line list back in order', () => {
    const { sortLines, useCase } = createFixture([{ id: 'r1', stNodes: [] }])
    useCase.execute()

    expect(sortLines.execute).toHaveBeenCalled()
  })
})
