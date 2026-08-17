import { describe, expect, it } from 'vitest'

import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

import { OrphanTrackGroups } from '@/domain/track/OrphanTrackGroups'

function group(id: string, trackIds: string[]): TrackGroup {
  return { centerLine: [[0, 0], [1, 1]], id, trackIds }
}

function track(id: string): Track {
  return { coords: [[0, 0], [1, 1]], id, trackType: 'heavy-metro', type: 'scissors-crossover' }
}

describe('OrphanTrackGroups.missingFrom', () => {
  it('adopts every track no group lists', () => {
    const missing = OrphanTrackGroups.missingFrom(
      [track('owned'), track('loose-1'), track('loose-2')],
      [group('group-1', ['owned'])],
    )

    expect(missing.map((adopted) => adopted.trackIds)).toEqual([['loose-1'], ['loose-2']])
  })

  it('leaves an already owned track alone', () => {
    expect(OrphanTrackGroups.missingFrom([track('owned')], [group('group-1', ['owned'])])).toEqual([])
  })

  it('reads a group that names no tracks at all', () => {
    const nameless = { centerLine: [], id: 'empty' } as unknown as TrackGroup

    expect(OrphanTrackGroups.missingFrom([track('loose')], [nameless])).toHaveLength(1)
  })

  it('carries the type and track type of the track it adopts', () => {
    const [adopted] = OrphanTrackGroups.missingFrom([track('loose')], [])

    expect(adopted.type).toBe('scissors-crossover')
    expect(adopted.trackType).toBe('heavy-metro')
    expect(adopted.centerLine).toEqual([[0, 0], [1, 1]])
  })
})
