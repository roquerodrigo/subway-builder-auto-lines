import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TerminusCrossover } from '@/domain/crossover/TerminusCrossover'
import type { Track } from '@/shared/game/Track'
import type { TrackGroup } from '@/shared/game/TrackGroup'

import { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'

import type { FakeGameStore } from '../fakeGameStore'

import { createFakeGameStore } from '../fakeGameStore'

const EXISTING: Track = { coords: [[0, 0], [1, 1]], id: 'track-1' }
const EXISTING_GROUP: TrackGroup = { centerLine: [[0, 0], [1, 1]], id: 'group-1', trackIds: ['track-1'] }

function makeCrossover(id: string): TerminusCrossover {
  return { group: makeGroup(id), track: makeDiagonal(id) }
}

function makeDiagonal(id: string): Track {
  return { coords: [[0, 0], [1, 1]], id, interactable: false, reversable: true, type: 'scissors-crossover' }
}

function makeGroup(id: string): TrackGroup {
  return { centerLine: [[0, 0], [1, 1]], id: id + '-group', trackIds: [id], type: 'scissors-crossover' }
}

describe('CrossoverInjector', () => {
  let fake: FakeGameStore
  let injector: CrossoverInjector

  beforeEach(() => {
    fake = createFakeGameStore({ setTracks: vi.fn(), trackGroups: [EXISTING_GROUP], tracks: [EXISTING] })
    injector = new CrossoverInjector(fake.store)
  })

  it('appends the diagonals to the tracks the game already has', () => {
    expect(injector.inject([makeCrossover('diag-1')])).toBe(1)
    expect(fake.state.setTracks).toHaveBeenCalledWith(expect.objectContaining({
      newTracks: [EXISTING, makeDiagonal('diag-1')],
    }))
  })

  // Loading a save deletes every track no track group lists, then drops the routes
  // that ran over it — a diagonal injected on its own lasts one session.
  it('appends the group that owns each diagonal', () => {
    injector.inject([makeCrossover('diag-1'), makeCrossover('diag-2')])

    expect(fake.state.setTracks).toHaveBeenCalledWith(expect.objectContaining({
      newTrackGroups: [EXISTING_GROUP, makeGroup('diag-1'), makeGroup('diag-2')],
    }))
  })

  // setTracks regenerates the whole trackGraph; regenerating stations too would
  // hand out new station-node ids and break every route built on the old ones.
  it('keeps the station-node ids while the graph is rebuilt', () => {
    injector.inject([makeCrossover('diag-1')])

    expect(fake.state.setTracks).toHaveBeenCalledWith({
      newTrackGroups: [EXISTING_GROUP, makeGroup('diag-1')],
      newTracks: [EXISTING, makeDiagonal('diag-1')],
      regenRoutesWithTrackIDs: [],
      regenStations: false,
    })
  })

  // A game version that keeps no track groups gets none: a list built from nothing
  // would wipe the ones it does hold.
  it('names no groups where the game keeps none', () => {
    delete fake.state.trackGroups
    injector.inject([makeCrossover('diag-1')])

    expect(fake.state.setTracks).toHaveBeenCalledWith({
      newTracks: [EXISTING, makeDiagonal('diag-1')],
      regenRoutesWithTrackIDs: [],
      regenStations: false,
    })
  })

  // The factory returns null where the far ends are already linked, so a crossover
  // the game shipped (or the player's "Auto Crossover" setting placed) is skipped.
  it('drops the diagonals that turned out to be unnecessary', () => {
    expect(injector.inject([null, makeCrossover('diag-1'), null])).toBe(1)
    expect(fake.state.setTracks).toHaveBeenCalledWith(expect.objectContaining({
      newTracks: [EXISTING, makeDiagonal('diag-1')],
    }))
  })

  it('touches nothing when every terminus already has its crossover', () => {
    expect(injector.inject([null, null])).toBe(0)
    expect(fake.state.setTracks).not.toHaveBeenCalled()
  })

  it('touches nothing when there is nothing to inject', () => {
    expect(injector.inject([])).toBe(0)
    expect(fake.state.setTracks).not.toHaveBeenCalled()
  })

  it('injects nothing into a game version that cannot write tracks', () => {
    delete fake.state.setTracks

    expect(injector.inject([makeCrossover('diag-1')])).toBe(0)
  })
})
