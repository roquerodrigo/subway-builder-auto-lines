import { describe, expect, it } from 'vitest'

import type { NewLineBranch, NewLineCorridor } from '@/domain/newline/NewLinePlanner'

import { NewLinePlanner } from '@/domain/newline/NewLinePlanner'

import { type NetworkFixture, networkOf, type NetworkSpec, point } from './support/network'

const STRAIGHT: NetworkSpec = {
  links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
  stations: [
    { at: point(0, 0), id: 'a', name: 'A' },
    { at: point(1, 0), id: 'b', name: 'B' },
    { at: point(2, 0), id: 'c', name: 'C' },
  ],
}

// A corridor whose ends are both junctions: b and c each open onto two more
// destinations, so each end is a fork the user resolves.
const FORKED_AT_BOTH_ENDS: NetworkSpec = {
  links: [
    { between: ['b', 'x'] }, { between: ['x', 'y'] }, { between: ['y', 'c'] },
    { between: ['b', 'f'] }, { between: ['b', 'g'] },
    { between: ['c', 'd'] }, { between: ['c', 'e'] },
  ],
  stations: [
    { at: point(1, 0), id: 'b', name: 'B' },
    { at: point(2, 0), id: 'x', name: 'X' },
    { at: point(3, 0), id: 'y', name: 'Y' },
    { at: point(4, 0), id: 'c', name: 'C' },
    { at: point(0, 1), id: 'f', name: 'F' },
    { at: point(0, -1), id: 'g', name: 'G' },
    { at: point(5, 1), id: 'd', name: 'D' },
    { at: point(5, -1), id: 'e', name: 'E' },
  ],
}

// Same corridor, but h leaves the junction at b on the very bearing the corridor
// arrives on: a line running into it would double back over itself, so only f is
// a real continuation.
const FOLD_BACK_AT_START: NetworkSpec = {
  links: [
    { between: ['b', 'x'] }, { between: ['x', 'y'] }, { between: ['y', 'c'] },
    { between: ['b', 'f'] }, { between: ['b', 'h'] },
    { between: ['c', 'd'] }, { between: ['c', 'e'] },
  ],
  stations: [
    { at: point(1, 0), id: 'b', name: 'B' },
    { at: point(2, 0), id: 'x', name: 'X' },
    { at: point(3, 0), id: 'y', name: 'Y' },
    { at: point(4, 0), id: 'c', name: 'C' },
    { at: point(0, 1), id: 'f', name: 'F' },
    { at: point(1.5, 1), id: 'h', name: 'H' },
    { at: point(5, 1), id: 'd', name: 'D' },
    { at: point(5, -1), id: 'e', name: 'E' },
  ],
}

const FOLD_BACK_IDS = ['b', 'x', 'y', 'c', 'f', 'h', 'd', 'e']

// A fork at c whose d arm runs on through a station of its own: the branch has to
// be followed past d to the real terminus d2.
const DEEP_FORK: NetworkSpec = {
  links: [
    { between: ['a', 'b'] }, { between: ['b', 'c'] },
    { between: ['c', 'd'] }, { between: ['d', 'd2'] }, { between: ['c', 'e'] },
  ],
  stations: [
    { at: point(0, 0), id: 'a', name: 'A' },
    { at: point(1, 0), id: 'b', name: 'B' },
    { at: point(2, 0), id: 'c', name: 'C' },
    { at: point(3, 1), id: 'd', name: 'D' },
    { at: point(4, 2), id: 'd2', name: 'D2' },
    { at: point(3, -1), id: 'e', name: 'E' },
  ],
}

// The same fork, but d2 now sits back toward the corridor, so the rails out of d
// double back: the branch has to stop at d rather than run on into the fold.
const DEEP_FORK_THAT_FOLDS: NetworkSpec = {
  ...DEEP_FORK,
  stations: (DEEP_FORK.stations ?? []).map((station) =>
    station.id === 'd2' ? { ...station, at: point(2.2, 1.5) } : station),
}

const DEEP_FORK_IDS = ['a', 'b', 'c', 'd', 'd2', 'e']

const FORKED_IDS = ['b', 'x', 'y', 'c', 'f', 'g', 'd', 'e']

function corridorOf(fixture: NetworkFixture, stationIds: string[]): NewLineCorridor {
  return NewLinePlanner.corridor(fixture.network, fixture.index, stationIds)
}

function branch(overrides: Partial<NewLineBranch> = {}): NewLineBranch {
  return { key: 'z', name: 'Z', stationIds: ['z'], ...overrides }
}

describe('NewLinePlanner.addStationNodeIds', () => {
  it('adds nothing for a path with no hop in it', () => {
    const { index, network } = networkOf(STRAIGHT)
    expect(NewLinePlanner.addStationNodeIds(network, index, [])).toEqual([])
    expect(NewLinePlanner.addStationNodeIds(network, index, ['a'])).toEqual([])
  })

  it('bootstraps a two-station line from the platforms that actually face each other', () => {
    const { index, network } = networkOf(STRAIGHT)
    expect(NewLinePlanner.addStationNodeIds(network, index, ['a', 'b'])).toEqual(['a#1', 'b#1'])
  })

  // Middles get both platforms; the two ends get only the platform facing in.
  // Giving the far end its second platform closes the loop a second way, and the
  // game then lists that station three times — a corrupt route.
  it('gives middles both platforms and leaves both ends single-platform', () => {
    const { index, network } = networkOf(STRAIGHT)
    expect(NewLinePlanner.addStationNodeIds(network, index, ['a', 'b', 'c'])).toEqual(['a#1', 'b#1', 'b#2', 'c#1'])
  })

  it('names each station node exactly once', () => {
    const { index, network } = networkOf(STRAIGHT)
    const ids = NewLinePlanner.addStationNodeIds(network, index, ['a', 'b', 'c'])
    expect(ids).toHaveLength(new Set(ids).size)
  })

  it('adds nothing for two stations that share no tracks', () => {
    const { index, network } = networkOf({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(9, 9), id: 'z' }],
    })
    expect(NewLinePlanner.addStationNodeIds(network, index, ['a', 'z'])).toEqual([])
  })

  it('adds nothing where the path names a station the state no longer holds', () => {
    const { index, network } = networkOf(STRAIGHT)
    expect(NewLinePlanner.addStationNodeIds(network, index, ['ghost', 'b'])).toEqual([])
    expect(NewLinePlanner.addStationNodeIds(network, index, ['a', 'ghost', 'c'])).toEqual([])
  })

  it('still builds what it can when the first hop of the path is not a real one', () => {
    const { index, network } = networkOf({
      links: [{ between: ['b', 'c'] }],
      stations: [{ at: point(9, 9), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(2, 0), id: 'c' }],
    })
    expect(NewLinePlanner.addStationNodeIds(network, index, ['a', 'b', 'c'])).toEqual(['b#1', 'b#2', 'c#1'])
  })
})

describe('NewLinePlanner.corridor', () => {
  it('runs the whole of a straight group', () => {
    expect(corridorOf(networkOf(STRAIGHT), ['a', 'b', 'c'])).toEqual({ forks: [], path: ['a', 'b', 'c'] })
  })

  it('has no corridor and no fork in a lone station', () => {
    const fixture = networkOf({ stations: [{ at: point(0, 0), id: 'a' }] })
    expect(corridorOf(fixture, ['a'])).toEqual({ forks: [], path: [] })
  })

  it('offers no fork at an end where the tracks simply run out', () => {
    expect(corridorOf(networkOf(STRAIGHT), ['a', 'b', 'c']).forks).toEqual([])
  })

  it('raises a fork at each end of the corridor that is a junction', () => {
    const corridor = corridorOf(networkOf(FORKED_AT_BOTH_ENDS), FORKED_IDS)
    expect(corridor.path).toEqual(['b', 'x', 'y', 'c'])
    expect(corridor.forks.map((fork) => [fork.atStationId, fork.end])).toEqual([['b', 'start'], ['c', 'end']])
  })

  it('names each fork branch after the terminus it ends at', () => {
    const corridor = corridorOf(networkOf(FORKED_AT_BOTH_ENDS), FORKED_IDS)
    expect(corridor.forks[0].atName).toBe('B')
    expect(corridor.forks[0].options).toEqual([
      { key: 'f', name: 'F', stationIds: ['f'] },
      { key: 'g', name: 'G', stationIds: ['g'] },
    ])
    expect(corridor.forks[1].options.map((option) => option.key)).toEqual(['d', 'e'])
  })

  // Only a real bifurcation is worth asking about; a single way on is just more
  // corridor. Here h folds back, so f is the lone continuation at that end.
  it('folds a lone continuation straight into the corridor instead of asking', () => {
    const corridor = corridorOf(networkOf(FOLD_BACK_AT_START), FOLD_BACK_IDS)
    expect(corridor.path).toEqual(['f', 'b', 'x', 'y', 'c'])
    expect(corridor.forks.map((fork) => fork.atStationId)).toEqual(['c'])
  })

  it('drops a branch that would fold the line back at the junction', () => {
    const corridor = corridorOf(networkOf(FOLD_BACK_AT_START), FOLD_BACK_IDS)
    expect(corridor.path).not.toContain('h')
    expect(corridor.forks.flatMap((fork) => fork.options.map((option) => option.key))).not.toContain('h')
  })

  // The user picks a destination, not a hop, so a branch runs past its own
  // through-stops to the end of the tracks.
  it('follows a fork branch through its own stops to the far terminus', () => {
    const corridor = corridorOf(networkOf(DEEP_FORK), DEEP_FORK_IDS)
    expect(corridor.path).toEqual(['a', 'b', 'c'])
    expect(corridor.forks[0].options).toEqual([
      { key: 'e', name: 'E', stationIds: ['e'] },
      { key: 'd2', name: 'D2', stationIds: ['d', 'd2'] },
    ])
  })

  // The fold is one hop into the branch rather than at the junction: the rails
  // out of d turn back toward the corridor, so the branch ends at d.
  it('ends a fork branch where it would double back on itself', () => {
    const corridor = corridorOf(networkOf(DEEP_FORK_THAT_FOLDS), DEEP_FORK_IDS)
    expect(corridor.forks[0].options.map((option) => option.stationIds)).toEqual([['d'], ['e']])
  })

  it('ignores a chord whose rail would fold the corridor back over a triangle', () => {
    const fixture = networkOf({
      links: [
        { between: ['a', 'b'] },
        { between: ['b', 'c'] },
        { between: ['a', 'c'], shape: [point(1, 1.5)] },
      ],
      stations: [
        { at: point(0, 0), id: 'a', name: 'A' },
        { at: point(1, 0), id: 'b', name: 'B' },
        { at: point(2, 0), id: 'c', name: 'C' },
      ],
    })
    expect(corridorOf(fixture, ['a', 'b', 'c'])).toEqual({ forks: [], path: ['a', 'b', 'c'] })
  })
})

describe('NewLinePlanner.effectivePath', () => {
  const corridor: NewLineCorridor = {
    forks: [
      { atName: 'B', atStationId: 'b', end: 'start', options: [branch({ key: 'f', stationIds: ['f'] })] },
      { atName: 'C', atStationId: 'c', end: 'end', options: [branch({ key: 'd', stationIds: ['d'] })] },
    ],
    path: ['b', 'x', 'y', 'c'],
  }

  it('is the base corridor while the user has chosen nothing', () => {
    expect(NewLinePlanner.effectivePath(corridor, {})).toEqual(['b', 'x', 'y', 'c'])
  })

  it('appends a branch chosen at the end of the corridor', () => {
    const choices = { c: branch({ stationIds: ['d', 'd2'] }) }
    expect(NewLinePlanner.effectivePath(corridor, choices)).toEqual(['b', 'x', 'y', 'c', 'd', 'd2'])
  })

  // Reversed at the start so the branch's far terminus stays the outermost stop,
  // rather than the line running out and back in.
  it('prepends a branch chosen at the start, far terminus outermost', () => {
    const choices = { b: branch({ stationIds: ['f', 'f2'] }) }
    expect(NewLinePlanner.effectivePath(corridor, choices)).toEqual(['f2', 'f', 'b', 'x', 'y', 'c'])
  })

  it('attaches a branch at each end at once', () => {
    const choices = { b: branch({ stationIds: ['f'] }), c: branch({ stationIds: ['d'] }) }
    expect(NewLinePlanner.effectivePath(corridor, choices)).toEqual(['f', 'b', 'x', 'y', 'c', 'd'])
  })

  it('ignores a fork the user has left unresolved', () => {
    const choices = { b: null, c: undefined }
    expect(NewLinePlanner.effectivePath(corridor, choices)).toEqual(['b', 'x', 'y', 'c'])
  })

  it('ignores a choice made at a station that is not a fork', () => {
    expect(NewLinePlanner.effectivePath(corridor, { x: branch() })).toEqual(['b', 'x', 'y', 'c'])
  })

  it('never lists a station twice, even if a branch loops back into the corridor', () => {
    const choices = { c: branch({ stationIds: ['d', 'b'] }) }
    expect(NewLinePlanner.effectivePath(corridor, choices)).toEqual(['b', 'x', 'y', 'c', 'd'])
  })

  it('does not touch the corridor it was handed', () => {
    NewLinePlanner.effectivePath(corridor, { b: branch({ stationIds: ['f'] }) })
    expect(corridor.path).toEqual(['b', 'x', 'y', 'c'])
  })

  it('runs the line out to the terminus of a branch chosen at a deep fork', () => {
    const fixture = networkOf(DEEP_FORK)
    const real = corridorOf(fixture, DEEP_FORK_IDS)
    const toD2 = real.forks[0].options.find((option) => option.key === 'd2')
    expect(NewLinePlanner.effectivePath(real, { c: toD2 })).toEqual(['a', 'b', 'c', 'd', 'd2'])
  })

  it('carries the chosen branches through to the real corridor of a forked group', () => {
    const fixture = networkOf(FORKED_AT_BOTH_ENDS)
    const real = corridorOf(fixture, FORKED_IDS)
    const choices = { b: real.forks[0].options[0], c: real.forks[1].options[0] }
    expect(NewLinePlanner.effectivePath(real, choices)).toEqual(['f', 'b', 'x', 'y', 'c', 'd'])
  })
})
