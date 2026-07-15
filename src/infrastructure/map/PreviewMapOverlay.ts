import type { Coordinate } from '@/shared/game/Coordinate'
import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

// The slice of the Mapbox/MapLibre GL map instance (api.utils.getMap()) the
// overlay uses.
interface GlMap {
  addLayer(layer: unknown, beforeId?: string): void
  addSource(id: string, source: unknown): void
  getLayer(id: string): unknown
  getSource(id: string): undefined | { setData(data: unknown): void }
  isStyleLoaded(): boolean
  setFilter(layerId: string, filter: unknown): void
  setPaintProperty(layerId: string, name: string, value: unknown): void
}

const SOURCE_ID = 'autolines-preview'
const GLOW_LAYER = 'autolines-preview-glow'
const LINE_LAYER = 'autolines-preview-line'
const DOT_LAYER = 'autolines-preview-dots'
const EMPTY = { features: [] as unknown[], type: 'FeatureCollection' }
const RETRY_DELAY_MS = 120
const MAX_RETRIES = 25
const LINE_WIDTH = 4.5
// A `circle` layer would otherwise dot every vertex of the line too; restrict it
// to the station Point features so dots land only on stations.
const DOT_FILTER = ['==', ['geometry-type'], 'Point']

// The glow layer pulses to draw the eye: its width and opacity breathe between
// these bounds over one PULSE_PERIOD_MS cycle.
const PULSE_PERIOD_MS = 1800
const GLOW_WIDTH_MIN = LINE_WIDTH * 3
const GLOW_WIDTH_MAX = LINE_WIDTH * 6
const GLOW_OPACITY_MIN = 0.15
const GLOW_OPACITY_MAX = 0.6

// Draws the previewed line on the map as a colored GeoJSON overlay (a line that
// follows the real track geometry plus a dot per station), so the player can see
// where the line will go while browsing. It creates no route — nothing is
// committed — and clears itself when the preview goes away.
//
// The map is fetched fresh on every call (never cached): the game can replace the
// map instance on city load, and a cached handle would go stale (its
// `isStyleLoaded()` stuck false, so the overlay would silently never draw). A
// first draw that lands before the style is ready is retried on a short timer
// (not deferred to a map event, which never fires while the map sits idle).
export class PreviewMapOverlay {
  private animationFrame: null | number = null
  private pending: null | { color: string, lines: Coordinate[][], stations: Coordinate[] } = null
  private retries = 0

  constructor(private readonly api: SubwayBuilderApi) {}

  clear(): void {
    this.pending = null
    this.stopPulse()
    try {
      this.map()?.getSource(SOURCE_ID)?.setData(EMPTY)
    } catch {
      /* map not ready — nothing drawn yet */
    }
  }

  // `lines` are the rail polylines to draw (extend can grow both ends); `stations`
  // are the station points that get a dot. Kept separate so the line follows the
  // real track geometry while dots land only on stations, not on every curve vertex.
  show(lines: Coordinate[][], stations: Coordinate[], color: string): void {
    this.pending = { color, lines, stations }
    this.retries = 0
    this.draw()
  }

  private draw(): void {
    const map = this.map()
    const pending = this.pending
    if (!map || !pending) {
      return
    }

    const data = this.featureCollection(pending)

    // getSource throws while the style is between loads — the same reason clear()
    // guards it. Retrying keeps a draw that races a city load inside the overlay
    // instead of throwing out into the panel that asked for a preview.
    let source
    try {
      source = map.getSource(SOURCE_ID)
    } catch {
      this.retryDraw()
      return
    }

    if (source) {
      source.setData(data)
      this.ensureLayers(map, pending.color)
      this.startPulse()
      return
    }

    // A first draw needs the style ready to accept a source. When it isn't (the
    // check is flaky and returns false mid-render), retry on a short timer rather
    // than give up — the pending draw always converges once the map settles.
    if (!map.isStyleLoaded()) {
      this.retryDraw()
      return
    }

    try {
      map.addSource(SOURCE_ID, { data, type: 'geojson' })
      this.ensureLayers(map, pending.color)
      this.startPulse()
    } catch {
      this.retryDraw()
    }
  }

  private ensureLayers(map: GlMap, color: string): void {
    // A wide, blurred, low-opacity copy of the line underneath gives it a glow.
    if (!map.getLayer(GLOW_LAYER)) {
      map.addLayer({
        filter: ['==', ['geometry-type'], 'LineString'],
        id: GLOW_LAYER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-blur': 8, 'line-color': color, 'line-opacity': 0.45, 'line-width': LINE_WIDTH * 3 },
        source: SOURCE_ID,
        type: 'line',
      }, map.getLayer(LINE_LAYER) ? LINE_LAYER : undefined)
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        filter: ['==', ['geometry-type'], 'LineString'],
        id: LINE_LAYER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-opacity': 0.95, 'line-width': LINE_WIDTH },
        source: SOURCE_ID,
        type: 'line',
      })
    }
    if (!map.getLayer(DOT_LAYER)) {
      map.addLayer({
        filter: DOT_FILTER,
        id: DOT_LAYER,
        paint: {
          'circle-color': color,
          'circle-radius': 5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
        source: SOURCE_ID,
        type: 'circle',
      })
    } else {
      // Heal a dot layer created by an earlier build that lacked the filter.
      map.setFilter(DOT_LAYER, DOT_FILTER)
    }

    // Keep the color in sync — it changes between the line being extended (its
    // own color) and a new line (the panel's preview color).
    map.setPaintProperty(GLOW_LAYER, 'line-color', color)
    map.setPaintProperty(LINE_LAYER, 'line-color', color)
    map.setPaintProperty(DOT_LAYER, 'circle-color', color)
  }

  private featureCollection(pending: { lines: Coordinate[][], stations: Coordinate[] }): unknown {
    const features: unknown[] = []
    for (const line of pending.lines) {
      if (line.length >= 2) {
        features.push({ geometry: { coordinates: line, type: 'LineString' }, type: 'Feature' })
      }
    }
    for (const station of pending.stations) {
      features.push({ geometry: { coordinates: station, type: 'Point' }, type: 'Feature' })
    }
    return { features, type: 'FeatureCollection' }
  }

  private map(): GlMap | null {
    return (this.api.utils?.getMap?.() ?? null) as GlMap | null
  }

  private retryDraw(): void {
    if (this.retries >= MAX_RETRIES) {
      return
    }
    this.retries++
    setTimeout(() => this.draw(), RETRY_DELAY_MS)
  }

  // Animates the glow layer's width/opacity on a sine curve so the preview
  // breathes. Runs off requestAnimationFrame (its timestamp drives the phase) and
  // stops as soon as the preview is cleared or the layer is gone.
  private startPulse(): void {
    this.stopPulse()
    const tick = (timestamp: number): void => {
      const map = this.map()
      if (!this.pending || !map || !map.getLayer(GLOW_LAYER)) {
        this.animationFrame = null
        return
      }
      const pulse = (Math.sin((timestamp / PULSE_PERIOD_MS) * 2 * Math.PI) + 1) / 2
      map.setPaintProperty(GLOW_LAYER, 'line-width', GLOW_WIDTH_MIN + (GLOW_WIDTH_MAX - GLOW_WIDTH_MIN) * pulse)
      map.setPaintProperty(GLOW_LAYER, 'line-opacity', GLOW_OPACITY_MIN + (GLOW_OPACITY_MAX - GLOW_OPACITY_MIN) * pulse)
      this.animationFrame = requestAnimationFrame(tick)
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  private stopPulse(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }
}
