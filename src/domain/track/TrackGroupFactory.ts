import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

import { UniqueId } from '@/shared/UniqueId'

const PARALLEL_LANES = 'parallel'

// The group that owns a single track the mod fabricated. Loading a save deletes
// every track no group lists, so a track written into the game without one lasts
// only until the city is next opened.
export class TrackGroupFactory {
  static own(track: Track): TrackGroup {
    return {
      centerLine: [track.coords[0], track.coords[track.coords.length - 1]],
      id: UniqueId.create('track-group'),
      trackIds: [track.id],
      trackLanesType: PARALLEL_LANES,
      trackType: track.trackType,
      type: track.type,
    }
  }
}
