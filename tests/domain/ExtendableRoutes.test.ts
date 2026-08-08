import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'

import { ExtendableRoutes } from '@/domain/line/ExtendableRoutes'

import { buildCity, CITY, LINE_ONE, LINE_TWO } from '../presentation/support/cityFixture'

const STATE = buildCity(CITY)

function ids(routes: Route[]): string[] {
  return routes.map((route) => route.id)
}

describe('ExtendableRoutes.filter', () => {
  // Line 1 runs Alpha–Bravo with track carrying on to Charlie; line 2 already
  // covers the whole Golf–Hotel dead-end.
  it('keeps the lines that can still grow', () => {
    expect(ids(ExtendableRoutes.filter(STATE, [LINE_ONE, LINE_TWO]))).toEqual(['r1'])
  })

  it('drops a line boxed in at both ends', () => {
    expect(ExtendableRoutes.filter(STATE, [LINE_TWO])).toEqual([])
  })

  it('keeps the order the lines came in', () => {
    const city = buildCity({ ...CITY, routes: [LINE_ONE, LINE_TWO] })

    expect(ids(ExtendableRoutes.filter(city, [LINE_TWO, LINE_ONE, LINE_TWO]))).toEqual(['r1'])
  })

  it('has nothing to offer for a city with no lines', () => {
    expect(ExtendableRoutes.filter(STATE, [])).toEqual([])
  })
})
