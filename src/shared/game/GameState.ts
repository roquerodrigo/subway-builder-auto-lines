import type { PreviewRouteAction } from '@/shared/game/PreviewRouteAction'
import type { Route } from '@/shared/game/Route'
import type { Station } from '@/shared/game/Station'
import type { StationNode } from '@/shared/game/StationNode'
import type { SetTracksArg, Track, TrackGraph } from '@/shared/game/Track'
import type { Train } from '@/shared/game/Train'

// The internal store snapshot (window.__subwayBuilder_storeCallbacks__.getState()).
// Read fields plus the action methods the mod calls. Actions are optional: the
// mod feature-detects each one before use, mirroring the original guards.
export interface GameState {
  batchPreviewRouteUpdates?(): Promise<void>
  buyTrains?(count: number, trainType: string): unknown
  changePreviewRoute?(change: PreviewRouteChange): void
  clearPendingStNodeChanges?(): void
  confirmRouteChange?(): void
  deleteRoute?(routeId: string): void
  generateRoute?(options: Record<string, unknown>): Route
  generateTrain?(routeId: string): void
  money: number
  ownedCarsByType?: Record<string, number>
  ownedTrainCount: number

  previewRoute?: null | Route
  routes?: Route[]
  setManualRouteOrdering?(manual: boolean): void
  setMoney?(amount: number): void
  setOwnedTrainCount?(count: number): void
  setPreviewRoute?(route: null | Route): void
  // ---- routes ----
  setRoutes?(routes: Route[], regen?: boolean): void
  // ---- tracks ----
  setTracks?(arg: SetTracksArg): void
  // ---- trains / fleet ----
  setTrains?(trains: Train[]): void
  spawnTrainAtStation?(routeId: string, stationIndex: number): void

  // ---- read ----
  stations?: Station[]

  stNodes?: StationNode[]
  timeConfig?: { elapsedSeconds?: number }
  trackGraph?: TrackGraph
  tracks: Track[]
  trains?: Train[]
  updateRouteProperty?(routeId: string, key: string, value: unknown): void
}

export interface PreviewRouteChange {
  action: PreviewRouteAction
  stNodeId: string
}
