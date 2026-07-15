import type { Mock } from 'vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Coordinate } from '@/shared/game/Coordinate'

import { PreviewMapOverlay } from '@/infrastructure/map/PreviewMapOverlay'

import type { FakeGlMap } from './fakeGlMap'

import { createFakeApi, createFakeGlMap } from './fakeGlMap'

const SOURCE_ID = 'autolines-preview'
const GLOW_LAYER = 'autolines-preview-glow'
const LINE_LAYER = 'autolines-preview-line'
const DOT_LAYER = 'autolines-preview-dots'
const RETRY_DELAY_MS = 120
const MAX_RETRIES = 25
const DOT_FILTER = ['==', ['geometry-type'], 'Point']

const RED = '#ef4444'
const BLUE = '#2563eb'

const LINE: Coordinate[] = [[1, 2], [3, 4], [5, 6]]
const STATIONS: Coordinate[] = [[1, 2], [5, 6]]

interface Feature {
  geometry: { coordinates: unknown, type: string }
  type: string
}

describe('PreviewMapOverlay', () => {
  let cancelFrame: Mock<(handle: number) => void>
  let currentMap: FakeGlMap | null
  let frames: Map<number, FrameRequestCallback>
  let map: FakeGlMap
  let nextFrameHandle: number

  // The pulse runs off requestAnimationFrame, whose timestamp drives the phase, so
  // a test has to decide both when a frame runs and what time it claims to be.
  function flushFrames(timestamp: number): void {
    const pending = [...frames.values()]
    frames.clear()
    for (const frame of pending) {
      frame(timestamp)
    }
  }

  function featuresOf(instance: FakeGlMap): Feature[] {
    const data = instance.sourceData(SOURCE_ID) as undefined | { features: Feature[], type: string }
    if (!data) {
      throw new Error('the overlay added no source')
    }

    return data.features
  }

  function makeOverlay(): PreviewMapOverlay {
    return new PreviewMapOverlay(createFakeApi(() => currentMap))
  }

  beforeEach(() => {
    frames = new Map()
    nextFrameHandle = 1
    cancelFrame = vi.fn((handle: number): void => {
      frames.delete(handle)
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      const handle = nextFrameHandle++
      frames.set(handle, callback)

      return handle
    })
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    // Only the retry timer is faked: the pulse's rAF is stubbed above, and a fake
    // clock driving it too would take the timestamp away from the test.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    map = createFakeGlMap()
    currentMap = map
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('show', () => {
    it('adds the source with a LineString per polyline and a Point per station', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      expect(map.addSource).toHaveBeenCalledWith(SOURCE_ID, {
        data: expect.anything() as unknown,
        type: 'geojson',
      })
      expect(featuresOf(map)).toEqual([
        { geometry: { coordinates: LINE, type: 'LineString' }, type: 'Feature' },
        { geometry: { coordinates: [1, 2], type: 'Point' }, type: 'Feature' },
        { geometry: { coordinates: [5, 6], type: 'Point' }, type: 'Feature' },
      ])
    })

    it('draws every polyline it is given, so an extension can grow both ends', () => {
      const other: Coordinate[] = [[9, 9], [8, 8]]

      makeOverlay().show([LINE, other], [], RED)

      expect(featuresOf(map)).toEqual([
        { geometry: { coordinates: LINE, type: 'LineString' }, type: 'Feature' },
        { geometry: { coordinates: other, type: 'LineString' }, type: 'Feature' },
      ])
    })

    it('skips a polyline with fewer than two points, which is not a line', () => {
      makeOverlay().show([[[1, 2]], []], [], RED)

      expect(featuresOf(map)).toEqual([])
    })

    it('adds the glow, line and dot layers in that order', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      expect(map.layerOrder).toEqual([GLOW_LAYER, LINE_LAYER, DOT_LAYER])
      expect(map.paintOf(LINE_LAYER)['line-width']).toBe(4.5)
      expect(map.paintOf(GLOW_LAYER)['line-blur']).toBe(8)
    })

    it('filters the dot layer down to Points, so no dot lands on a curve vertex', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      expect(map.layers.get(DOT_LAYER)?.filter).toEqual(DOT_FILTER)
    })

    it('heals a dot layer left filterless by an earlier build', () => {
      map.seedLayer({ id: DOT_LAYER, type: 'circle' })

      makeOverlay().show([LINE], STATIONS, RED)

      expect(map.setFilter).toHaveBeenCalledWith(DOT_LAYER, DOT_FILTER)
    })

    it('inserts the glow beneath an already-present line layer', () => {
      map.seedLayer({ id: LINE_LAYER })

      makeOverlay().show([LINE], STATIONS, RED)

      expect(map.beforeIdOf(GLOW_LAYER)).toBe(LINE_LAYER)
    })

    it('paints every layer in the requested color', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      expect(map.paintOf(GLOW_LAYER)['line-color']).toBe(RED)
      expect(map.paintOf(LINE_LAYER)['line-color']).toBe(RED)
      expect(map.paintOf(DOT_LAYER)['circle-color']).toBe(RED)
    })

    it('repaints the existing layers when the preview switches to another color', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)

      overlay.show([LINE], STATIONS, BLUE)

      expect(map.addLayer).toHaveBeenCalledTimes(3)
      expect(map.paintOf(GLOW_LAYER)['line-color']).toBe(BLUE)
      expect(map.paintOf(LINE_LAYER)['line-color']).toBe(BLUE)
      expect(map.paintOf(DOT_LAYER)['circle-color']).toBe(BLUE)
    })

    it('updates the existing source instead of adding a second one', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)

      overlay.show([[[7, 7], [8, 8]]], [], RED)

      expect(map.addSource).toHaveBeenCalledTimes(1)
      expect(featuresOf(map)).toEqual([
        { geometry: { coordinates: [[7, 7], [8, 8]], type: 'LineString' }, type: 'Feature' },
      ])
    })

    it('does nothing when the game hands out no map', () => {
      currentMap = null

      expect(() => makeOverlay().show([LINE], STATIONS, RED)).not.toThrow()
      expect(map.addSource).not.toHaveBeenCalled()
    })

    it('does nothing when the api exposes no getMap', () => {
      const overlay = new PreviewMapOverlay({ utils: {} })

      expect(() => overlay.show([LINE], STATIONS, RED)).not.toThrow()
    })

    it('does nothing when the api has no utils namespace at all', () => {
      const overlay = new PreviewMapOverlay({})

      expect(() => overlay.show([LINE], STATIONS, RED)).not.toThrow()
    })
  })

  describe('a first draw before the style is ready', () => {
    it('retries on a timer instead of giving up', () => {
      map.styleLoaded = false

      makeOverlay().show([LINE], STATIONS, RED)
      expect(map.addSource).not.toHaveBeenCalled()

      map.styleLoaded = true
      vi.advanceTimersByTime(RETRY_DELAY_MS)

      expect(map.addSource).toHaveBeenCalledTimes(1)
      expect(featuresOf(map)).toBeDefined()
    })

    // getSource throws while the style is between loads — which is why clear()
    // guards the identical call. A show() racing a city load has to land on the
    // retry that exists for this, not throw out of the overlay into the panel.
    it('retries instead of throwing when the style cannot even be read', () => {
      map.breakGetSource = true

      const overlay = makeOverlay()
      expect(() => overlay.show([LINE], STATIONS, RED)).not.toThrow()

      map.breakGetSource = false
      vi.advanceTimersByTime(RETRY_DELAY_MS)

      expect(map.sources.has(SOURCE_ID)).toBe(true)
    })

    it('retries when the style rejects the source despite reporting itself ready', () => {
      map.addSourceFailures = 1

      makeOverlay().show([LINE], STATIONS, RED)
      expect(map.sources.has(SOURCE_ID)).toBe(false)

      vi.advanceTimersByTime(RETRY_DELAY_MS)

      expect(map.addSource).toHaveBeenCalledTimes(2)
      expect(map.sources.has(SOURCE_ID)).toBe(true)
    })

    it('draws on the instance the game hands out now, not the one it started with', () => {
      map.styleLoaded = false
      makeOverlay().show([LINE], STATIONS, RED)

      const replacement = createFakeGlMap()
      currentMap = replacement
      vi.advanceTimersByTime(RETRY_DELAY_MS)

      expect(map.addSource).not.toHaveBeenCalled()
      expect(replacement.addSource).toHaveBeenCalledTimes(1)
      expect(featuresOf(replacement)).toHaveLength(3)
    })

    it('gives up after a bounded number of retries rather than spin forever', () => {
      map.styleLoaded = false

      makeOverlay().show([LINE], STATIONS, RED)
      vi.advanceTimersByTime(RETRY_DELAY_MS * (MAX_RETRIES + 5))

      expect(map.isStyleLoaded).toHaveBeenCalledTimes(MAX_RETRIES + 1)
      expect(map.addSource).not.toHaveBeenCalled()
    })

    it('starts a fresh retry budget for each new preview', () => {
      map.styleLoaded = false
      const overlay = makeOverlay()

      overlay.show([LINE], STATIONS, RED)
      vi.advanceTimersByTime(RETRY_DELAY_MS * (MAX_RETRIES + 5))
      overlay.show([LINE], STATIONS, RED)
      map.styleLoaded = true
      vi.advanceTimersByTime(RETRY_DELAY_MS)

      expect(map.addSource).toHaveBeenCalledTimes(1)
    })

    it('drops a retry whose preview was cleared before the timer fired', () => {
      map.styleLoaded = false
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)

      overlay.clear()
      map.styleLoaded = true
      vi.advanceTimersByTime(RETRY_DELAY_MS)

      expect(map.addSource).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('empties the source so nothing stays drawn', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)

      overlay.clear()

      expect(featuresOf(map)).toEqual([])
    })

    it('stops the pulse', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)

      overlay.clear()

      expect(cancelFrame).toHaveBeenCalledTimes(1)
      expect(frames.size).toBe(0)
    })

    it('is a no-op when nothing was ever drawn', () => {
      expect(() => makeOverlay().clear()).not.toThrow()
    })

    it('swallows a map whose style is gone', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)
      map.breakGetSource = true

      expect(() => overlay.clear()).not.toThrow()
    })
  })

  describe('the glow pulse', () => {
    it('breathes the glow width and opacity between their bounds', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      // Sine phase 0 sits mid-swing, so both land halfway between min and max.
      flushFrames(0)

      expect(map.paintOf(GLOW_LAYER)['line-width']).toBeCloseTo(20.25)
      expect(map.paintOf(GLOW_LAYER)['line-opacity']).toBeCloseTo(0.375)
    })

    it('reaches the top of the swing a quarter of a period in', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      flushFrames(450)

      expect(map.paintOf(GLOW_LAYER)['line-width']).toBeCloseTo(27)
      expect(map.paintOf(GLOW_LAYER)['line-opacity']).toBeCloseTo(0.6)
    })

    it('keeps requesting frames while the preview stands', () => {
      makeOverlay().show([LINE], STATIONS, RED)

      flushFrames(0)

      expect(frames.size).toBe(1)
    })

    it('stops once the preview is cleared', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)
      const tick = [...frames.values()][0]
      overlay.clear()

      tick(0)

      expect(frames.size).toBe(0)
    })

    it('stops when the glow layer is gone from under it', () => {
      makeOverlay().show([LINE], STATIONS, RED)
      map.layers.delete(GLOW_LAYER)

      flushFrames(0)

      expect(frames.size).toBe(0)
    })

    it('stops when the game swaps the map away', () => {
      makeOverlay().show([LINE], STATIONS, RED)
      currentMap = null

      flushFrames(0)

      expect(frames.size).toBe(0)
    })

    it('runs a single frame loop across repeated draws', () => {
      const overlay = makeOverlay()
      overlay.show([LINE], STATIONS, RED)

      overlay.show([LINE], STATIONS, BLUE)

      expect(cancelFrame).toHaveBeenCalledTimes(1)
      expect(frames.size).toBe(1)
    })
  })
})
