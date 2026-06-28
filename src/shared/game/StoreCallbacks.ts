import type { GameState } from '@/shared/game/GameState'

// The internal store handle the mod hooks into
// (window.__subwayBuilder_storeCallbacks__). getState() returns the full store
// snapshot including its action methods.
export interface StoreCallbacks {
  getState(): GameState
}
