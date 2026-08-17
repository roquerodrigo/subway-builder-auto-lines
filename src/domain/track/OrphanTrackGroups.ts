import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

import { TrackGroupFactory } from '@/domain/track/TrackGroupFactory'

// The groups a set of tracks is missing: one per track that no group lists.
export class OrphanTrackGroups {
  static missingFrom(tracks: Track[], groups: TrackGroup[]): TrackGroup[] {
    const owned = new Set<string>()
    for (const group of groups) {
      for (const trackId of group.trackIds ?? []) {
        owned.add(trackId)
      }
    }

    return tracks.filter((track) => !owned.has(track.id)).map((track) => TrackGroupFactory.own(track))
  }
}
