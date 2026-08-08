import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ServiceSettings } from '@/domain/settings/ServiceSettings'

import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'
import { h } from '@/infrastructure/ui/react'
import { SettingsTab } from '@/presentation/view/SettingsTab'

function field(label: string): HTMLInputElement {
  return screen.getByText(label).parentElement?.querySelector('input') as HTMLInputElement
}

function renderTab(settings: Partial<ServiceSettings> = {}) {
  const onChange = vi.fn()
  const view = render(<SettingsTab onChange={onChange} settings={{ ...DEFAULT_SERVICE_SETTINGS, ...settings }} />)

  return { onChange, view }
}

describe('SettingsTab', () => {
  it('shows the service the mod is set to provision', () => {
    renderTab()
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
    expect(field('Cars per train').value).toBe('10')
    expect(field('Peak').value).toBe('5')
    expect(field('Midday').value).toBe('15')
    expect(field('Off-peak').value).toBe('30')
    expect(field('Night').value).toBe('60')
  })

  it('switches auto trains off', () => {
    const { onChange } = renderTab()
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICE_SETTINGS, autoTrains: false })
  })

  it('switches auto trains back on', () => {
    const { onChange } = renderTab({ autoTrains: false })
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SERVICE_SETTINGS)
  })

  it('says what switching auto trains off leaves the player to do', () => {
    renderTab({ autoTrains: false })
    expect(screen.getByText(/without trains/)).toBeDefined()
  })

  it('reports a new train length', () => {
    const { onChange } = renderTab()
    fireEvent.change(field('Cars per train'), { target: { value: '6' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICE_SETTINGS, carsPerTrain: 6 })
  })

  it('reports a new headway for the period it belongs to', () => {
    const { onChange } = renderTab()
    fireEvent.change(field('Off-peak'), { target: { value: '20' } })
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SERVICE_SETTINGS,
      headwayMinutes: { ...DEFAULT_SERVICE_SETTINGS.headwayMinutes, offPeak: 20 },
    })
  })

  // Nothing below is applied while auto trains are off, so nothing below is editable.
  it('locks the numbers while auto trains are off', () => {
    renderTab({ autoTrains: false })
    expect(field('Cars per train').disabled).toBe(true)
    expect(field('Peak').disabled).toBe(true)
    expect(field('Night').disabled).toBe(true)
  })
})
