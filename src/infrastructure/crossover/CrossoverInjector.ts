import type { TerminusCrossover } from '@/domain/crossover/TerminusCrossover'
import type { GameStore } from '@/infrastructure/store/GameStore'
import type { SetTracksArg } from '@/shared/game/Track'

// Writes fabricated crossovers into the game — each diagonal together with the
// track group that owns it, because a save load deletes every track no group
// lists and then drops the routes that ran over it. setTracks regenerates the
// whole trackGraph; regenStations:false preserves station-node ids. Injecting a
// diagonal that already exists is a no-op (the factory returns null when the far
// ends are already linked), so this is safe whether or not the player has the
// "Auto Crossover" setting on.
export class CrossoverInjector {
  constructor(private readonly store: GameStore) {}

  inject(crossovers: Array<null | TerminusCrossover>): number {
    const real = crossovers.filter((crossover): crossover is TerminusCrossover => !!crossover)
    const state = this.store.state()
    if (!real.length || typeof state.setTracks !== 'function') {
      return 0
    }
    const argument: SetTracksArg = {
      newTracks: state.tracks.concat(real.map((crossover) => crossover.track)),
      regenRoutesWithTrackIDs: [],
      regenStations: false,
    }
    // Only when the running game keeps track groups at all: passing a list built
    // from nothing would wipe the ones it has.
    if (state.trackGroups) {
      argument.newTrackGroups = state.trackGroups.concat(real.map((crossover) => crossover.group))
    }
    state.setTracks(argument)

    return real.length
  }
}
