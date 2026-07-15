import { describe, expect, it } from 'vitest'

import type { Coordinate } from '@/shared/game/Coordinate'
import type { Track, TrackGraph } from '@/shared/game/Track'

import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'

import { buildNetwork, networkOf, type NetworkSpec, point } from './support/network'

const LINE: NetworkSpec = {
  links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
  stations: [
    { at: point(0, 0), id: 'a' },
    { at: point(1, 0), id: 'b' },
    { at: point(2, 0), id: 'c' },
  ],
}

// a and c are one hop apart, but their rail arcs so far off the straight line that
// following it would fold a corridor back over itself (see MAX_DETOUR_RATIO).
const TRIANGLE_WITH_CHORD: NetworkSpec = {
  links: [
    { between: ['a', 'b'] },
    { between: ['b', 'c'] },
    { between: ['a', 'c'], shape: [point(1, 1.5)] },
  ],
  stations: [
    { at: point(0, 0), id: 'a' },
    { at: point(1, 0), id: 'b' },
    { at: point(2, 0), id: 'c' },
  ],
}

describe('TrackNetwork.distance', () => {
  it('is zero between a coordinate and itself', () => {
    expect(TrackNetwork.distance([-46.63, -23.55], [-46.63, -23.55])).toBe(0)
  })

  it('scales longitude and latitude by their own metres per degree', () => {
    expect(TrackNetwork.distance([0, 0], [1, 0])).toBeCloseTo(102_000, 0)
    expect(TrackNetwork.distance([0, 0], [0, 1])).toBeCloseTo(111_000, 0)
  })

  it('composes the two axes as a right triangle', () => {
    expect(TrackNetwork.distance([0, 0], [1, 1])).toBeCloseTo(Math.hypot(102_000, 111_000), 0)
  })

  it('is symmetric', () => {
    expect(TrackNetwork.distance([3, 4], [-1, 2])).toBe(TrackNetwork.distance([-1, 2], [3, 4]))
  })
})

describe('TrackNetwork.adjacentStationNodeIds', () => {
  it('finds the platform facing each track-adjacent station', () => {
    const { network } = networkOf(LINE)
    expect(network.adjacentStationNodeIds('b#1').sort()).toEqual(['a#1', 'c#1'])
  })

  it('stops at the first station on each branch', () => {
    const { network } = networkOf(LINE)
    expect(network.adjacentStationNodeIds('a#1')).toEqual(['b#1'])
  })

  it('never reports the platform it started from', () => {
    const { network } = networkOf(LINE)
    expect(network.adjacentStationNodeIds('a#1')).not.toContain('a#1')
  })

  it('reports the sibling platform once a crossover joins them', () => {
    const { network } = networkOf({ ...LINE, crossovers: ['a'] })
    expect(network.adjacentStationNodeIds('a#1').sort()).toEqual(['a#2', 'b#1'])
  })

  it('walks through plain track junctions to reach the next station', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'], junctions: [point(0.3, 1), point(0.7, 1)] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
    })
    expect(network.adjacentStationNodeIds('a#1')).toEqual(['b#1'])
  })

  it('returns nothing for a platform the index has never seen', () => {
    const { network } = networkOf(LINE)
    expect(network.adjacentStationNodeIds('nowhere#1')).toEqual([])
  })

  it('returns nothing when the state carries no track graph', () => {
    const state = buildNetwork(LINE)
    const network = new TrackNetwork({ ...state, trackGraph: undefined }, StationIndex.build(state))
    expect(network.adjacentStationNodeIds('a#1')).toEqual([])
  })

  it('returns nothing when the track graph is not a live map', () => {
    const state = buildNetwork(LINE)
    const graph = { has: (): boolean => false } as unknown as TrackGraph
    const network = new TrackNetwork({ ...state, trackGraph: graph }, StationIndex.build(state))
    expect(network.adjacentStationNodeIds('a#1')).toEqual([])
  })

  it('returns nothing for an isolated station', () => {
    const { network } = networkOf({ stations: [{ at: point(0, 0), id: 'a' }] })
    expect(network.adjacentStationNodeIds('a#1')).toEqual([])
  })
})

describe('TrackNetwork.neighborStationNodes', () => {
  it('maps each neighbor station to the platform facing this one', () => {
    const { network } = networkOf(LINE)
    expect([...network.neighborStationNodes('b')]).toEqual([['a', 'a#1'], ['c', 'c#1']])
  })

  it('never reports the station itself, even across its own crossover', () => {
    const { network } = networkOf({ ...LINE, crossovers: ['a'] })
    expect([...network.neighborStationNodes('a').keys()]).toEqual(['b'])
  })

  // Both platforms of a station reach the same neighbor; the map keeps one entry.
  it('keeps a single facing platform per neighbor', () => {
    const { network } = networkOf(LINE)
    expect(network.neighborStationNodes('a')).toEqual(new Map([['b', 'b#1']]))
  })

  it('is empty for a station the index has never seen', () => {
    const { network } = networkOf(LINE)
    expect(network.neighborStationNodes('nowhere').size).toBe(0)
  })

  it('ignores a platform whose station is missing from the state', () => {
    const state = buildNetwork(LINE)
    const trimmed = { ...state, stations: (state.stations ?? []).filter((s) => s.id !== 'b') }
    const network = new TrackNetwork(trimmed, StationIndex.build(trimmed))
    expect(network.neighborStationNodes('a').size).toBe(0)
  })
})

describe('TrackNetwork.neighborStationsWithin', () => {
  it('keeps only the neighbors inside the given set', () => {
    const { network } = networkOf(LINE)
    expect(network.neighborStationsWithin('b', new Set(['a']))).toEqual(new Set(['a']))
  })

  it('is empty when the set excludes every neighbor', () => {
    const { network } = networkOf(LINE)
    expect(network.neighborStationsWithin('b', new Set()).size).toBe(0)
  })
})

describe('TrackNetwork.directNeighborsWithin', () => {
  it('drops a neighbor only reachable by a fold-back detour', () => {
    const { network } = networkOf(TRIANGLE_WITH_CHORD)
    const group = new Set(['a', 'b', 'c'])
    expect(network.neighborStationsWithin('a', group)).toEqual(new Set(['b', 'c']))
    expect(network.directNeighborsWithin('a', group)).toEqual(new Set(['b']))
  })

  it('keeps every neighbor whose rail runs roughly straight', () => {
    const { network } = networkOf(LINE)
    expect(network.directNeighborsWithin('b', new Set(['a', 'b', 'c']))).toEqual(new Set(['a', 'c']))
  })
})

describe('TrackNetwork.isDetour', () => {
  it('is false for a straight rail', () => {
    const { network } = networkOf(LINE)
    expect(network.isDetour('a', 'b')).toBe(false)
  })

  it('is false for a gentle curve', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'c'], shape: [point(1, 1)] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(2, 0), id: 'c' }],
    })
    expect(network.isDetour('a', 'c')).toBe(false)
  })

  it('is true for a rail that arcs far off the straight line', () => {
    const { network } = networkOf(TRIANGLE_WITH_CHORD)
    expect(network.isDetour('a', 'c')).toBe(true)
  })

  it('is symmetric', () => {
    const { network } = networkOf(TRIANGLE_WITH_CHORD)
    expect(network.isDetour('c', 'a')).toBe(true)
  })

  it('is false when there is no rail between the two stations', () => {
    const { network } = networkOf(LINE)
    expect(network.isDetour('a', 'c')).toBe(false)
  })

  it('is false when the graph links two stations no track backs', () => {
    expect(trackless().isDetour('a', 'b')).toBe(false)
  })
})

describe('TrackNetwork.railBetween', () => {
  it('returns the real track geometry, curves included', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'], shape: [point(0.5, 1)] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
    })
    const rail = network.railBetween('a', 'b')
    expect(rail).toHaveLength(3)
    expect(rail?.[1][0]).toBeCloseTo(point(0.5, 1)[0], 10)
  })

  it('threads through the plain track nodes between two stations', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'], junctions: [point(0.3, 1), point(0.7, 1)] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
    })
    expect(network.railBetween('a', 'b')).toHaveLength(4)
  })

  // Asymmetry here would let a hop dodge the detour test in one direction only.
  it('is the same rail in both directions', () => {
    const { network } = networkOf(TRIANGLE_WITH_CHORD)
    const forward = network.railBetween('a', 'c')
    const backward = network.railBetween('c', 'a')
    expect(backward).toEqual(forward?.slice().reverse())
  })

  it('is null when the state carries no track graph', () => {
    const state = buildNetwork(LINE)
    const network = new TrackNetwork({ ...state, trackGraph: undefined }, StationIndex.build(state))
    expect(network.railBetween('a', 'b')).toBeNull()
  })

  it('is null between two stations that share no tracks', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(9, 9), id: 'z' }],
    })
    expect(network.railBetween('a', 'z')).toBeNull()
  })

  // A corridor hop is station → plain track → station: routing one through another
  // station would quietly swallow a stop.
  it('is null between two stations that only connect through a third', () => {
    const { network } = networkOf(LINE)
    expect(network.railBetween('a', 'c')).toBeNull()
  })

  it('is null for a station the index has never seen', () => {
    const { network } = networkOf(LINE)
    expect(network.railBetween('a', 'nowhere')).toBeNull()
  })

  it('is null when the station it starts from touches no track at all', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(9, 9), id: 'z' }],
    })
    expect(network.railBetween('z', 'a')).toBeNull()
  })

  it('ignores a platform the state no longer places on the map', () => {
    const state = buildNetwork(LINE)
    const stations = (state.stations ?? []).map((station) =>
      station.id === 'a' ? { ...station, stNodeIds: [...(station.stNodeIds ?? []), 'a#gone'] } : station)
    const haunted = { ...state, stations }
    const network = new TrackNetwork(haunted, StationIndex.build(haunted))
    expect(network.railBetween('a', 'b')).toHaveLength(2)
  })

  it('is empty when the graph links two stations no track backs', () => {
    expect(trackless().railBetween('a', 'b')).toEqual([])
  })

  it('survives a state that carries no tracks at all', () => {
    const state = buildNetwork(LINE)
    const bare = { ...state, tracks: undefined as unknown as Track[] }
    const network = new TrackNetwork(bare, StationIndex.build(bare))
    expect(network.railBetween('a', 'b')).toEqual([])
  })

  it('ignores a track too short to have two ends', () => {
    const state = buildNetwork(LINE)
    const stubs = { ...state, tracks: state.tracks.map((track) => ({ ...track, coords: [track.coords[0]] })) }
    const network = new TrackNetwork(stubs, StationIndex.build(stubs))
    expect(network.railBetween('a', 'b')).toEqual([])
  })

  it('ignores a track carrying no coordinates', () => {
    const state = buildNetwork(LINE)
    const stubs = {
      ...state,
      tracks: state.tracks.map((track) => ({ ...track, coords: undefined as unknown as Coordinate[] })),
    }
    const network = new TrackNetwork(stubs, StationIndex.build(stubs))
    expect(network.railBetween('a', 'b')).toEqual([])
  })
})

describe('TrackNetwork.railPath', () => {
  it('joins each hop end to end without doubling the shared stop', () => {
    const { index, network } = networkOf(LINE)
    const path = network.railPath(['a', 'b', 'c'])
    expect(path).toEqual([
      index.stationNodeById.get('a#1')?.center,
      index.stationNodeById.get('b#1')?.center,
      index.stationNodeById.get('c#1')?.center,
    ])
  })

  it('is empty for a single station', () => {
    const { network } = networkOf(LINE)
    expect(network.railPath(['a'])).toEqual([])
  })

  it('is empty for no stations at all', () => {
    const { network } = networkOf(LINE)
    expect(network.railPath([])).toEqual([])
  })

  it('falls back to a straight hop between stations with no rail', () => {
    const { index, network } = networkOf({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(9, 9), id: 'z' }],
    })
    const path = network.railPath(['a', 'b', 'z'])
    expect(path.slice(-2)).toEqual([index.coordinate('b'), index.coordinate('z')])
  })

  it('skips a hop to a station it cannot place on the map', () => {
    const { network } = networkOf(LINE)
    expect(network.railPath(['a', 'nowhere'])).toEqual([])
  })
})

describe('TrackNetwork.outboundDirection', () => {
  it('is the unit vector the rails leave on', () => {
    const { network } = networkOf(LINE)
    const direction = network.outboundDirection('b', 'c')
    expect(direction?.[0]).toBeCloseTo(1, 6)
    expect(direction?.[1]).toBeCloseTo(0, 6)
    expect(Math.hypot(...(direction ?? [0, 0]))).toBeCloseTo(1, 10)
  })

  it('points the opposite way down the other side of the corridor', () => {
    const { network } = networkOf(LINE)
    expect(network.outboundDirection('b', 'a')?.[0]).toBeCloseTo(-1, 6)
  })

  // Sampling ~120 m in keeps a tiny first segment out of the platform from
  // deciding which way the whole hop runs.
  it('samples past a short first segment rather than trusting it', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'], shape: [[0, 0.0005], [0.002, 0.0005]] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(2, 0), id: 'b' }],
    })
    const direction = network.outboundDirection('a', 'b')
    expect(direction?.[0]).toBeCloseTo(0.965, 2)
    expect(direction?.[1]).toBeCloseTo(0.262, 2)
  })

  it('uses the whole rail when it is shorter than the sample distance', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: [0, 0], id: 'a' }, { at: [0.0004, 0], id: 'b' }],
    })
    expect(network.outboundDirection('a', 'b')?.[0]).toBeCloseTo(1, 6)
  })

  it('is null when there is no rail to sample', () => {
    const { network } = networkOf(LINE)
    expect(network.outboundDirection('a', 'c')).toBeNull()
  })

  it('is null when the graph links two stations no track backs', () => {
    expect(trackless().outboundDirection('a', 'b')).toBeNull()
  })
})

describe('TrackNetwork.bendsBack', () => {
  // Two rails leaving a junction on the same bearing: a line through them would
  // fold at the junction instead of running on.
  it('is true when both rails leave the junction on the same side', () => {
    const { network } = networkOf({
      links: [{ between: ['j', 'west'] }, { between: ['j', 'northwest'] }],
      stations: [
        { at: point(0, 0), id: 'j' },
        { at: point(-1, 0), id: 'west' },
        { at: point(-1, 1), id: 'northwest' },
      ],
    })
    expect(network.bendsBack('j', 'west', 'northwest')).toBe(true)
  })

  it('is false when the rails leave the junction on opposite sides', () => {
    const { network } = networkOf({
      links: [{ between: ['j', 'west'] }, { between: ['j', 'east'] }],
      stations: [
        { at: point(0, 0), id: 'j' },
        { at: point(-1, 0), id: 'west' },
        { at: point(1, 0), id: 'east' },
      ],
    })
    expect(network.bendsBack('j', 'west', 'east')).toBe(false)
  })

  it('is false when the rails leave at a right angle', () => {
    const { network } = networkOf({
      links: [{ between: ['j', 'west'] }, { between: ['j', 'north'] }],
      stations: [
        { at: point(0, 0), id: 'j' },
        { at: [-0.01, 0], id: 'west' },
        { at: [0, 0.01], id: 'north' },
      ],
    })
    expect(network.bendsBack('j', 'west', 'north')).toBe(false)
  })

  it('is false when either direction is unknown', () => {
    const { network } = networkOf(LINE)
    expect(network.bendsBack('b', 'nowhere', 'c')).toBe(false)
    expect(network.bendsBack('b', 'a', 'nowhere')).toBe(false)
  })
})

// A graph whose edges no track backs: the mod reads geometry from `tracks`, so a
// state where the two have drifted apart must degrade, not throw.
function trackless(): TrackNetwork {
  const state = buildNetwork(LINE)
  const bare = { ...state, tracks: [] }

  return new TrackNetwork(bare, StationIndex.build(bare))
}
