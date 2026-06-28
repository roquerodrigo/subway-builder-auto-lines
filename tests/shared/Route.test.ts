import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'

import { findRoute } from '@/shared/game/Route'

function route(id: string): Route {
  return { id, stNodes: [] }
}

describe('findRoute', () => {
  it('finds the route with the given id', () => {
    const wanted = route('route-2')
    expect(findRoute([route('route-1'), wanted], 'route-2')).toBe(wanted)
  })

  it('finds nothing when no route carries that id', () => {
    expect(findRoute([route('route-1')], 'route-2')).toBeUndefined()
  })

  it('finds nothing in an empty game', () => {
    expect(findRoute([], 'route-1')).toBeUndefined()
  })

  // Every read goes through a fresh store snapshot, and a snapshot taken before a
  // city is loaded carries no routes at all.
  it('finds nothing when the game holds no routes yet', () => {
    expect(findRoute(undefined, 'route-1')).toBeUndefined()
  })
})
