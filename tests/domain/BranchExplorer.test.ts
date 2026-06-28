import { describe, expect, it } from 'vitest'

import { BranchExplorer } from '@/domain/network/BranchExplorer'

// An undirected adjacency, the shape every caller feeds the explorer.
function graphOf(links: [string, string][]): (stationId: string) => Iterable<string> {
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
  return (stationId): Iterable<string> => adjacency.get(stationId) ?? new Set<string>()
}

function leafPaths(
  links: [string, string][],
  root: string,
  blocked: string[] = [],
  folds?: (prev: null | string, current: string, next: string) => boolean,
): string[][] {
  return BranchExplorer.leafPaths(root, graphOf(links), new Set(blocked), folds)
}

describe('BranchExplorer.leafPaths', () => {
  it('has no branch to offer at a station with no neighbors', () => {
    expect(leafPaths([], 'root')).toEqual([])
  })

  it('follows a plain chain all the way to its dead end', () => {
    expect(leafPaths([['root', 'a'], ['a', 'b'], ['b', 'c']], 'root')).toEqual([['a', 'b', 'c']])
  })

  it('excludes the root from every branch it returns', () => {
    const [branch] = leafPaths([['root', 'a'], ['a', 'b']], 'root')
    expect(branch).not.toContain('root')
  })

  it('splits a fork into one branch per end of the tracks', () => {
    const paths = leafPaths([['root', 'a'], ['a', 'b'], ['a', 'c'], ['c', 'd']], 'root')
    expect(paths).toEqual([['a', 'b'], ['a', 'c', 'd']])
  })

  it('never traverses a blocked station', () => {
    const paths = leafPaths([['root', 'a'], ['a', 'b'], ['b', 'c']], 'root', ['b'])
    expect(paths).toEqual([['a']])
  })

  it('offers nothing when every neighbor of the root is blocked', () => {
    expect(leafPaths([['root', 'a'], ['root', 'b']], 'root', ['a', 'b'])).toEqual([])
  })

  // A triangle is two destinations, not one loop: each arm gets its own branch,
  // and neither runs back through the other.
  it('divides a triangle into its two distinct arms', () => {
    expect(leafPaths([['root', 'a'], ['root', 'b'], ['a', 'b']], 'root')).toEqual([['a'], ['b']])
  })

  // The nearer arm claimed the merge point, so the other arm ends at the merge
  // itself rather than duplicating the stations past it.
  it('ends an arm at a merge point another arm already claimed', () => {
    const paths = leafPaths([['root', 'a'], ['root', 'b'], ['a', 'c'], ['b', 'c']], 'root')
    expect(paths).toEqual([['b'], ['a', 'c']])
  })

  it('gives every station exactly one branch across the whole spanning tree', () => {
    const paths = leafPaths([['root', 'a'], ['root', 'b'], ['a', 'c'], ['b', 'c'], ['c', 'd']], 'root')
    const visited = paths.flat()
    expect(visited.slice().sort()).toEqual([...new Set(visited)].sort())
  })

  it('never walks back into the root, even around a loop', () => {
    const paths = leafPaths([['root', 'a'], ['a', 'b'], ['b', 'root']], 'root')
    expect(paths.flat()).not.toContain('root')
  })

  it('prunes a step the caller says would fold the branch back', () => {
    const paths = leafPaths(
      [['root', 'a'], ['root', 'b']],
      'root',
      [],
      (_prev, _current, next) => next === 'b',
    )
    expect(paths).toEqual([['a']])
  })

  // At the root there is nothing behind us yet, so the fold test is told so
  // explicitly rather than being handed the root itself.
  it('reports no previous station when testing a step out of the root', () => {
    const seen: [null | string, string, string][] = []
    leafPaths([['root', 'a'], ['a', 'b']], 'root', [], (prev, current, next) => {
      seen.push([prev, current, next])
      return false
    })
    expect(seen).toEqual([[null, 'root', 'a'], ['root', 'a', 'b']])
  })

  it('stops a branch at the fold instead of running through it', () => {
    const paths = leafPaths(
      [['root', 'a'], ['a', 'b'], ['b', 'c']],
      'root',
      [],
      (_prev, current) => current === 'b',
    )
    expect(paths).toEqual([['a', 'b']])
  })
})
