import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

// The save the game hands to loadSave. Only the two lists the orphan-track rescue
// touches are typed here.
export interface SaveFile {
  data?: {
    trackGroups?: TrackGroup[]
    tracks?: Track[]
  }
}
