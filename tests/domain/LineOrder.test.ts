import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'

import { LineOrder } from '@/domain/line/LineOrder'

function idsOf(routes: Route[]): string[] {
  return routes.map((line) => line.id)
}

function route(id: string, overrides: Partial<Route> = {}): Route {
  return { id, stNodes: [], ...overrides }
}

describe('LineOrder.byName', () => {
  it('puts the lines in the order their names read', () => {
    const sorted = LineOrder.byName([
      route('c', { fullName: 'Green Line' }),
      route('a', { fullName: 'Blue Line' }),
      route('b', { fullName: 'Circle Line' }),
    ])

    expect(idsOf(sorted)).toEqual(['a', 'b', 'c'])
  })

  // Plain string order would file "Line 10" between "Line 1" and "Line 2".
  it('reads the digits in a name as a number', () => {
    const sorted = LineOrder.byName([
      route('ten', { fullName: 'Line 10 - Turquesa' }),
      route('two', { fullName: 'Line 2 - Verde' }),
      route('nine', { fullName: 'Line 9 - Esmeralda' }),
    ])

    expect(idsOf(sorted)).toEqual(['two', 'nine', 'ten'])
  })

  it('falls back to the bullet where a line has no name', () => {
    const sorted = LineOrder.byName([route('b', { bullet: '4' }), route('a', { bullet: '3' })])

    expect(idsOf(sorted)).toEqual(['a', 'b'])
  })

  it('files a line with neither name nor bullet first', () => {
    const sorted = LineOrder.byName([route('named', { fullName: 'Line 1' }), route('bare')])

    expect(idsOf(sorted)).toEqual(['bare', 'named'])
  })

  it('ignores case and accents', () => {
    const sorted = LineOrder.byName([
      route('c', { fullName: 'ébano' }),
      route('a', { fullName: 'Azul' }),
      route('b', { fullName: 'branco' }),
    ])

    expect(idsOf(sorted)).toEqual(['a', 'b', 'c'])
  })

  // A temp route is a half-finished edit the game drops on its own; leaving it at
  // the end keeps it out of the player's list.
  it('leaves the temp routes at the end, in the order they were', () => {
    const sorted = LineOrder.byName([
      route('temp-2', { fullName: 'A', tempParentId: 'b' }),
      route('b', { fullName: 'B' }),
      route('temp-1', { fullName: 'A', tempParentId: 'a' }),
      route('a', { fullName: 'A' }),
    ])

    expect(idsOf(sorted)).toEqual(['a', 'b', 'temp-2', 'temp-1'])
  })

  it('leaves the routes it was given untouched', () => {
    const routes = [route('b', { fullName: 'B' }), route('a', { fullName: 'A' })]
    LineOrder.byName(routes)

    expect(idsOf(routes)).toEqual(['b', 'a'])
  })
})

describe('LineOrder.sameOrder', () => {
  it('sees the same lines in the same places', () => {
    expect(LineOrder.sameOrder([route('a'), route('b')], [route('a'), route('b')])).toBe(true)
  })

  it('sees two lines that swapped places', () => {
    expect(LineOrder.sameOrder([route('a'), route('b')], [route('b'), route('a')])).toBe(false)
  })

  it('sees a list that lost a line', () => {
    expect(LineOrder.sameOrder([route('a'), route('b')], [route('a')])).toBe(false)
  })
})
