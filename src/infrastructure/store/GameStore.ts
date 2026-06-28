import type { GameState } from '@/shared/game/GameState'
import type { StoreCallbacks } from '@/shared/game/StoreCallbacks'

// Typed handle over the internal store. Every read/action goes through a fresh
// getState() snapshot (the old `G()`), because the game mutates state between
// awaits and stale snapshots would act on old routes/trains.
export class GameStore {
  constructor(private readonly callbacks: StoreCallbacks) {}

  state(): GameState {
    return this.callbacks.getState()
  }
}
