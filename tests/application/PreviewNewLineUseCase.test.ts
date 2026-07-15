import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { PreviewNewLineUseCase } from '@/application/PreviewNewLineUseCase'
import { GameStore } from '@/infrastructure/store/GameStore'

import { buildNetwork, point } from '../domain/support/network'

// The first two colors of the Glasbey palette the mod picks new lines from.
const FIRST_PALETTE_COLOR = '#d70000'
const SECOND_PALETTE_COLOR = '#028800'

function coloredRoute(color: string | undefined): Route {
  return { color, id: 'route-1', stNodes: [] }
}

// A straight three-station corridor with a turnaround at each end.
function corridorNetwork(): GameState {
  return buildNetwork({
    crossovers: ['a', 'c'],
    links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }],
    stations: [
      { at: point(0, 0), id: 'a', name: 'Alpha' },
      { at: point(1, 0), id: 'b', name: 'Bravo' },
      { at: point(2, 0), id: 'c', name: 'Charlie' },
    ],
  })
}

function createFixture(overrides: Partial<GameState> = {}) {
  const generateRoute = vi.fn()
  const setPreviewRoute = vi.fn()
  const setRoutes = vi.fn()
  const setTracks = vi.fn()
  const state: GameState = {
    ...corridorNetwork(),
    generateRoute,
    setPreviewRoute,
    setRoutes,
    setTracks,
    ...overrides,
  }

  return {
    generateRoute,
    setPreviewRoute,
    setRoutes,
    setTracks,
    state,
    useCase: new PreviewNewLineUseCase(new GameStore({ getState: () => state })),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PreviewNewLineUseCase', () => {
  it('plans the corridor the line would follow through the group', () => {
    const { useCase } = createFixture()
    expect(useCase.execute(['a', 'b', 'c']).corridor.path).toEqual(['a', 'b', 'c'])
  })

  it('offers no fork on a corridor that runs end to end', () => {
    const { useCase } = createFixture()
    expect(useCase.execute(['a', 'b', 'c']).corridor.forks).toEqual([])
  })

  it('reports how many stations the group holds', () => {
    const { useCase } = createFixture()
    expect(useCase.execute(['a', 'b', 'c']).groupSize).toBe(3)
  })

  describe('station display data', () => {
    it('names every station in the group', () => {
      const { useCase } = createFixture()
      expect(useCase.execute(['a', 'b']).nameById).toEqual({ a: 'Alpha', b: 'Bravo' })
    })

    it('falls back to a question mark for a station the game does not know', () => {
      const { useCase } = createFixture()
      expect(useCase.execute(['a', 'ghost']).nameById.ghost).toBe('?')
    })

    it('places each station at the centre point between its two platforms', () => {
      const { useCase } = createFixture()
      expect(useCase.execute(['a', 'b']).coordById).toEqual({
        a: point(0, 0),
        b: point(1, 0),
      })
    })

    it('omits a station whose position the game does not know', () => {
      const { useCase } = createFixture()
      expect(useCase.execute(['a', 'ghost']).coordById).not.toHaveProperty('ghost')
    })
  })

  describe('the line color', () => {
    it('picks a color from the palette', () => {
      const { useCase } = createFixture()
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(useCase.execute(['a', 'b']).color).toBe(FIRST_PALETTE_COLOR)
    })

    it('avoids a color an existing line already uses', () => {
      const { useCase } = createFixture({ routes: [coloredRoute(FIRST_PALETTE_COLOR)] })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(useCase.execute(['a', 'b']).color).toBe(SECOND_PALETTE_COLOR)
    })

    it('ignores a colorless line when working out what is taken', () => {
      const { useCase } = createFixture({ routes: [coloredRoute(undefined)] })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(useCase.execute(['a', 'b']).color).toBe(FIRST_PALETTE_COLOR)
    })

    it('picks a color even when the game holds no lines at all', () => {
      const { useCase } = createFixture({ routes: undefined })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(useCase.execute(['a', 'b']).color).toBe(FIRST_PALETTE_COLOR)
    })
  })

  describe('the rail geometry', () => {
    // The real track coordinates, so the map preview follows the rails rather than
    // cutting a straight line between the stations.
    it('traces the rails from one station to the next', () => {
      const { useCase } = createFixture()
      const rails = useCase.execute(['a', 'b']).railPath(['a', 'b'])
      expect(rails.length).toBeGreaterThanOrEqual(2)
      expect(rails[0][0]).toBe(point(0, 0)[0])
      expect(rails[rails.length - 1][0]).toBe(point(1, 0)[0])
    })

    it('follows a curve in the rails instead of cutting across it', () => {
      const { useCase } = createFixture({
        ...buildNetwork({
          links: [{ between: ['a', 'b'], shape: [point(1, 1)] }],
          stations: [{ at: point(0, 0), id: 'a' }, { at: point(2, 0), id: 'b' }],
        }),
      })
      expect(useCase.execute(['a', 'b']).railPath(['a', 'b'])).toHaveLength(3)
    })

    it('traces nothing for a single station', () => {
      const { useCase } = createFixture()
      expect(useCase.execute(['a', 'b']).railPath(['a'])).toEqual([])
    })
  })

  // Browsing the group dropdown must leave no ghost line behind: the real route is
  // only built when the user commits (CreateNewLineUseCase).
  it('leaves the game completely untouched', () => {
    const { generateRoute, setPreviewRoute, setRoutes, setTracks, useCase } = createFixture()
    useCase.execute(['a', 'b', 'c'])
    expect(generateRoute).not.toHaveBeenCalled()
    expect(setPreviewRoute).not.toHaveBeenCalled()
    expect(setRoutes).not.toHaveBeenCalled()
    expect(setTracks).not.toHaveBeenCalled()
  })
})
