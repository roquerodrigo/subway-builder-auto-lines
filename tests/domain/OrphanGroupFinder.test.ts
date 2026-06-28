import { describe, expect, it } from 'vitest'

import { OrphanGroupFinder } from '@/domain/newline/OrphanGroupFinder'

import { buildNetwork, point } from './support/network'

describe('OrphanGroupFinder.find', () => {
  it('finds nothing in a city with no stations', () => {
    expect(OrphanGroupFinder.find({ money: 0, ownedTrainCount: 0, tracks: [] })).toEqual([])
  })

  it('finds nothing when every station already has a line', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }],
      stations: [
        { at: point(0, 0), id: 'a', routeIds: ['line-1'] },
        { at: point(1, 0), id: 'b', routeIds: ['line-1'] },
      ],
    })
    expect(OrphanGroupFinder.find(state)).toEqual([])
  })

  // A single unserved station is not a line; the group has to be worth running.
  it('ignores a lone unserved station', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }],
      stations: [
        { at: point(0, 0), id: 'a', routeIds: ['line-1'] },
        { at: point(1, 0), id: 'b', routeIds: ['line-1'] },
        { at: point(9, 9), id: 'z' },
      ],
    })
    expect(OrphanGroupFinder.find(state)).toEqual([])
  })

  it('groups unserved stations that are linked to each other', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
      stations: [
        { at: point(0, 0), id: 'a', name: 'Butantã' },
        { at: point(1, 0), id: 'b', name: 'Pinheiros' },
        { at: point(2, 0), id: 'c', name: 'Faria Lima' },
      ],
    })
    const [group] = OrphanGroupFinder.find(state)
    expect(group.stationIds.slice().sort()).toEqual(['a', 'b', 'c'])
    expect(group.names.slice().sort()).toEqual(['Butantã', 'Faria Lima', 'Pinheiros'])
  })

  it('treats a station with an empty route list as unserved', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a', routeIds: [] }, { at: point(1, 0), id: 'b', routeIds: [] }],
    })
    expect(OrphanGroupFinder.find(state)).toHaveLength(1)
  })

  it('names a group after the ends of the very corridor the preview will build', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
      stations: [
        { at: point(0, 0), id: 'a', name: 'Butantã' },
        { at: point(1, 0), id: 'b', name: 'Pinheiros' },
        { at: point(2, 0), id: 'c', name: 'Faria Lima' },
      ],
    })
    expect(OrphanGroupFinder.find(state)[0].terminalNames).toEqual(['Butantã', 'Faria Lima'])
  })

  // Pulling a served station into the group would hand the new line a stop that
  // already belongs to another one.
  it('never links two unserved groups through a station that already has a line', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'served'] }, { between: ['served', 'c'] }, { between: ['c', 'd'] }],
      stations: [
        { at: point(0, 0), id: 'a' },
        { at: point(1, 0), id: 'b' },
        { at: point(2, 0), id: 'served', routeIds: ['line-1'] },
        { at: point(3, 0), id: 'c' },
        { at: point(4, 0), id: 'd' },
      ],
    })
    const groups = OrphanGroupFinder.find(state)
    expect(groups).toHaveLength(2)
    expect(groups.flatMap((group) => group.stationIds)).not.toContain('served')
  })

  it('returns the largest group first', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'] }, { between: ['x', 'y'] }, { between: ['y', 'z'] }],
      stations: [
        { at: point(0, 0), id: 'a' },
        { at: point(1, 0), id: 'b' },
        { at: point(0, 9), id: 'x' },
        { at: point(1, 9), id: 'y' },
        { at: point(2, 9), id: 'z' },
      ],
    })
    expect(OrphanGroupFinder.find(state).map((group) => group.stationIds.length)).toEqual([3, 2])
  })

  // Only rail the corridor would actually run on can name the group, and the
  // detour between these two is not that — so the pair stays unlabelled.
  it('leaves a group unnamed when its only rail is a fold-back detour', () => {
    const state = buildNetwork({
      links: [{ between: ['a', 'b'], shape: [point(1, 1.5)] }],
      stations: [{ at: point(0, 0), id: 'a', name: 'Butantã' }, { at: point(2, 0), id: 'b', name: 'Pinheiros' }],
    })
    const [group] = OrphanGroupFinder.find(state)
    expect(group.stationIds.slice().sort()).toEqual(['a', 'b'])
    expect(group.terminalNames).toBeNull()
  })
})
