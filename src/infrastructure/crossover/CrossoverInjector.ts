import type { GameStore } from '@/infrastructure/store/GameStore'
import type { Track } from '@/shared/game/Track'

// Writes fabricated crossover tracks into the game. setTracks regenerates the
// whole trackGraph; regenStations:false preserves station-node ids. Injecting a
// diagonal that already exists is a no-op (the factory returns null when the far
// ends are already linked), so this is safe whether or not the player has the
// "Auto Crossover" setting on.
export class CrossoverInjector {
  constructor(private readonly store: GameStore) {}

  inject(diagonals: Array<null | Track>): number {
    const real = diagonals.filter((track): track is Track => !!track)
    const state = this.store.state()
    if (!real.length || typeof state.setTracks !== 'function') {
      return 0
    }
    state.setTracks({
      newTracks: state.tracks.concat(real),
      regenRoutesWithTrackIDs: [],
      regenStations: false,
    })

    return real.length
  }
}
