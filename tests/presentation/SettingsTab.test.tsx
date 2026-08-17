import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ServiceSettings } from '@/domain/settings/ServiceSettings'

import { DEFAULT_SERVICE_SETTINGS } from '@/domain/settings/ServiceSettings'
import { h } from '@/infrastructure/ui/react'
import { SettingsTab } from '@/presentation/view/SettingsTab'

function field(label: string): HTMLInputElement {
  return screen.getByText(label).parentElement?.querySelector('input') as HTMLInputElement
}

function renderTab(settings: Partial<ServiceSettings> = {}, canReset = true) {
  const onChange = vi.fn()
  const onReset = vi.fn()
  const view = render(
    <SettingsTab
      canReset={canReset}
      onChange={onChange}
      onReset={onReset}
      settings={{ ...DEFAULT_SERVICE_SETTINGS, ...settings }}
    />,
  )

  return { onChange, onReset, view }
}

function toggle(label: string): HTMLElement {
  return screen.getByRole('switch', { name: label })
}

describe('SettingsTab', () => {
  it('shows the service the mod is set to provision', () => {
    renderTab()
    expect(toggle('Auto trains').getAttribute('aria-checked')).toBe('true')
    expect(field('Cars per train').value).toBe('10')
    expect(field('Peak').value).toBe('5')
    expect(field('Midday').value).toBe('15')
    expect(field('Off-peak').value).toBe('30')
    expect(field('Night').value).toBe('60')
  })

  it('switches auto trains off', () => {
    const { onChange } = renderTab()
    fireEvent.click(toggle('Auto trains'))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICE_SETTINGS, autoTrains: false })
  })

  it('switches auto trains back on', () => {
    const { onChange } = renderTab({ autoTrains: false })
    fireEvent.click(toggle('Auto trains'))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SERVICE_SETTINGS)
  })

  it('switches sorting the line list off', () => {
    const { onChange } = renderTab()
    fireEvent.click(toggle('Sort lines by name'))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICE_SETTINGS, sortLinesByName: false })
  })

  it('switches sorting the line list back on', () => {
    const { onChange } = renderTab({ sortLinesByName: false })
    fireEvent.click(toggle('Sort lines by name'))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SERVICE_SETTINGS)
  })

  it('says what leaving the line list alone means', () => {
    renderTab({ sortLinesByName: false })
    expect(screen.getByText(/keeps the order you gave it/)).toBeDefined()
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

  it('puts every setting back when asked', () => {
    const { onReset } = renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(onReset).toHaveBeenCalled()
  })

  it('offers no reset while the settings are untouched', () => {
    renderTab({}, false)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reset to defaults' }).disabled).toBe(true)
  })

  // Nothing below is applied while auto trains are off, so nothing below is editable.
  it('locks the numbers while auto trains are off', () => {
    renderTab({ autoTrains: false })
    expect(field('Cars per train').disabled).toBe(true)
    expect(field('Peak').disabled).toBe(true)
    expect(field('Night').disabled).toBe(true)
  })
})
