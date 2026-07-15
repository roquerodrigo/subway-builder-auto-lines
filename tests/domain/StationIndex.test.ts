import { describe, expect, it } from 'vitest'

import type { GameState } from '@/shared/game/GameState'

import { StationIndex } from '@/domain/network/StationIndex'

import { buildNetwork, coordinateKey, point } from './support/network'

const LINE: GameState = buildNetwork({
  links: [{ between: ['a', 'b'] }],
  stations: [{ at: point(0, 0), id: 'a', name: 'Sé' }, { at: point(1, 0), id: 'b', name: 'Luz' }],
})

describe('StationIndex.build', () => {
  it('indexes every station node by id and by coord key', () => {
    const index = StationIndex.build(LINE)
    const node = index.stationNodeById.get('a#1')
    expect(node?.id).toBe('a#1')
    expect(index.stationNodeByCoord.get(coordinateKey('prefixed')(node?.center ?? []))).toBe(node)
  })

  it('maps every station node back to the station that owns it', () => {
    const index = StationIndex.build(LINE)
    expect(index.stationOfNode.get('a#1')).toBe('a')
    expect(index.stationOfNode.get('a#2')).toBe('a')
    expect(index.stationOfNode.get('b#1')).toBe('b')
  })

  it('indexes every station by id', () => {
    expect(StationIndex.build(LINE).stationById.get('b')?.name).toBe('Luz')
  })

  // The format is detected once at build time and carried on the index, so nothing
  // downstream has to know which game version drew the graph.
  it('carries the coord-key format it detected off the live graph', () => {
    const dashed = buildNetwork({
      keyFormat: 'dashed',
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
    })
    expect(StationIndex.build(dashed).coordKey([1, 2])).toBe('1-2')
    expect(StationIndex.build(LINE).coordKey([1, 2])).toBe('S12')
  })

  it('builds an empty index from a state with no stations or station nodes', () => {
    const index = StationIndex.build({ money: 0, ownedTrainCount: 0, tracks: [] })
    expect(index.stationById.size).toBe(0)
    expect(index.stationNodeById.size).toBe(0)
    expect(index.stationNodeByCoord.size).toBe(0)
    expect(index.stationOfNode.size).toBe(0)
  })

  it('tolerates a station that lists no platform nodes', () => {
    const state: GameState = {
      money: 0,
      ownedTrainCount: 0,
      stations: [{ id: 'a', name: 'Sé' }],
      tracks: [],
    }
    const index = StationIndex.build(state)
    expect(index.stationById.get('a')?.name).toBe('Sé')
    expect(index.stationOfNode.size).toBe(0)
  })
})

describe('StationIndex.coordinate', () => {
  it('is the centroid of the station platforms', () => {
    const index = StationIndex.build(LINE)
    expect(index.coordinate('a')).toEqual(point(0, 0))
    expect(index.coordinate('b')).toEqual(point(1, 0))
  })

  it('is undefined for a station the index has never seen', () => {
    expect(StationIndex.build(LINE).coordinate('nowhere')).toBeUndefined()
  })

  it('is undefined for a station whose platforms are missing from the state', () => {
    const state: GameState = {
      money: 0,
      ownedTrainCount: 0,
      stations: [{ id: 'a', name: 'Sé', stNodeIds: ['gone#1'] }],
      tracks: [],
    }
    expect(StationIndex.build(state).coordinate('a')).toBeUndefined()
  })

  it('averages only the platforms it can resolve', () => {
    const state: GameState = {
      money: 0,
      ownedTrainCount: 0,
      stations: [{ id: 'a', name: 'Sé', stNodeIds: ['a#1', 'gone#2'] }],
      stNodes: [{ center: [4, 8], id: 'a#1' }],
      tracks: [],
    }
    expect(StationIndex.build(state).coordinate('a')).toEqual([4, 8])
  })
})

describe('StationIndex.name', () => {
  it('is the station display name', () => {
    expect(StationIndex.build(LINE).name('a')).toBe('Sé')
  })

  it('is a question mark for a station the index has never seen', () => {
    expect(StationIndex.build(LINE).name('nowhere')).toBe('?')
  })
})
