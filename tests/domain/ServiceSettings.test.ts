import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SERVICE_SETTINGS,
  MAX_CARS_PER_TRAIN,
  MAX_HEADWAY_MINUTES,
  MIN_CARS_PER_TRAIN,
  MIN_HEADWAY_MINUTES,
  ServiceSettingsPolicy,
} from '@/domain/settings/ServiceSettings'

describe('DEFAULT_SERVICE_SETTINGS', () => {
  it('provisions full ten-car trains on 5/15/30/60-minute headways', () => {
    expect(DEFAULT_SERVICE_SETTINGS).toEqual({
      autoTrains: true,
      carsPerTrain: 10,
      headwayMinutes: { midday: 15, night: 60, offPeak: 30, peak: 5 },
      serviceByRoute: {},
    })
  })
})

describe('ServiceSettingsPolicy.sanitize', () => {
  it('keeps settings that are already valid', () => {
    const settings = {
      autoTrains: false,
      carsPerTrain: 6,
      headwayMinutes: { midday: 12, night: 45, offPeak: 20, peak: 4 },
      serviceByRoute: { 'route-1': { carsPerTrain: 6, headwayMinutes: { midday: 8, night: 20, offPeak: 12, peak: 3 } } },
    }

    expect(ServiceSettingsPolicy.sanitize(settings)).toEqual(settings)
  })

  it('falls back to the defaults for anything that is not settings at all', () => {
    expect(ServiceSettingsPolicy.sanitize(null)).toEqual(DEFAULT_SERVICE_SETTINGS)
    expect(ServiceSettingsPolicy.sanitize(undefined)).toEqual(DEFAULT_SERVICE_SETTINGS)
    expect(ServiceSettingsPolicy.sanitize('nonsense')).toEqual(DEFAULT_SERVICE_SETTINGS)
    expect(ServiceSettingsPolicy.sanitize({})).toEqual(DEFAULT_SERVICE_SETTINGS)
  })

  // An entry written by an older version of the mod carries only some of the fields.
  it('fills in the fields an older entry never wrote', () => {
    expect(ServiceSettingsPolicy.sanitize({ carsPerTrain: 8, headwayMinutes: { peak: 3 } })).toEqual({
      autoTrains: true,
      carsPerTrain: 8,
      headwayMinutes: { midday: 15, night: 60, offPeak: 30, peak: 3 },
      serviceByRoute: {},
    })
  })

  it('holds the train length to what the game takes', () => {
    expect(ServiceSettingsPolicy.sanitize({ carsPerTrain: 99 }).carsPerTrain).toBe(MAX_CARS_PER_TRAIN)
    expect(ServiceSettingsPolicy.sanitize({ carsPerTrain: 0 }).carsPerTrain).toBe(MIN_CARS_PER_TRAIN)
    expect(ServiceSettingsPolicy.sanitize({ carsPerTrain: -4 }).carsPerTrain).toBe(MIN_CARS_PER_TRAIN)
  })

  it('holds every headway to a workable range', () => {
    expect(ServiceSettingsPolicy.sanitize({ headwayMinutes: { peak: 0 } }).headwayMinutes.peak)
      .toBe(MIN_HEADWAY_MINUTES)
    expect(ServiceSettingsPolicy.sanitize({ headwayMinutes: { night: 10_000 } }).headwayMinutes.night)
      .toBe(MAX_HEADWAY_MINUTES)
  })

  it('rounds a fractional value to a whole one', () => {
    expect(ServiceSettingsPolicy.sanitize({ carsPerTrain: 7.6 }).carsPerTrain).toBe(8)
    expect(ServiceSettingsPolicy.sanitize({ headwayMinutes: { midday: 12.4 } }).headwayMinutes.midday).toBe(12)
  })

  it('ignores values of the wrong type', () => {
    const settings = ServiceSettingsPolicy.sanitize({
      autoTrains: 'yes',
      carsPerTrain: '8',
      headwayMinutes: { peak: Number.NaN },
    })

    expect(settings).toEqual(DEFAULT_SERVICE_SETTINGS)
  })

  it('ignores headways that are not an object', () => {
    expect(ServiceSettingsPolicy.sanitize({ headwayMinutes: 5 })).toEqual(DEFAULT_SERVICE_SETTINGS)
  })
})

describe('ServiceSettingsPolicy.isDefault', () => {
  it('recognises untouched settings', () => {
    expect(ServiceSettingsPolicy.isDefault(DEFAULT_SERVICE_SETTINGS)).toBe(true)
  })

  it('recognises every field the player can have changed', () => {
    const changes = [
      { autoTrains: false },
      { carsPerTrain: 8 },
      { headwayMinutes: { ...DEFAULT_SERVICE_SETTINGS.headwayMinutes, peak: 4 } },
      { headwayMinutes: { ...DEFAULT_SERVICE_SETTINGS.headwayMinutes, midday: 20 } },
      { headwayMinutes: { ...DEFAULT_SERVICE_SETTINGS.headwayMinutes, offPeak: 25 } },
      { headwayMinutes: { ...DEFAULT_SERVICE_SETTINGS.headwayMinutes, night: 90 } },
    ]
    for (const change of changes) {
      expect(ServiceSettingsPolicy.isDefault({ ...DEFAULT_SERVICE_SETTINGS, ...change })).toBe(false)
    }
  })
})

describe('ServiceSettingsPolicy per-line service', () => {
  const OWN_SERVICE = {
    carsPerTrain: 6,
    headwayMinutes: { midday: 8, night: 20, offPeak: 12, peak: 3 },
  }
  const CITY_WIDE = {
    carsPerTrain: DEFAULT_SERVICE_SETTINGS.carsPerTrain,
    headwayMinutes: DEFAULT_SERVICE_SETTINGS.headwayMinutes,
  }

  it('serves a line on the city-wide settings by default', () => {
    expect(ServiceSettingsPolicy.serviceFor(DEFAULT_SERVICE_SETTINGS, 'route-1')).toEqual(CITY_WIDE)
    expect(ServiceSettingsPolicy.hasOwnService(DEFAULT_SERVICE_SETTINGS, 'route-1')).toBe(false)
  })

  it('serves a line on its own service once it has one', () => {
    const settings = ServiceSettingsPolicy.withRouteService(DEFAULT_SERVICE_SETTINGS, 'route-1', OWN_SERVICE)

    expect(ServiceSettingsPolicy.serviceFor(settings, 'route-1')).toEqual(OWN_SERVICE)
    expect(ServiceSettingsPolicy.hasOwnService(settings, 'route-1')).toBe(true)
  })

  it('leaves every other line on the city-wide settings', () => {
    const settings = ServiceSettingsPolicy.withRouteService(DEFAULT_SERVICE_SETTINGS, 'route-1', OWN_SERVICE)

    expect(ServiceSettingsPolicy.serviceFor(settings, 'route-2')).toEqual(CITY_WIDE)
  })

  // Otherwise "same as everywhere else" would linger as an override and stop
  // following the settings the player copied it from.
  it('puts a line back on the city-wide settings when given those exact numbers', () => {
    const own = ServiceSettingsPolicy.withRouteService(DEFAULT_SERVICE_SETTINGS, 'route-1', OWN_SERVICE)

    expect(ServiceSettingsPolicy.withRouteService(own, 'route-1', CITY_WIDE).serviceByRoute).toEqual({})
  })

  it('keeps a line that differs only in train length', () => {
    const settings = ServiceSettingsPolicy.withRouteService(DEFAULT_SERVICE_SETTINGS, 'route-1', {
      ...CITY_WIDE,
      carsPerTrain: 4,
    })

    expect(ServiceSettingsPolicy.serviceFor(settings, 'route-1').carsPerTrain).toBe(4)
  })

  it('forgets the service of a line that is no longer in the city', () => {
    const settings = ServiceSettingsPolicy.withRouteService(DEFAULT_SERVICE_SETTINGS, 'route-1', OWN_SERVICE)

    expect(ServiceSettingsPolicy.keepingRoutes(settings, ['route-2']).serviceByRoute).toEqual({})
    expect(ServiceSettingsPolicy.keepingRoutes(settings, ['route-1']).serviceByRoute)
      .toEqual({ 'route-1': OWN_SERVICE })
  })

  it('counts a line with its own service as a change from the defaults', () => {
    const settings = ServiceSettingsPolicy.withRouteService(DEFAULT_SERVICE_SETTINGS, 'route-1', OWN_SERVICE)

    expect(ServiceSettingsPolicy.isDefault(settings)).toBe(false)
  })

  it('sanitizes the service a line was given', () => {
    const settings = ServiceSettingsPolicy.sanitize({
      serviceByRoute: { 'route-1': { carsPerTrain: 99, headwayMinutes: { peak: 0 } }, 'route-2': 'nonsense' },
    })

    expect(settings.serviceByRoute).toEqual({
      'route-1': {
        carsPerTrain: 15,
        headwayMinutes: { midday: 15, night: 60, offPeak: 30, peak: MIN_HEADWAY_MINUTES },
      },
    })
  })

  // An entry from before per-line service existed carries none of it.
  it('falls back to the city-wide numbers for a line entry that says nothing', () => {
    const settings = ServiceSettingsPolicy.sanitize({
      carsPerTrain: 8,
      headwayMinutes: { peak: 4 },
      serviceByRoute: { 'route-1': {} },
    })

    expect(settings.serviceByRoute['route-1']).toEqual({
      carsPerTrain: 8,
      headwayMinutes: { midday: 15, night: 60, offPeak: 30, peak: 4 },
    })
  })

  it('ignores per-line service that is not an object', () => {
    expect(ServiceSettingsPolicy.sanitize({ serviceByRoute: 7 }).serviceByRoute).toEqual({})
  })
})
