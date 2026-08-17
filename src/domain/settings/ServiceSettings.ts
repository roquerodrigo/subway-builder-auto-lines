// What the player can tune from the panel: whether the mod provisions trains at
// all, how long the trains it puts on a line are, how often each demand period is
// served — city-wide, and per line for the ones that want their own service — and
// whether the game's line list is kept sorted by name.
// Everything here is player input — sanitize before use, since it ends up written
// straight into the game's routes.
export interface HeadwayMinutes {
  midday: number
  night: number
  offPeak: number
  peak: number
}

// What a single line is served at, when it is not simply following the city-wide
// numbers.
export interface LineService {
  carsPerTrain: number
  headwayMinutes: HeadwayMinutes
}

export interface ServiceSettings {
  autoTrains: boolean
  carsPerTrain: number
  headwayMinutes: HeadwayMinutes
  serviceByRoute: Record<string, LineService>
  sortLinesByName: boolean
}

export const DEFAULT_SERVICE_SETTINGS: ServiceSettings = {
  autoTrains: true,
  carsPerTrain: 10,
  headwayMinutes: { midday: 15, night: 60, offPeak: 30, peak: 5 },
  serviceByRoute: {},
  sortLinesByName: true,
}

export const MIN_CARS_PER_TRAIN = 1
// The longest heavy-metro train the game takes. A type that takes fewer caps the
// value again when the mod applies it, so asking for more here is harmless.
export const MAX_CARS_PER_TRAIN = 15

export const MIN_HEADWAY_MINUTES = 1
export const MAX_HEADWAY_MINUTES = 240

export class ServiceSettingsPolicy {
  static hasOwnService(settings: ServiceSettings, routeId: string): boolean {
    return settings.serviceByRoute[routeId] != null
  }

  static isDefault(settings: ServiceSettings): boolean {
    return (
      settings.autoTrains === DEFAULT_SERVICE_SETTINGS.autoTrains &&
      settings.carsPerTrain === DEFAULT_SERVICE_SETTINGS.carsPerTrain &&
      settings.sortLinesByName === DEFAULT_SERVICE_SETTINGS.sortLinesByName &&
      sameHeadways(settings.headwayMinutes, DEFAULT_SERVICE_SETTINGS.headwayMinutes) &&
      Object.keys(settings.serviceByRoute).length === 0
    )
  }

  // Drops the service of lines that are no longer in the city, so a settings entry
  // doesn't grow forever behind the player's back.
  static keepingRoutes(settings: ServiceSettings, routeIds: string[]): ServiceSettings {
    const keep = new Set(routeIds)
    const serviceByRoute: Record<string, LineService> = {}
    for (const [routeId, service] of Object.entries(settings.serviceByRoute)) {
      if (keep.has(routeId)) {
        serviceByRoute[routeId] = service
      }
    }

    return { ...settings, serviceByRoute }
  }

  // Takes anything — a partial object, a stale entry from an older version, a
  // hand-edited one — and returns settings the mod can act on.
  static sanitize(raw: unknown): ServiceSettings {
    const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<ServiceSettings>
    const cityWide: LineService = {
      carsPerTrain: whole(
        source.carsPerTrain,
        DEFAULT_SERVICE_SETTINGS.carsPerTrain,
        MIN_CARS_PER_TRAIN,
        MAX_CARS_PER_TRAIN,
      ),
      headwayMinutes: sanitizeHeadways(source.headwayMinutes, DEFAULT_SERVICE_SETTINGS.headwayMinutes),
    }

    return {
      autoTrains: typeof source.autoTrains === 'boolean' ? source.autoTrains : DEFAULT_SERVICE_SETTINGS.autoTrains,
      carsPerTrain: cityWide.carsPerTrain,
      headwayMinutes: cityWide.headwayMinutes,
      serviceByRoute: sanitizeByRoute(source.serviceByRoute, cityWide),
      sortLinesByName:
        typeof source.sortLinesByName === 'boolean' ?
          source.sortLinesByName :
          DEFAULT_SERVICE_SETTINGS.sortLinesByName,
    }
  }

  // What a line is served at: its own service when it has been given one, the
  // city-wide numbers otherwise.
  static serviceFor(settings: ServiceSettings, routeId: string): LineService {
    return (
      settings.serviceByRoute[routeId] ?? {
        carsPerTrain: settings.carsPerTrain,
        headwayMinutes: settings.headwayMinutes,
      }
    )
  }

  // Gives a line its own service — or puts it back on the city-wide numbers when
  // the player has typed those back in, so "same as everywhere else" never lingers
  // as an override that later drifts from the settings it was copied from.
  static withRouteService(settings: ServiceSettings, routeId: string, service: LineService): ServiceSettings {
    const serviceByRoute = { ...settings.serviceByRoute }
    if (
      service.carsPerTrain === settings.carsPerTrain &&
      sameHeadways(service.headwayMinutes, settings.headwayMinutes)
    ) {
      delete serviceByRoute[routeId]
    } else {
      serviceByRoute[routeId] = service
    }

    return { ...settings, serviceByRoute }
  }
}

function headway(value: unknown, fallback: number): number {
  return whole(value, fallback, MIN_HEADWAY_MINUTES, MAX_HEADWAY_MINUTES)
}

function sameHeadways(one: HeadwayMinutes, other: HeadwayMinutes): boolean {
  return (
    one.peak === other.peak &&
    one.midday === other.midday &&
    one.offPeak === other.offPeak &&
    one.night === other.night
  )
}

function sanitizeByRoute(raw: unknown, cityWide: LineService): Record<string, LineService> {
  if (typeof raw !== 'object' || raw === null) {
    return {}
  }
  const byRoute: Record<string, LineService> = {}
  for (const [routeId, service] of Object.entries(raw as Record<string, unknown>)) {
    if (routeId && typeof service === 'object' && service !== null) {
      const source = service as Partial<LineService>
      byRoute[routeId] = {
        carsPerTrain: whole(source.carsPerTrain, cityWide.carsPerTrain, MIN_CARS_PER_TRAIN, MAX_CARS_PER_TRAIN),
        headwayMinutes: sanitizeHeadways(source.headwayMinutes, cityWide.headwayMinutes),
      }
    }
  }

  return byRoute
}

function sanitizeHeadways(raw: unknown, defaults: HeadwayMinutes): HeadwayMinutes {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<HeadwayMinutes>

  return {
    midday: headway(source.midday, defaults.midday),
    night: headway(source.night, defaults.night),
    offPeak: headway(source.offPeak, defaults.offPeak),
    peak: headway(source.peak, defaults.peak),
  }
}

function whole(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(value)))
}
