import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Track } from '@/shared/game/Track'

import { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'

import type { FakeGameStore } from '../fakeGameStore'

import { createFakeGameStore } from '../fakeGameStore'

const EXISTING: Track = { id: 'track-1', coords: [[0, 0], [1, 1]] }

function makeDiagonal(id: string): Track {
  return { id, coords: [[0, 0], [1, 1]], type: 'scissors-crossover', reversable: true, interactable: false }
}

describe('CrossoverInjector', () => {
  let fake: FakeGameStore
  let injector: CrossoverInjector

  beforeEach(() => {
    fake = createFakeGameStore({ tracks: [EXISTING], setTracks: vi.fn() })
    injector = new CrossoverInjector(fake.store)
  })

  it('appends the diagonals to the tracks the game already has', () => {
    const diagonal = makeDiagonal('diag-1')

    expect(injector.inject([diagonal])).toBe(1)
    expect(fake.state.setTracks).toHaveBeenCalledWith(expect.objectContaining({
      newTracks: [EXISTING, diagonal],
    }))
  })

  // setTracks regenerates the whole trackGraph; regenerating stations too would
  // hand out new station-node ids and break every route built on the old ones.
  it('keeps the station-node ids while the graph is rebuilt', () => {
    injector.inject([makeDiagonal('diag-1')])

    expect(fake.state.setTracks).toHaveBeenCalledWith({
      newTracks: [EXISTING, makeDiagonal('diag-1')],
      regenStations: false,
      regenRoutesWithTrackIDs: [],
    })
  })

  // The factory returns null where the far ends are already linked, so a crossover
  // the game shipped (or the player's "Auto Crossover" setting placed) is skipped.
  it('drops the diagonals that turned out to be unnecessary', () => {
    const diagonal = makeDiagonal('diag-1')

    expect(injector.inject([null, diagonal, null])).toBe(1)
    expect(fake.state.setTracks).toHaveBeenCalledWith(expect.objectContaining({
      newTracks: [EXISTING, diagonal],
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

    expect(injector.inject([makeDiagonal('diag-1')])).toBe(0)
  })
})
