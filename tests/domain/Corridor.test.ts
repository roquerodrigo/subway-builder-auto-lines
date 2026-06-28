import { describe, expect, it } from 'vitest'

import { Corridor } from '@/domain/line/Corridor'

import { networkOf, point } from './support/network'

function adjacencyOf(links: [string, string][]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  const link = (from: string, to: string): void => {
    const neighbors = adjacency.get(from) ?? new Set<string>()
    neighbors.add(to)
    adjacency.set(from, neighbors)
  }
  for (const [from, to] of links) {
    link(from, to)
    link(to, from)
  }
  return adjacency
}

describe('Corridor.longest', () => {
  it('has no corridor to run through an empty group', () => {
    expect(Corridor.longest([], new Map())).toEqual([])
  })

  it('has no corridor to run through a lone station', () => {
    expect(Corridor.longest(['a'], adjacencyOf([]))).toEqual([])
  })

  it('runs the length of a straight chain', () => {
    const chain: [string, string][] = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']]
    expect(Corridor.longest(['a', 'b', 'c', 'd', 'e'], adjacencyOf(chain))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('runs both stations of a single hop', () => {
    expect(Corridor.longest(['a', 'b'], adjacencyOf([['a', 'b']]))).toEqual(['a', 'b'])
  })

  it('picks the longer of two separate chains', () => {
    const links: [string, string][] = [['a', 'b'], ['c', 'd'], ['d', 'e'], ['e', 'f']]
    expect(Corridor.longest(['a', 'b', 'c', 'd', 'e', 'f'], adjacencyOf(links))).toEqual(['c', 'd', 'e', 'f'])
  })

  // A line terminates at a junction rather than picking an arm to barrel through;
  // choosing an arm is the fork the user resolves later.
  it('stops at a bifurcation instead of running through it', () => {
    const links: [string, string][] = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['c', 'e']]
    expect(Corridor.longest(['a', 'b', 'c', 'd', 'e'], adjacencyOf(links))).toEqual(['a', 'b', 'c'])
  })

  it('covers every station of a closed loop, which has no endpoint to start from', () => {
    const loop: [string, string][] = [['a', 'b'], ['b', 'c'], ['c', 'a']]
    const corridor = Corridor.longest(['a', 'b', 'c'], adjacencyOf(loop))
    expect(corridor.slice().sort()).toEqual(['a', 'b', 'c'])
    expect(corridor[0]).toBe('a')
  })

  it('breaks a long loop open at the first station of the group', () => {
    const loop: [string, string][] = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']]
    expect(Corridor.longest(['a', 'b', 'c', 'd'], adjacencyOf(loop))).toHaveLength(4)
  })

  it('takes only the loop the first station sits on when the group holds two', () => {
    const loops: [string, string][] = [
      ['a', 'b'], ['b', 'c'], ['c', 'a'],
      ['x', 'y'], ['y', 'z'], ['z', 'x'],
    ]
    const corridor = Corridor.longest(['a', 'b', 'c', 'x', 'y', 'z'], adjacencyOf(loops))
    expect(corridor.slice().sort()).toEqual(['a', 'b', 'c'])
  })

  it('falls back to the first station when the group has no links at all', () => {
    expect(Corridor.longest(['a', 'b'], adjacencyOf([]))).toEqual(['a'])
  })

  it('treats a station missing from the adjacency as having no neighbors', () => {
    expect(Corridor.longest(['a', 'b'], new Map())).toEqual(['a'])
  })

  // Adjacency comes from the live rails, which the group is only a slice of, so
  // the walk has to stop rather than chase a station it was never handed.
  it('stops where the adjacency names a station the group does not hold', () => {
    const reachingOutward = new Map([['a', new Set(['b', 'x'])]])
    expect(Corridor.longest(['a', 'b'], reachingOutward)).toEqual(['a', 'x'])
  })
})

describe('Corridor.order', () => {
  it('has nothing to order in an empty line', () => {
    const { network } = networkOf({ stations: [{ at: point(0, 0), id: 'a' }] })
    expect(Corridor.order(network, new Set())).toEqual([])
  })

  // Starts at a terminus, not at whichever station the caller happened to list
  // first: starting from a through-stop would order the line outward from the
  // middle and leave the two halves back to back.
  it('orders a straight line from one of its termini', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(2, 0), id: 'c' }],
    })
    const middleFirst = ['b', 'a', 'c']
    expect(Corridor.order(network, new Set(middleFirst))).toEqual(['a', 'b', 'c'])
  })

  // A line can branch, so this is a full traversal — not a single corridor.
  it('covers every station of a branching line exactly once', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }, { between: ['b', 'd'] }],
      stations: [
        { at: point(0, 0), id: 'a' },
        { at: point(1, 0), id: 'b' },
        { at: point(2, 1), id: 'c' },
        { at: point(2, -1), id: 'd' },
      ],
    })
    const order = Corridor.order(network, new Set(['a', 'b', 'c', 'd']))
    expect(order.slice().sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(order[0]).toBe('a')
  })

  it('covers a closed loop, which has no terminus to start from', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }, { between: ['c', 'a'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(0.5, 1), id: 'c' }],
    })
    expect(Corridor.order(network, new Set(['a', 'b', 'c'])).slice().sort()).toEqual(['a', 'b', 'c'])
  })

  it('picks up a disconnected station the walk could never reach', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(9, 9), id: 'z' }],
    })
    expect(Corridor.order(network, new Set(['a', 'b', 'z'])).slice().sort()).toEqual(['a', 'b', 'z'])
  })

  it('ignores neighbors the line does not serve', () => {
    const { network } = networkOf({
      links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
      stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }, { at: point(2, 0), id: 'c' }],
    })
    expect(Corridor.order(network, new Set(['a', 'b']))).toEqual(['a', 'b'])
  })
})
