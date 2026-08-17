import type { GameStore } from '@/infrastructure/store/GameStore'
import type { SaveFile } from '@/shared/game/SaveFile'

import { OrphanTrackGroups } from '@/domain/track/OrphanTrackGroups'
import { logger } from '@/shared/Logger'

interface RescuingLoad {
  (save: SaveFile): unknown
  rescuesOrphanTracks?: boolean
}

// Loading a save deletes every track that no track group lists, then drops each
// route that ran over one — which is how a line built by an older version of this
// mod vanishes when the city is reopened. The tracks are still in the save file,
// so adopting them into groups on the way in brings those lines back. Wraps
// loadSave on the store's own state object, which is how the game invokes it.
export class OrphanTrackRescue {
  constructor(private readonly store: GameStore) {}

  private static adopt(save: SaveFile): void {
    const data = save?.data
    if (!Array.isArray(data?.tracks) || !Array.isArray(data.trackGroups)) {
      return
    }

    const missing = OrphanTrackGroups.missingFrom(data.tracks, data.trackGroups)
    if (!missing.length) {
      return
    }
    data.trackGroups = data.trackGroups.concat(missing)
    logger.log('adopted ' + missing.length + ' orphan track(s) the save load would have deleted.')
  }

  install(): void {
    const state = this.store.state()
    const original = state.loadSave
    if (typeof original !== 'function' || (original as RescuingLoad).rescuesOrphanTracks) {
      return
    }

    const rescuing: RescuingLoad = (save: SaveFile) => {
      OrphanTrackRescue.adopt(save)

      return original(save)
    }
    rescuing.rescuesOrphanTracks = true
    state.loadSave = rescuing
  }
}
