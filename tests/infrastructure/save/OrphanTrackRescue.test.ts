import type { Mock } from 'vitest'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SaveFile } from '@/shared/game/SaveFile'
import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

import { OrphanTrackRescue } from '@/infrastructure/save/OrphanTrackRescue'

import type { FakeGameStore } from '../fakeGameStore'

import { createFakeGameStore } from '../fakeGameStore'

const OWNED: Track = { coords: [[0, 0], [1, 1]], id: 'owned' }
const LOOSE: Track = { coords: [[2, 2], [3, 3]], id: 'loose', type: 'scissors-crossover' }
const GROUP: TrackGroup = { centerLine: [[0, 0], [1, 1]], id: 'group-1', trackIds: ['owned'] }

function saveWith(tracks: Track[], groups: TrackGroup[]): SaveFile {
  return { data: { trackGroups: groups, tracks } }
}

describe('OrphanTrackRescue', () => {
  let fake: FakeGameStore
  let loadSave: Mock<(save: SaveFile) => unknown>

  beforeEach(() => {
    loadSave = vi.fn<(save: SaveFile) => unknown>()
    fake = createFakeGameStore({ loadSave })
    new OrphanTrackRescue(fake.store).install()
  })

  // The lines an older version of the mod built are still in the file; the load
  // only drops them because their crossovers belong to no group.
  it('gives the loose tracks a group before the game reads the save', () => {
    const save = saveWith([OWNED, LOOSE], [GROUP])
    fake.state.loadSave?.(save)

    expect(save.data?.trackGroups?.map((group) => group.trackIds)).toEqual([['owned'], ['loose']])
  })

  it('hands the repaired save straight on to the game', () => {
    const save = saveWith([OWNED, LOOSE], [GROUP])
    fake.state.loadSave?.(save)

    expect(loadSave).toHaveBeenCalledWith(save)
  })

  it('adds nothing to a save whose tracks all have a group', () => {
    const save = saveWith([OWNED], [GROUP])
    fake.state.loadSave?.(save)

    expect(save.data?.trackGroups).toEqual([GROUP])
  })

  it('passes a save it cannot read through untouched', () => {
    const save: SaveFile = {}
    fake.state.loadSave?.(save)

    expect(save).toEqual({})
    expect(loadSave).toHaveBeenCalledWith(save)
  })

  it('passes a save that keeps no track groups through untouched', () => {
    const save: SaveFile = { data: { tracks: [LOOSE] } }
    fake.state.loadSave?.(save)

    expect(save.data?.trackGroups).toBeUndefined()
  })

  // The bundle is re-injected during development, and the panel re-registers on
  // every lifecycle hook: wrapping the wrapper would repeat the whole pass.
  it('wraps the game\'s loadSave only once', () => {
    const wrapped = fake.state.loadSave
    new OrphanTrackRescue(fake.store).install()

    expect(fake.state.loadSave).toBe(wrapped)
  })

  it('leaves a game version that loads no saves alone', () => {
    const bare = createFakeGameStore()
    new OrphanTrackRescue(bare.store).install()

    expect(bare.state.loadSave).toBeUndefined()
  })
})
