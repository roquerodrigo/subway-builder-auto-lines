import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'

import { BulletSequence } from '@/domain/newline/BulletSequence'

function route(overrides: Partial<Route> = {}): Route {
  return { id: 'route-1', stNodes: [], ...overrides }
}

describe('BulletSequence.next', () => {
  it('starts a city at line 1', () => {
    expect(BulletSequence.next([])).toBe('1')
  })

  it('carries on from the highest numbered line', () => {
    expect(BulletSequence.next([route({ bullet: '1' }), route({ bullet: '7' }), route({ bullet: '3' })])).toBe('8')
  })

  // The game auto-assigns letters and ignores customBullet, so the lines the mod
  // did not create carry labels that are no part of this sequence.
  it('ignores the letter bullets the game hands out on its own', () => {
    expect(BulletSequence.next([route({ bullet: 'A' }), route({ bullet: 'B' })])).toBe('1')
  })

  it('numbers around the letters when a city has both', () => {
    expect(BulletSequence.next([route({ bullet: 'A' }), route({ bullet: '4' })])).toBe('5')
  })

  it('ignores a line with no label at all', () => {
    expect(BulletSequence.next([route()])).toBe('1')
  })

  // A temp route is the fragment the game leaves behind mid-edit; it is not a line
  // and must not burn a number.
  it('ignores the temp routes an edit leaves behind', () => {
    const routes = [route({ bullet: '9', tempParentId: 'route-1' }), route({ bullet: '2' })]
    expect(BulletSequence.next(routes)).toBe('3')
  })

  it('counts a line whose temp parent is explicitly none', () => {
    expect(BulletSequence.next([route({ bullet: '5', tempParentId: null })])).toBe('6')
  })

  it('never reuses a number a line already carries', () => {
    const routes = [route({ bullet: '1' }), route({ bullet: '2' }), route({ bullet: '3' })]
    const next = BulletSequence.next(routes)
    expect(routes.map((line) => line.bullet)).not.toContain(next)
  })

  it('gives back a label the game can store, not a number', () => {
    expect(BulletSequence.next([route({ bullet: '2' })])).toBeTypeOf('string')
  })
})
