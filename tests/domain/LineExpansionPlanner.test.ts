import { describe, expect, it } from 'vitest'

import type { ExpansionPlan } from '@/domain/line/ExpansionPlan'
import type { GameState } from '@/shared/game/GameState'
import type { Route } from '@/shared/game/Route'

import { LineExpansionPlanner } from '@/domain/line/LineExpansionPlanner'

import { buildNetwork, type NetworkSpec, point } from './support/network'

function planOver(spec: NetworkSpec, stationNodeIds: string[]): ExpansionPlan {
  const state = buildNetwork(spec)

  return LineExpansionPlanner.plan(state, routeOver(state, stationNodeIds))
}

// A line drawn over real platform nodes of `state`, the way the game stores it.
function routeOver(state: GameState, stationNodeIds: string[]): Route {
  const byId = new Map((state.stNodes ?? []).map((node) => [node.id, node] as const))

  return {
    id: 'route-1',
    stNodes: stationNodeIds.map((id) => {
      const node = byId.get(id)
      if (!node) {
        throw new Error('the fixture has no station node ' + id)
      }

      return node
    }),
  }
}

const STRAIGHT: NetworkSpec = {
  links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }, { between: ['c', 'd'] }],
  stations: [
    { at: point(0, 0), id: 'a', name: 'A' },
    { at: point(1, 0), id: 'b', name: 'B' },
    { at: point(2, 0), id: 'c', name: 'C' },
    { at: point(3, 0), id: 'd', name: 'D' },
  ],
}

const FORKED: NetworkSpec = {
  links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }, { between: ['c', 'd'] }, { between: ['c', 'e'] }],
  stations: [
    { at: point(0, 0), id: 'a', name: 'A' },
    { at: point(1, 0), id: 'b', name: 'B' },
    { at: point(2, 0), id: 'c', name: 'C' },
    { at: point(3, 1), id: 'd', name: 'D' },
    { at: point(3, -1), id: 'e', name: 'E' },
  ],
}

describe('LineExpansionPlanner.plan', () => {
  it('walks an endpoint out along every single continuation the tracks offer', () => {
    const plan = planOver(STRAIGHT, ['a#1', 'a#2', 'b#1'])
    expect(plan.endpoints).toHaveLength(1)
    expect(plan.endpoints[0].stationId).toBe('b')
    expect(plan.endpoints[0].autoNames).toEqual(['C', 'D'])
    expect(plan.endpoints[0].autoStationIds).toEqual(['c', 'd'])
  })

  // Each station the line now runs through needs both platforms; only the new far
  // end stays single-platform, since nothing has passed through it yet.
  it('turns each passed-through station into a through-stop and leaves the new end a terminus', () => {
    const plan = planOver(STRAIGHT, ['a#1', 'a#2', 'b#1'])
    expect(plan.endpoints[0].autoStationNodeIds).toEqual(['b#2', 'c#1', 'c#2', 'd#1'])
  })

  it('reports the line footprint it planned against', () => {
    const plan = planOver(STRAIGHT, ['a#1', 'a#2', 'b#1'])
    expect(plan.lineStationNodeIds).toEqual(new Set(['a#1', 'a#2', 'b#1']))
    expect(plan.lineStationIds).toEqual(new Set(['a', 'b']))
  })

  it('offers no endpoint where the tracks simply run out', () => {
    const plan = planOver(
      { links: [{ between: ['a', 'b'] }], stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }] },
      ['a#1', 'a#2', 'b#1'],
    )
    expect(plan.endpoints).toEqual([])
    expect(plan.hasAction()).toBe(false)
  })

  it('grows a line at both of its ends at once', () => {
    const plan = planOver(STRAIGHT, ['b#1', 'b#2', 'c#1'])
    expect(plan.endpoints.map((endpoint) => endpoint.stationId).sort()).toEqual(['b', 'c'])
    expect(plan.endpoints.map((endpoint) => endpoint.autoNames)).toEqual(expect.arrayContaining([['A'], ['D']]))
  })

  it('never treats a through-stop as an endpoint', () => {
    const plan = planOver(STRAIGHT, ['a#1', 'a#2', 'b#1', 'b#2', 'c#1'])
    expect(plan.endpoints.map((endpoint) => endpoint.stationId)).not.toContain('b')
  })

  it('stops at a fork and offers one branch per end of the tracks past it', () => {
    const plan = planOver(FORKED, ['a#1', 'a#2', 'b#1'])
    const [endpoint] = plan.endpoints
    expect(endpoint.autoNames).toEqual(['C'])
    expect(endpoint.fork?.atName).toBe('C')
    expect(endpoint.fork?.options.map((option) => option.name).sort()).toEqual(['D', 'E'])
    expect(plan.hasAction()).toBe(true)
  })

  // A branch is followed to its terminus, not just to the first station past the
  // junction: the user picks a destination, not a hop.
  it('follows each fork branch all the way to its far terminus', () => {
    const plan = planOver(
      {
        links: [
          { between: ['a', 'b'] }, { between: ['b', 'c'] },
          { between: ['c', 'd'] }, { between: ['d', 'f'] }, { between: ['c', 'e'] },
        ],
        stations: [
          { at: point(0, 0), id: 'a', name: 'A' },
          { at: point(1, 0), id: 'b', name: 'B' },
          { at: point(2, 0), id: 'c', name: 'C' },
          { at: point(3, 1), id: 'd', name: 'D' },
          { at: point(3, -1), id: 'e', name: 'E' },
          { at: point(4, 2), id: 'f', name: 'F' },
        ],
      },
      ['a#1', 'a#2', 'b#1'],
    )
    const far = plan.endpoints[0].fork?.options.find((option) => option.name === 'F')
    expect(far?.stationIds).toEqual(['d', 'f'])
    expect(far?.stationId).toBe('f')
    expect(far?.applyStationNodeIds).toEqual(['c#2', 'd#1', 'd#2', 'f#1'])
  })

  it('gives each fork branch the station nodes that build it', () => {
    const plan = planOver(FORKED, ['a#1', 'a#2', 'b#1'])
    const toD = plan.endpoints[0].fork?.options.find((option) => option.name === 'D')
    expect(toD?.applyStationNodeIds).toEqual(['c#2', 'd#1'])
  })

  it('adds the auto chain plus only the branch the user picked', () => {
    const plan = planOver(FORKED, ['a#1', 'a#2', 'b#1'])
    const toE = plan.endpoints[0].fork?.options.find((option) => option.name === 'E')
    expect(toE).toBeDefined()
    expect(plan.addStationNodeIds({ b: toE })).toEqual(['b#2', 'c#1', 'c#2', 'e#1'])
  })

  // The candidate touches a station the line already covers, so running into it
  // would zig-zag back over territory the line already has.
  it('refuses to extend into a station that loops back onto the line', () => {
    const plan = planOver(
      {
        links: [{ between: ['a', 'b'] }, { between: ['b', 'c'] }, { between: ['b', 'd'] }, { between: ['c', 'd'] }],
        stations: [
          { at: point(0, 0), id: 'a', name: 'A' },
          { at: point(1, 0), id: 'b', name: 'B' },
          { at: point(2, 0), id: 'c', name: 'C' },
          { at: point(1.5, 1), id: 'd', name: 'D' },
        ],
      },
      ['a#1', 'a#2', 'b#1', 'b#2', 'c#1'],
    )
    expect(plan.hasAction()).toBe(false)
  })

  it('ignores a platform of the line whose station is gone from the state', () => {
    const state = buildNetwork(STRAIGHT)
    const route = routeOver(state, ['a#1', 'a#2', 'b#1'])
    const trimmed = { ...state, stations: (state.stations ?? []).filter((station) => station.id !== 'b') }
    const plan = LineExpansionPlanner.plan(trimmed, route)
    expect(plan.lineStationIds).toEqual(new Set(['a']))
  })

  it('offers nothing for a line with no stations at all', () => {
    const state = buildNetwork(STRAIGHT)
    const plan = LineExpansionPlanner.plan(state, routeOver(state, []))
    expect(plan.endpoints).toEqual([])
    expect(plan.lineStationIds.size).toBe(0)
  })

  it('grows a one-station line out along the tracks', () => {
    const plan = planOver(STRAIGHT, ['a#1'])
    expect(plan.endpoints).toHaveLength(1)
    expect(plan.endpoints[0].autoNames).toEqual(['B', 'C', 'D'])
  })
})
