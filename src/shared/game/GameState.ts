import type { PreviewRouteAction } from '@/shared/game/PreviewRouteAction'
import type { Route } from '@/shared/game/Route'
import type { Station } from '@/shared/game/Station'
import type { StationNode } from '@/shared/game/StationNode'
import type { SetTracksArg, Track, TrackGraph } from '@/shared/game/Track'
import type { Train } from '@/shared/game/Train'

export interface PreviewRouteChange {
  stNodeId: string
  action: PreviewRouteAction
}

// The internal store snapshot (window.__subwayBuilder_storeCallbacks__.getState()).
// Read fields plus the action methods the mod calls. Actions are optional: the
// mod feature-detects each one before use, mirroring the original guards.
export interface GameState {
  // ---- read ----
  stations?: Station[]
  stNodes?: StationNode[]
  tracks: Track[]
  trackGraph?: TrackGraph
  routes?: Route[]
  trains?: Train[]
  previewRoute?: null | Route
  ownedTrainCount: number
  ownedCarsByType?: Record<string, number>
  timeConfig?: { elapsedSeconds?: number }
  money: number

  // ---- routes ----
  setRoutes?(routes: Route[], regen?: boolean): void
  setPreviewRoute?(route: null | Route): void
  changePreviewRoute?(change: PreviewRouteChange): void
  batchPreviewRouteUpdates?(): Promise<void>
  confirmRouteChange?(): void
  clearPendingStNodeChanges?(): void
  setManualRouteOrdering?(manual: boolean): void
  generateRoute?(options: Record<string, unknown>): Route
  deleteRoute?(routeId: string): void
  updateRouteProperty?(routeId: string, key: string, value: unknown): void

  // ---- tracks ----
  setTracks?(arg: SetTracksArg): void

  // ---- trains / fleet ----
  setTrains?(trains: Train[]): void
  generateTrain?(routeId: string): void
  spawnTrainAtStation?(routeId: string, stationIndex: number): void
  setOwnedTrainCount?(count: number): void
  buyTrains?(count: number, trainType: string): unknown
  setMoney?(amount: number): void
}
