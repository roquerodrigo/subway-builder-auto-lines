import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ExpansionPlan, ForkOption } from '@/domain/line/ExpansionPlan'
import type { StationListItem } from '@/presentation/types'
import type { Route } from '@/shared/game/Route'

import { Corridor } from '@/domain/line/Corridor'
import { LineExpansionPlanner } from '@/domain/line/LineExpansionPlanner'
import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { h } from '@/infrastructure/ui/react'
import { buildDisplay, StationList } from '@/presentation/components/StationList'
import { DEFAULT_LINE_COLOR } from '@/presentation/theme'

import type { CitySpec } from './support/cityFixture'

import { buildCity, buildRoute, CITY, LINE_ONE } from './support/cityFixture'
import { asRenderedColor } from './support/renderedStyle'

const ITEMS: StationListItem[] = [
  { isNew: false, name: 'Alpha' },
  { isNew: false, name: 'Bravo' },
  { isNew: true, name: 'Charlie' },
]

const ROUTE: Route = { color: '#ff0000', id: 'r1', stNodes: [] }

const SHARED_NAME_LINE = buildRoute('r4', '4', '#0000ff', ['a1-b', 'a2-a'])

// Two distinct stations that happen to share a name, one off each end of the line.
const SHARED_NAME_CITY: CitySpec = {
  links: [['d1', 'a1'], ['a1', 'a2'], ['a2', 'd2']],
  routes: [SHARED_NAME_LINE],
  stations: [
    { center: [0, 0], id: 'd1', name: 'Depot' },
    { center: [1, 0], id: 'a1', name: 'Alpha', routeIds: ['r4'] },
    { center: [2, 0], id: 'a2', name: 'Bravo', routeIds: ['r4'] },
    { center: [3, 0], id: 'd2', name: 'Depot' },
  ],
}

// The connector is the only 2px-wide element per row, and it carries the color
// the whole list is drawn in.
function connectorColors(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div[style]'))
    .filter((element) => element.style.width === '2px')
    .map((element) => element.style.background)
}

function displayFor(spec: CitySpec, route: Route): StationListItem[] {
  const { order, plan } = planFor(spec, route)

  return buildDisplay(plan, order, {})
}

function namesOf(items: StationListItem[]): string[] {
  return items.map((item) => item.name)
}

function newNames(items: StationListItem[]): string[] {
  return namesOf(items.filter((item) => item.isNew))
}

function planFor(spec: CitySpec, route: Route): { order: string[], plan: ExpansionPlan } {
  const state = buildCity(spec)
  const plan = LineExpansionPlanner.plan(state, route)
  const network = new TrackNetwork(state, StationIndex.build(state))

  return { order: Corridor.order(network, plan.lineStationIds), plan }
}

describe('StationList', () => {
  it('lists every stop on the line', () => {
    render(<StationList items={ITEMS} route={ROUTE} />)
    expect(namesOf(ITEMS).every((name) => screen.getByText(name))).toBe(true)
  })

  it('draws one connected rail segment per stop', () => {
    const { container } = render(<StationList items={ITEMS} route={ROUTE} />)
    expect(connectorColors(container)).toHaveLength(3)
  })

  it('marks the stops the line would gain', () => {
    render(<StationList items={ITEMS} route={ROUTE} />)
    expect(screen.getByText('New')).toBeDefined()
    expect(screen.getByText('Charlie').className).toContain('font-bold')
    expect(screen.getByText('Alpha').className).toContain('text-muted-foreground')
  })

  it('drops the New tag when the whole line is new and the tag says nothing', () => {
    render(<StationList hideNewTag items={ITEMS} route={ROUTE} />)
    expect(screen.queryByText('New')).toBeNull()
    expect(screen.getByText('Charlie')).toBeDefined()
  })

  it('draws the list in the line\'s own color', () => {
    const { container } = render(<StationList items={ITEMS} route={ROUTE} />)
    expect(connectorColors(container)).toEqual(Array(3).fill(asRenderedColor('#ff0000')))
  })

  it('lets a preview color override the line\'s, so the panel matches the map', () => {
    const { container } = render(<StationList color="#00ff00" items={ITEMS} route={ROUTE} />)
    expect(connectorColors(container)).toEqual(Array(3).fill(asRenderedColor('#00ff00')))
  })

  it('falls back to the default color for a line that does not exist yet', () => {
    const { container } = render(<StationList items={ITEMS} route={null} />)
    expect(connectorColors(container)).toEqual(Array(3).fill(asRenderedColor(DEFAULT_LINE_COLOR)))
  })

  it('rounds the highlight of a stop added to an existing line', () => {
    render(<StationList items={ITEMS} route={ROUTE} />)
    expect(screen.getByText('Charlie').parentElement?.className).toContain('rounded')
  })

  it('squares off the rows when every stop is new, since the pills just add noise', () => {
    render(<StationList flatRows items={ITEMS} route={ROUTE} />)
    expect(screen.getByText('Charlie').parentElement?.className).not.toContain('rounded')
  })

  it('draws nothing for a line with no stops', () => {
    const { container } = render(<StationList items={[]} route={ROUTE} />)
    expect(connectorColors(container)).toEqual([])
  })
})

describe('buildDisplay', () => {
  it('lists the line as it stands, with the stops it would gain at the end that grows', () => {
    const display = displayFor(CITY, LINE_ONE)
    expect(namesOf(display)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    expect(newNames(display)).toEqual(['Charlie', 'Delta'])
  })

  it('grows the start terminus outward, so its new stops read before it', () => {
    const startTerminusLine = buildRoute('r3', '3', '#0000ff', ['s2-b', 's3-a'])
    const display = displayFor(CITY, startTerminusLine)
    expect(namesOf(display)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    expect(newNames(display)).toEqual(['Alpha', 'Delta'])
  })

  // Two stations can share a name, and both ends growing into one is exactly when
  // that shows: the line gains both, so the list has to report both.
  it('lists both new stops when each end grows into a different station of the same name', () => {
    const display = displayFor(SHARED_NAME_CITY, SHARED_NAME_LINE)
    expect(namesOf(display)).toEqual(['Depot', 'Alpha', 'Bravo', 'Depot'])
  })

  it('adds the branch stops once the player picks one at the fork', () => {
    const { order, plan } = planFor(CITY, LINE_ONE)
    const echo = plan.endpoints[0].fork?.options[0] as ForkOption
    const display = buildDisplay(plan, order, { s2: echo })
    expect(namesOf(display)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
  })

  it('leaves the branch off until the player picks it', () => {
    const { order, plan } = planFor(CITY, LINE_ONE)
    expect(namesOf(buildDisplay(plan, order, { s2: null }))).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
  })

  it('falls back to a placeholder for a branch stop the city no longer has', () => {
    const { order, plan } = planFor(CITY, LINE_ONE)
    const echo = plan.endpoints[0].fork?.options[0] as ForkOption
    const display = buildDisplay(plan, order, { s2: { ...echo, stationIds: ['gone'] } })
    expect(namesOf(display)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', '?'])
  })

  it('falls back to a placeholder for a stop the city no longer has', () => {
    const { plan } = planFor(CITY, LINE_ONE)
    expect(buildDisplay(plan, ['gone'], {})).toEqual([{ isNew: false, name: '?' }])
  })
})
