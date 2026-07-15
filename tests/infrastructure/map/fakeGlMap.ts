import type { Mock } from 'vitest'

import { vi } from 'vitest'

import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

export interface FakeApi extends SubwayBuilderApi {
  utils: { getMap: Mock<() => unknown> }
}

export interface FakeGlMap {
  addLayer: Mock<(layer: unknown, beforeId?: string) => void>
  addSource: Mock<(id: string, source: unknown) => void>
  // Knobs for the failure modes the real map has: a style that is not ready yet
  // (so it rejects a source), and a style swapped mid-call (so reads throw).
  addSourceFailures: number
  beforeIdOf(layerId: string): string | undefined
  breakGetSource: boolean
  getLayer: Mock<(id: string) => unknown>
  getSource: Mock<(id: string) => FakeSource | undefined>

  isStyleLoaded: Mock<() => boolean>
  layerOrder: string[]
  layers: Map<string, RecordedLayer>

  paintOf(layerId: string): Record<string, unknown>
  seedLayer(layer: Partial<RecordedLayer> & { id: string }): void
  setFilter: Mock<(layerId: string, filter: unknown) => void>

  setPaintProperty: Mock<(layerId: string, name: string, value: unknown) => void>
  sourceData(id: string): unknown
  sources: Map<string, FakeSource>
  styleLoaded: boolean
}

export interface FakeSource {
  data: unknown
  setData: Mock<(data: unknown) => void>
}

export interface RecordedLayer {
  filter?: unknown
  id: string
  layout?: Record<string, unknown>
  paint: Record<string, unknown>
  source: string
  type: string
}

// The overlay re-fetches the map through the api on every call, so a test drives
// which instance (or none) it gets back per call.
export function createFakeApi(currentMap: () => FakeGlMap | null): FakeApi {
  return { utils: { getMap: vi.fn((): unknown => currentMap()) } }
}

// A stand-in for the Mapbox/MapLibre GL instance the game hands out
// (api.utils.getMap()), implementing only the slice PreviewMapOverlay uses. It
// records the layers and the GeoJSON it is handed so a test can read back what
// the overlay actually drew.
export function createFakeGlMap(): FakeGlMap {
  const beforeIds = new Map<string, string | undefined>()

  const map: FakeGlMap = {
    addLayer: vi.fn((layer: unknown, beforeId?: string): void => {
      const spec = layer as RecordedLayer
      map.layers.set(spec.id, { ...spec, paint: { ...spec.paint } })
      map.layerOrder.push(spec.id)
      beforeIds.set(spec.id, beforeId)
    }),
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
    addSourceFailures: 0,

    beforeIdOf: (layerId: string): string | undefined => beforeIds.get(layerId),
    breakGetSource: false,
    getLayer: vi.fn((id: string): unknown => map.layers.get(id)),

    getSource: vi.fn((id: string): FakeSource | undefined => {
      if (map.breakGetSource) {
        throw new Error('the style is not loaded')
      }

      return map.sources.get(id)
    }),

    isStyleLoaded: vi.fn((): boolean => map.styleLoaded),

    layerOrder: [],

    layers: new Map(),

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

    sourceData: (id: string): unknown => map.sources.get(id)?.data,

    sources: new Map(),

    styleLoaded: true,
  }

  return map
}
