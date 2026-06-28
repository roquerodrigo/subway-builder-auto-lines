import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { TabBar } from '@/presentation/components/TabBar'
import { PanelMode } from '@/presentation/types'

describe('TabBar', () => {
  it('offers both tabs', () => {
    render(<TabBar mode={PanelMode.Extend} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Extend' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'New line' })).toBeDefined()
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

  it('reports the tab the player is already on, leaving the panel to ignore it', () => {
    const onSelect = vi.fn()
    render(<TabBar mode={PanelMode.Extend} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Extend' }))
    expect(onSelect).toHaveBeenCalledWith(PanelMode.Extend)
  })
})
