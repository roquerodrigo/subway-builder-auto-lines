import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServiceSettings } from '@/domain/settings/ServiceSettings'

import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'
import { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import { logger } from '@/shared/Logger'

const STORAGE_KEY = 'autolines-service-settings'

const CUSTOM_SETTINGS: ServiceSettings = {
  autoTrains: false,
  carsPerTrain: 6,
  headwayMinutes: { midday: 12, night: 45, offPeak: 20, peak: 4 },
  serviceByRoute: { 'route-1': { carsPerTrain: 6, headwayMinutes: { midday: 8, night: 20, offPeak: 12, peak: 3 } } },
  sortLinesByName: false,
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ServiceSettingsStore', () => {
  it('starts a fresh player off on the defaults', () => {
    expect(new ServiceSettingsStore().current()).toEqual(DEFAULT_SERVICE_SETTINGS)
  })

  it('reads back what the player saved, across a reload of the game', () => {
    new ServiceSettingsStore().save(CUSTOM_SETTINGS)

    expect(new ServiceSettingsStore().current()).toEqual(CUSTOM_SETTINGS)
  })

  it('reports the settings it saved, so the panel shows what took effect', () => {
    expect(new ServiceSettingsStore().save({ ...CUSTOM_SETTINGS, carsPerTrain: 99 }).carsPerTrain).toBe(15)
  })

  it('sanitizes what it saves, never writing a value the game would choke on', () => {
    new ServiceSettingsStore().save({ ...CUSTOM_SETTINGS, carsPerTrain: 0 })

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null').carsPerTrain).toBe(1)
  })

  it('sanitizes an entry that was edited by hand', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ carsPerTrain: 400 }))

    expect(new ServiceSettingsStore().current()).toEqual({ ...DEFAULT_SERVICE_SETTINGS, carsPerTrain: 15 })
  })

  it('keeps the service a line was given, across a reload of the game', () => {
    new ServiceSettingsStore().save(CUSTOM_SETTINGS)

    expect(new ServiceSettingsStore().current().serviceByRoute).toEqual({
      'route-1': { carsPerTrain: 6, headwayMinutes: { midday: 8, night: 20, offPeak: 12, peak: 3 } },
    })
  })

  it('falls back to the defaults for an unreadable entry', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json')

    expect(new ServiceSettingsStore().current()).toEqual(DEFAULT_SERVICE_SETTINGS)
  })

  it('puts every setting back on reset', () => {
    const store = new ServiceSettingsStore()
    store.save(CUSTOM_SETTINGS)

    expect(store.reset()).toEqual(DEFAULT_SERVICE_SETTINGS)
    expect(store.current()).toEqual(DEFAULT_SERVICE_SETTINGS)
    expect(new ServiceSettingsStore().current()).toEqual(DEFAULT_SERVICE_SETTINGS)
  })

  it('serves the settings from memory once read', () => {
    const store = new ServiceSettingsStore()
    store.current()
    const getItem = vi.spyOn(Storage.prototype, 'getItem')

    store.current()

    expect(getItem).not.toHaveBeenCalled()
  })

  // Private browsing (and a full quota) makes localStorage throw on write.
  it('keeps the settings for the session when they cannot be persisted', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const store = new ServiceSettingsStore()

    expect(store.save(CUSTOM_SETTINGS)).toEqual(CUSTOM_SETTINGS)
    expect(store.current()).toEqual(CUSTOM_SETTINGS)
    expect(warn).toHaveBeenCalled()
  })

  it('falls back to the defaults when localStorage cannot even be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(new ServiceSettingsStore().current()).toEqual(DEFAULT_SERVICE_SETTINGS)
  })
})
