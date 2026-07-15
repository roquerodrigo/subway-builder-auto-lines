import type { Mock } from 'vitest'

import { vi } from 'vitest'

import type { GameState } from '@/shared/game/GameState'

import { GameStore } from '@/infrastructure/store/GameStore'

export interface FakeGameStore {
  getState: Mock<() => GameState>
  state: GameState
  store: GameStore
}

// Stands in for the internal store the mod hooks into
// (window.__subwayBuilder_storeCallbacks__). One mutable snapshot whose actions
// write straight back into it, so a re-read through GameStore.state() sees what
// the last action did — which is what the mod's loops rely on the live store for.
export function createFakeGameStore(initial: Partial<GameState> = {}): FakeGameStore {
  const state: GameState = {
    money: 0,
    ownedTrainCount: 0,
    routes: [],
    tracks: [],
    trains: [],
    ...initial,
  }
  const getState = vi.fn((): GameState => state)

  return { getState, state, store: new GameStore({ getState }) }
}
