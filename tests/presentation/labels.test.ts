import { describe, expect, it } from 'vitest'

import type { Route } from '@/shared/game/Route'
import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

import { OrphanGroup } from '@/domain/newline/OrphanGroup'
import { errorMessage, groupLabel, realRoutes, routeLabel } from '@/presentation/labels'

function apiServing(routes: Route[]): SubwayBuilderApi {
  return { gameState: { getRoutes: () => routes } }
}

describe('realRoutes', () => {
  it('lists the lines the player can see', () => {
    const api = apiServing([{ id: 'r1', stNodes: [] }, { id: 'r2', stNodes: [] }])
    expect(realRoutes(api).map((route) => route.id)).toEqual(['r1', 'r2'])
  })

  it('hides the temp route the game leaves behind mid-edit', () => {
    const api = apiServing([{ id: 'r1', stNodes: [] }, { id: 'temp', stNodes: [], tempParentId: 'r1' }])
    expect(realRoutes(api).map((route) => route.id)).toEqual(['r1'])
  })

  it('finds no lines when the game exposes no route surface', () => {
    expect(realRoutes({})).toEqual([])
  })
})

describe('routeLabel', () => {
  it('names a line by its bullet', () => {
    expect(routeLabel({ bullet: '7', id: 'r1', stNodes: [] })).toBe('Line 7')
  })

  it('falls back to a placeholder when the line has no bullet', () => {
    expect(routeLabel({ id: 'r1', stNodes: [] })).toBe('Line ?')
  })
})

describe('groupLabel', () => {
  it('names a group by the two ends of its corridor', () => {
    const group = new OrphanGroup(['s1', 's2'], ['Alpha', 'Bravo'], ['Alpha', 'Bravo'])
    expect(groupLabel(group)).toBe('Alpha ↔ Bravo')
  })

  it('falls back to the first station names when the group forms no corridor', () => {
    const group = new OrphanGroup(['s1', 's2', 's3'], ['Alpha', 'Bravo', 'Charlie'], null)
    expect(groupLabel(group)).toBe('Alpha, Bravo')
  })
})

describe('errorMessage', () => {
  it('reads the message off a thrown Error', () => {
    expect(errorMessage(new Error('No valid path'))).toBe('No valid path')
  })

  it('stringifies whatever else the game threw', () => {
    expect(errorMessage('No valid path')).toBe('No valid path')
  })
})
