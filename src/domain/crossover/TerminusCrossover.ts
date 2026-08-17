import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

// A fabricated turnaround crossover: the diagonal track AND the group that owns
// it. Loading a save runs `removeOrphanTracks`, which deletes every track no
// track group lists — and then drops each route that ran over one. A crossover
// injected without its group therefore survives only until the next load, taking
// the line the mod just built down with it.
export interface TerminusCrossover {
  group: TrackGroup
  track: Track
}
