import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { Toggle } from '@/presentation/components/Toggle'

describe('Toggle', () => {
  it('shows what it switches, and that it is on', () => {
    render(<Toggle checked label="Auto trains" onChange={vi.fn()} />)
    expect(screen.getByText('Auto trains')).toBeDefined()
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('shows that it is off', () => {
    render(<Toggle checked={false} label="Auto trains" onChange={vi.fn()} />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })

  // The game ships a pre-built stylesheet: a class it never uses itself (`top-0.5`,
  // `left-[1.125rem]`) resolves to nothing there, so the knob is placed inline.
  it('places the knob inside its track, by style rather than by class', () => {
    const { rerender } = render(<Toggle checked={false} label="Auto trains" onChange={vi.fn()} />)
    const knob = () => screen.getByRole('switch').firstElementChild as HTMLElement

    expect(knob().style.top).toBe('2px')
    expect(knob().style.left).toBe('2px')
    expect(knob().className).not.toMatch(/top-|left-/)

    rerender(<Toggle checked label="Auto trains" onChange={vi.fn()} />)

    expect(knob().style.left).toBe('18px')
  })

  it('reports the state the player switched to', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Toggle checked label="Auto trains" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)

    rerender(<Toggle checked={false} label="Auto trains" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
