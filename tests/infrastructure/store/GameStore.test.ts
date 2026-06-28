import { describe, expect, it, vi } from 'vitest'

import type { GameState } from '@/shared/game/GameState'

import { GameStore } from '@/infrastructure/store/GameStore'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { money: 0, ownedTrainCount: 0, tracks: [], ...overrides }
}

describe('GameStore', () => {
  it('reads the store snapshot through the game’s own callbacks', () => {
    const state = makeState({ money: 42 })

    expect(new GameStore({ getState: () => state }).state()).toBe(state)
  })

  // The game mutates state between awaits, so a cached snapshot would act on
  // routes and trains that no longer exist.
  it('takes a fresh snapshot on every read', () => {
    const first = makeState({ money: 1 })
    const second = makeState({ money: 2 })
    const getState = vi.fn((): GameState => first).mockReturnValueOnce(first).mockReturnValueOnce(second)
    const store = new GameStore({ getState })

    expect(store.state()).toBe(first)
    expect(store.state()).toBe(second)
    expect(getState).toHaveBeenCalledTimes(2)
  })
})
