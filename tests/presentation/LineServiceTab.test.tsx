import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { LineService } from '@/domain/settings/ServiceSettings'
import type { Route } from '@/shared/game/Route'

import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'
import { h } from '@/infrastructure/ui/react'
import { LineServiceTab } from '@/presentation/view/LineServiceTab'

import { LINE_ONE, LINE_TWO } from './support/cityFixture'

const SERVICE: LineService = {
  carsPerTrain: DEFAULT_SERVICE_SETTINGS.carsPerTrain,
  headwayMinutes: DEFAULT_SERVICE_SETTINGS.headwayMinutes,
}

interface TabOptions {
  ownService?: boolean
  routes?: Route[]
  running?: LineService | null
  selection?: null | string
  service?: LineService
}

function field(label: string): HTMLInputElement {
  return screen.getByText(label).parentElement?.querySelector('input') as HTMLInputElement
}

function renderTab(options: TabOptions = {}) {
  const onChange = vi.fn()
  const onSelectRoute = vi.fn()
  const view = render(
    <LineServiceTab
      onChange={onChange}
      onSelectRoute={onSelectRoute}
      ownService={options.ownService ?? false}
      routes={options.routes ?? [LINE_ONE, LINE_TWO]}
      running={options.running === undefined ? null : options.running}
      selection={options.selection === undefined ? 'r1' : options.selection}
      service={options.service ?? SERVICE}
    />,
  )

  return { onChange, onSelectRoute, view }
}

describe('LineServiceTab', () => {
  it('offers every line in the city', () => {
    renderTab()
    const picker = screen.getByRole<HTMLSelectElement>('combobox')
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual(['Line 1', 'Line 2'])
    expect(picker.value).toBe('r1')
  })

  it('shows the service the line is set to run', () => {
    renderTab({ service: { carsPerTrain: 6, headwayMinutes: { midday: 12, night: 45, offPeak: 20, peak: 4 } } })
    expect(field('Cars per train').value).toBe('6')
    expect(field('Peak').value).toBe('4')
    expect(field('Midday').value).toBe('12')
    expect(field('Off-peak').value).toBe('20')
    expect(field('Night').value).toBe('45')
  })

  it('reports a new train length', () => {
    const { onChange } = renderTab()
    fireEvent.change(field('Cars per train'), { target: { value: '6' } })
    expect(onChange).toHaveBeenCalledWith({ ...SERVICE, carsPerTrain: 6 })
  })

  it('reports a new headway for the period it belongs to', () => {
    const { onChange } = renderTab()
    fireEvent.change(field('Off-peak'), { target: { value: '20' } })
    expect(onChange).toHaveBeenCalledWith({
      ...SERVICE,
      headwayMinutes: { ...SERVICE.headwayMinutes, offPeak: 20 },
    })
  })

  it('reports the line the player picked', () => {
    const { onSelectRoute } = renderTab()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'r2' } })
    expect(onSelectRoute).toHaveBeenCalledWith('r2')
  })

  // Whole trains over the round trip rarely divide into the exact headway asked for.
  it('shows what the line runs today beside what it is set to', () => {
    renderTab({ running: { carsPerTrain: 8, headwayMinutes: { midday: 15, night: 74, offPeak: 37, peak: 5 } } })
    expect(screen.getByText(/Today it runs 8-car trains every 5 \/ 15 \/ 37 \/ 74 min/)).toBeDefined()
  })

  it('says when the line follows the city-wide settings', () => {
    renderTab()
    expect(screen.getByText(/follows the city-wide settings/)).toBeDefined()
  })

  it('says when the line runs on a service of its own', () => {
    renderTab({ ownService: true })
    expect(screen.getByText(/runs on its own service/)).toBeDefined()
  })

  it('says so when the city has no lines', () => {
    renderTab({ routes: [], selection: null })
    expect(screen.getByText('No lines in this city.')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
