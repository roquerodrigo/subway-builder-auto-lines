import type { HeadwayMinutes } from '@/domain/settings/ServiceSettings'
import type { Route } from '@/shared/game/Route'

import { MAX_HEADWAY_MINUTES, MIN_HEADWAY_MINUTES } from '@/domain/settings/ServiceSettings'
import { cycleSecondsOf } from '@/shared/game/Route'

const SECONDS_PER_MINUTE = 60

// What a line is served at right now, read back off the game: a period's train
// count over the line's round trip is its headway. The inverse of ServiceSchedule,
// so the panel can show a line's real frequency — including one the player set in
// the game's own interface — rather than what the mod last asked for.
export class LineHeadways {
  static forRoute(route: Route, fallback: HeadwayMinutes): HeadwayMinutes {
    const cycleSeconds = cycleSecondsOf(route)
    const schedule = route.trainSchedule
    if (cycleSeconds <= 0 || !schedule) {
      return fallback
    }
    const minutesFor = (count: number | undefined, fallbackMinutes: number): number =>
      (count && count > 0 ?
          Math.min(MAX_HEADWAY_MINUTES, Math.max(MIN_HEADWAY_MINUTES, Math.round(cycleSeconds / count / SECONDS_PER_MINUTE))) :
        fallbackMinutes)

    return {
      midday: minutesFor(schedule.mediumDemand, fallback.midday),
      night: minutesFor(schedule.veryLowDemand ?? schedule.lowDemand, fallback.night),
      offPeak: minutesFor(schedule.lowDemand, fallback.offPeak),
      peak: minutesFor(schedule.highDemand, fallback.peak),
    }
  }
}
