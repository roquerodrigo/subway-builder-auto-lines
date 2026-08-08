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
    })
  })
})

describe('ServiceSettingsPolicy.sanitize', () => {
  it('keeps settings that are already valid', () => {
    const settings = {
      autoTrains: false,
      carsPerTrain: 6,
      headwayMinutes: { midday: 12, night: 45, offPeak: 20, peak: 4 },
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
