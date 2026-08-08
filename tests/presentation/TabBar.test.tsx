import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { TabBar } from '@/presentation/components/TabBar'
import { PanelMode } from '@/presentation/types'

describe('TabBar', () => {
  it('offers every tab', () => {
    render(<TabBar mode={PanelMode.Extend} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Extend' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'New line' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Per line' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined()
  })

  it('highlights the tab the player is on', () => {
    render(<TabBar mode={PanelMode.New} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'New line' }).className).toContain('bg-primary text-primary-foreground')
    expect(screen.getByRole('button', { name: 'Extend' }).className).not.toContain('text-primary-foreground')
  })

  it('reports the tab the player clicked', () => {
    const onSelect = vi.fn()
    render(<TabBar mode={PanelMode.Extend} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'New line' }))
    expect(onSelect).toHaveBeenCalledWith(PanelMode.New)
  })

  it('reports the settings tab the player opened', () => {
    const onSelect = vi.fn()
    render(<TabBar mode={PanelMode.Extend} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onSelect).toHaveBeenCalledWith(PanelMode.Settings)
  })

  it('reports the per-line tab the player opened', () => {
    const onSelect = vi.fn()
    render(<TabBar mode={PanelMode.Extend} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Per line' }))
    expect(onSelect).toHaveBeenCalledWith(PanelMode.PerLine)
  })

  it('reports the tab the player is already on, leaving the panel to ignore it', () => {
    const onSelect = vi.fn()
    render(<TabBar mode={PanelMode.Extend} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Extend' }))
    expect(onSelect).toHaveBeenCalledWith(PanelMode.Extend)
  })
})
