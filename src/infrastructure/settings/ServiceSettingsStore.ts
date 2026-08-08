import type { ServiceSettings } from '@/domain/settings/ServiceSettings'

import { DEFAULT_SERVICE_SETTINGS, ServiceSettingsPolicy } from '@/domain/settings/ServiceSettings'
import { logger } from '@/shared/Logger'

const STORAGE_KEY = 'autolines-service-settings'

// The player's service settings, persisted in localStorage so they outlive a
// reload of the game (the mod has no save slot of its own). Everything read back
// goes through the policy: a stale entry from an older version, or a hand-edited
// one, must never reach the game's routes as-is.
export class ServiceSettingsStore {
  private cached: null | ServiceSettings = null

  current(): ServiceSettings {
    if (!this.cached) {
      this.cached = ServiceSettingsPolicy.sanitize(this.read())
    }

    return this.cached
  }

  reset(): ServiceSettings {
    return this.save(DEFAULT_SERVICE_SETTINGS)
  }

  save(settings: ServiceSettings): ServiceSettings {
    const sanitized = ServiceSettingsPolicy.sanitize(settings)
    this.cached = sanitized
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
    } catch (error) {
      logger.warn('saveServiceSettings', error)
    }

    return sanitized
  }

  private read(): unknown {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)

      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
}
