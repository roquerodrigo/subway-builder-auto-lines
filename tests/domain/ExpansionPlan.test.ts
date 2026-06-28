import { describe, expect, it } from 'vitest'

import type { Endpoint, ForkOption } from '@/domain/line/ExpansionPlan'

import { ExpansionPlan } from '@/domain/line/ExpansionPlan'
import { StationIndex } from '@/domain/network/StationIndex'

import { buildNetwork, point } from './support/network'

const INDEX = StationIndex.build(buildNetwork({
  links: [{ between: ['a', 'b'] }],
  stations: [{ at: point(0, 0), id: 'a' }, { at: point(1, 0), id: 'b' }],
}))

function endpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    autoNames: [],
    autoStationIds: [],
    autoStationNodeIds: [],
    fork: null,
    name: 'Sé',
    stationId: 'a',
    ...overrides,
  }
}

function forkOption(overrides: Partial<ForkOption> = {}): ForkOption {
  return {
    applyStationNodeIds: ['c#2', 'd#1'],
    name: 'Vila Madalena',
    stationId: 'd',
    stationIds: ['d'],
    ...overrides,
  }
}

function planOf(endpoints: Endpoint[]): ExpansionPlan {
  return new ExpansionPlan(INDEX, new Set(['a#1']), new Set(['a']), endpoints)
}

describe('ExpansionPlan.addStationNodeIds', () => {
  it('adds nothing for a line with no growable endpoint', () => {
    expect(planOf([]).addStationNodeIds({})).toEqual([])
  })

  it('adds every station node of an endpoint auto chain', () => {
    const plan = planOf([endpoint({ autoNames: ['B'], autoStationNodeIds: ['a#2', 'b#1'] })])
    expect(plan.addStationNodeIds({})).toEqual(['a#2', 'b#1'])
  })

  it('adds the chosen fork branch on top of the auto chain', () => {
    const plan = planOf([endpoint({ autoStationNodeIds: ['a#2', 'c#1'], fork: { atName: 'C', options: [forkOption()] } })])
    expect(plan.addStationNodeIds({ a: forkOption() })).toEqual(['a#2', 'c#1', 'c#2', 'd#1'])
  })

  it('adds nothing for a fork the user has not resolved', () => {
    const plan = planOf([endpoint({ autoStationNodeIds: ['a#2'], fork: { atName: 'C', options: [forkOption()] } })])
    expect(plan.addStationNodeIds({})).toEqual(['a#2'])
    expect(plan.addStationNodeIds({ a: null })).toEqual(['a#2'])
    expect(plan.addStationNodeIds({ a: undefined })).toEqual(['a#2'])
  })

  it('ignores a choice made for an endpoint that has no fork', () => {
    const plan = planOf([endpoint({ autoStationNodeIds: ['a#2'] })])
    expect(plan.addStationNodeIds({ a: forkOption() })).toEqual(['a#2'])
  })

  it('keys the choices by the endpoint, not by the junction the fork sits at', () => {
    const plan = planOf([endpoint({ fork: { atName: 'C', options: [forkOption()] } })])
    expect(plan.addStationNodeIds({ d: forkOption() })).toEqual([])
  })

  // Two endpoints growing toward each other can name the same node; adding it
  // twice would push the station through the route builder a second time.
  it('never repeats a station node two endpoints both want', () => {
    const plan = planOf([
      endpoint({ autoStationNodeIds: ['a#2', 'x#1'], stationId: 'a' }),
      endpoint({ autoStationNodeIds: ['x#1', 'b#2'], stationId: 'b' }),
    ])
    expect(plan.addStationNodeIds({})).toEqual(['a#2', 'x#1', 'b#2'])
  })

  it('never repeats a station node the auto chain and the fork both want', () => {
    const fork = { atName: 'C', options: [forkOption({ applyStationNodeIds: ['a#2', 'd#1'] })] }
    const plan = planOf([endpoint({ autoStationNodeIds: ['a#2'], fork })])
    expect(plan.addStationNodeIds({ a: fork.options[0] })).toEqual(['a#2', 'd#1'])
  })

  it('collects both endpoints of a line growing at each end', () => {
    const plan = planOf([
      endpoint({ autoStationNodeIds: ['a#2', 'z#1'], stationId: 'a' }),
      endpoint({ autoStationNodeIds: ['b#2', 'y#1'], stationId: 'b' }),
    ])
    expect(plan.addStationNodeIds({})).toEqual(['a#2', 'z#1', 'b#2', 'y#1'])
  })
})

describe('ExpansionPlan.hasAction', () => {
  it('is false for a line with no endpoint to grow', () => {
    expect(planOf([]).hasAction()).toBe(false)
  })

  it('is true when an endpoint can extend on its own', () => {
    expect(planOf([endpoint({ autoNames: ['B'] })]).hasAction()).toBe(true)
  })

  it('is true when an endpoint only offers a fork to resolve', () => {
    expect(planOf([endpoint({ fork: { atName: 'C', options: [forkOption()] } })]).hasAction()).toBe(true)
  })

  it('is false when an endpoint offers neither', () => {
    expect(planOf([endpoint()]).hasAction()).toBe(false)
  })

  it('is true when any one of several endpoints can grow', () => {
    expect(planOf([endpoint(), endpoint({ autoNames: ['B'] })]).hasAction()).toBe(true)
  })
})
