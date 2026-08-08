// What the player can tune from the panel: whether the mod provisions trains at
// all, how long the trains it puts on a line are, and how often each demand
// period is served. Everything here is player input — sanitize before use, since
// it ends up written straight into the game's routes.
export interface HeadwayMinutes {
  midday: number
  night: number
  offPeak: number
  peak: number
}

export interface ServiceSettings {
  autoTrains: boolean
  carsPerTrain: number
  headwayMinutes: HeadwayMinutes
}

export const DEFAULT_SERVICE_SETTINGS: ServiceSettings = {
  autoTrains: true,
  carsPerTrain: 10,
  headwayMinutes: { midday: 15, night: 60, offPeak: 30, peak: 5 },
}

export const MIN_CARS_PER_TRAIN = 1
// The longest heavy-metro train the game takes. A type that takes fewer caps the
// value again when the mod applies it, so asking for more here is harmless.
export const MAX_CARS_PER_TRAIN = 15

export const MIN_HEADWAY_MINUTES = 1
export const MAX_HEADWAY_MINUTES = 240

export class ServiceSettingsPolicy {
  static isDefault(settings: ServiceSettings): boolean {
    const headways = settings.headwayMinutes
    const defaults = DEFAULT_SERVICE_SETTINGS.headwayMinutes

    return (
      settings.autoTrains === DEFAULT_SERVICE_SETTINGS.autoTrains &&
      settings.carsPerTrain === DEFAULT_SERVICE_SETTINGS.carsPerTrain &&
      headways.peak === defaults.peak &&
      headways.midday === defaults.midday &&
      headways.offPeak === defaults.offPeak &&
      headways.night === defaults.night
    )
  }

  // Takes anything — a partial object, a stale entry from an older version, a
  // hand-edited one — and returns settings the mod can act on.
  static sanitize(raw: unknown): ServiceSettings {
    const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<ServiceSettings>
    const headways = (
      typeof source.headwayMinutes === 'object' && source.headwayMinutes !== null ? source.headwayMinutes : {}
    ) as Partial<HeadwayMinutes>
    const defaults = DEFAULT_SERVICE_SETTINGS.headwayMinutes

    return {
      autoTrains: typeof source.autoTrains === 'boolean' ? source.autoTrains : DEFAULT_SERVICE_SETTINGS.autoTrains,
      carsPerTrain: whole(
        source.carsPerTrain,
        DEFAULT_SERVICE_SETTINGS.carsPerTrain,
        MIN_CARS_PER_TRAIN,
        MAX_CARS_PER_TRAIN,
      ),
      headwayMinutes: {
        midday: headway(headways.midday, defaults.midday),
        night: headway(headways.night, defaults.night),
        offPeak: headway(headways.offPeak, defaults.offPeak),
        peak: headway(headways.peak, defaults.peak),
      },
    }
  }
}

function headway(value: unknown, fallback: number): number {
  return whole(value, fallback, MIN_HEADWAY_MINUTES, MAX_HEADWAY_MINUTES)
}

function whole(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(value)))
}
