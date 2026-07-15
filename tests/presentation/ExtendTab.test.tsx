import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ForkChoices } from '@/domain/line/ExpansionPlan'
import type { ExtendPlanData } from '@/presentation/hooks/useExtendPlan'
import type { Route } from '@/shared/game/Route'

import { Corridor } from '@/domain/line/Corridor'
import { LineExpansionPlanner } from '@/domain/line/LineExpansionPlanner'
import { StationIndex } from '@/domain/network/StationIndex'
import { TrackNetwork } from '@/domain/network/TrackNetwork'
import { h } from '@/infrastructure/ui/react'
import { ExtendTab } from '@/presentation/view/ExtendTab'

import { buildCity, CITY, LINE_ONE, LINE_TWO } from './support/cityFixture'

interface TabOptions {
  choices?: ForkChoices
  planData?: ExtendPlanData | null
  routes?: Route[]
  status?: string
}

function planFor(route: Route): ExtendPlanData {
  const state = buildCity(CITY)
  const plan = LineExpansionPlanner.plan(state, route)
  const network = new TrackNetwork(state, StationIndex.build(state))

  return {
    order: Corridor.order(network, plan.lineStationIds),
    plan,
    railPath: (stationIds) => network.railPath(stationIds),
    route,
  }
}

function renderTab(options: TabOptions = {}) {
  const onChoose = vi.fn()
  const onSelectRoute = vi.fn()
  const view = render(
    <ExtendTab
      choices={options.choices ?? {}}
      onChoose={onChoose}
      onSelectRoute={onSelectRoute}
      planData={options.planData === undefined ? planFor(LINE_ONE) : options.planData}
      routes={options.routes ?? [LINE_ONE, LINE_TWO]}
      selection={options.routes?.length === 0 ? null : 'r1'}
      status={options.status ?? ''}
    />,
  )

  return { onChoose, onSelectRoute, view }
}

describe('ExtendTab', () => {
  it('says so when the city has no line to extend', () => {
    renderTab({ planData: null, routes: [] })
    expect(screen.getByText('No lines in this city.')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('offers every line in the city', () => {
    renderTab()
    const options = within(screen.getAllByRole('combobox')[0]).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Line 1', 'Line 2'])
  })

  it('reports the line the player picked', () => {
    const { onSelectRoute } = renderTab()
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'r2' } })
    expect(onSelectRoute).toHaveBeenCalledWith('r2')
  })

  it('shows the line and the stops it would gain', () => {
    renderTab()
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Delta')).toBeDefined()
    expect(screen.getAllByText('New')).toHaveLength(2)
  })

  it('shows only the line picker until a plan is ready', () => {
    renderTab({ planData: null })
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryByText('Alpha')).toBeNull()
  })

  it('asks the player to resolve the fork the line runs into', () => {
    renderTab()
    expect(screen.getByText('Fork after Delta:')).toBeDefined()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('reports the picked branch against the endpoint it belongs to', () => {
    const { onChoose } = renderTab()
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '0' } })
    expect(onChoose).toHaveBeenCalledWith('s2', expect.objectContaining({ name: 'Echo' }))
  })

  it('says when a line has nowhere left to grow', () => {
    renderTab({ planData: planFor(LINE_TWO) })
    expect(screen.getByText('No extension possible for this line.')).toBeDefined()
  })

  it('keeps quiet about a line with nowhere to grow while a status is showing', () => {
    renderTab({ planData: planFor(LINE_TWO), status: 'Line extended' })
    expect(screen.queryByText('No extension possible for this line.')).toBeNull()
  })

  it('stays quiet about growth for a line that can still grow', () => {
    renderTab()
    expect(screen.queryByText('No extension possible for this line.')).toBeNull()
  })
})
