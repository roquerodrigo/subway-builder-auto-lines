import type { Mock } from 'vitest'

import { vi } from 'vitest'

import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

export interface RecordedLayer {
  id: string
  type: string
  source: string
  filter?: unknown
  layout?: Record<string, unknown>
  paint: Record<string, unknown>
}

export interface FakeSource {
  data: unknown
  setData: Mock<(data: unknown) => void>
}

export interface FakeGlMap {
  addLayer: Mock<(layer: unknown, beforeId?: string) => void>
  addSource: Mock<(id: string, source: unknown) => void>
  getLayer: Mock<(id: string) => unknown>
  getSource: Mock<(id: string) => FakeSource | undefined>
  isStyleLoaded: Mock<() => boolean>
  setFilter: Mock<(layerId: string, filter: unknown) => void>
  setPaintProperty: Mock<(layerId: string, name: string, value: unknown) => void>

  layerOrder: string[]
  layers: Map<string, RecordedLayer>
  sources: Map<string, FakeSource>

  // Knobs for the failure modes the real map has: a style that is not ready yet
  // (so it rejects a source), and a style swapped mid-call (so reads throw).
  addSourceFailures: number
  breakGetSource: boolean
  styleLoaded: boolean

  beforeIdOf(layerId: string): string | undefined
  paintOf(layerId: string): Record<string, unknown>
  seedLayer(layer: Partial<RecordedLayer> & { id: string }): void
  sourceData(id: string): unknown
}

// A stand-in for the Mapbox/MapLibre GL instance the game hands out
// (api.utils.getMap()), implementing only the slice PreviewMapOverlay uses. It
// records the layers and the GeoJSON it is handed so a test can read back what
// the overlay actually drew.
export function createFakeGlMap(): FakeGlMap {
  const beforeIds = new Map<string, string | undefined>()

  const map: FakeGlMap = {
    addSourceFailures: 0,
    breakGetSource: false,
    styleLoaded: true,

    layerOrder: [],
    layers: new Map(),
    sources: new Map(),

    isStyleLoaded: vi.fn((): boolean => map.styleLoaded),

    addSource: vi.fn((id: string, source: unknown): void => {
      if (map.addSourceFailures > 0) {
        map.addSourceFailures--
        throw new Error('style is not done loading')
      }
      const entry: FakeSource = {
        data: (source as { data?: unknown }).data,
        setData: vi.fn((data: unknown): void => {
          entry.data = data
        }),
      }
      map.sources.set(id, entry)
    }),

    getSource: vi.fn((id: string): FakeSource | undefined => {
      if (map.breakGetSource) {
        throw new Error('the style is not loaded')
      }
      return map.sources.get(id)
    }),

    addLayer: vi.fn((layer: unknown, beforeId?: string): void => {
      const spec = layer as RecordedLayer
      map.layers.set(spec.id, { ...spec, paint: { ...spec.paint } })
      map.layerOrder.push(spec.id)
      beforeIds.set(spec.id, beforeId)
    }),

    getLayer: vi.fn((id: string): unknown => map.layers.get(id)),

    setFilter: vi.fn((layerId: string, filter: unknown): void => {
      const layer = map.layers.get(layerId)
      if (layer) {
        layer.filter = filter
      }
    }),

    setPaintProperty: vi.fn((layerId: string, name: string, value: unknown): void => {
      const layer = map.layers.get(layerId)
      if (layer) {
        layer.paint[name] = value
      }
    }),

    beforeIdOf: (layerId: string): string | undefined => beforeIds.get(layerId),

    paintOf: (layerId: string): Record<string, unknown> => {
      const layer = map.layers.get(layerId)
      if (!layer) {
        throw new Error(`no layer ${layerId} on the map`)
      }
      return layer.paint
    },

    seedLayer: (layer: Partial<RecordedLayer> & { id: string }): void => {
      map.layers.set(layer.id, { paint: {}, source: 'autolines-preview', type: 'line', ...layer })
      map.layerOrder.push(layer.id)
    },

    sourceData: (id: string): unknown => map.sources.get(id)?.data,
  }

  return map
}

export interface FakeApi extends SubwayBuilderApi {
  utils: { getMap: Mock<() => unknown> }
}

// The overlay re-fetches the map through the api on every call, so a test drives
// which instance (or none) it gets back per call.
export function createFakeApi(currentMap: () => FakeGlMap | null): FakeApi {
  return { utils: { getMap: vi.fn((): unknown => currentMap()) } }
}
