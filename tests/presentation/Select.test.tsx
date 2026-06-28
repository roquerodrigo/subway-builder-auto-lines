import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { Select } from '@/presentation/components/Select'

const OPTIONS = [
  { value: 'r1', label: 'Line 1' },
  { value: 'r2', label: 'Line 2' },
]

describe('Select', () => {
  it('offers one option per choice', () => {
    render(<Select onChange={vi.fn()} options={OPTIONS} value="r1" />)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Line 1', 'Line 2'])
  })

  it('shows the current choice', () => {
    render(<Select onChange={vi.fn()} options={OPTIONS} value="r2" />)
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('r2')
  })

  it('shows the empty option while nothing is chosen yet', () => {
    const options = [{ value: '', label: '— Pick one —' }, ...OPTIONS]
    render(<Select onChange={vi.fn()} options={options} value={null} />)
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('')
  })

  it('reports the value the player picked', () => {
    const onChange = vi.fn()
    render(<Select onChange={onChange} options={OPTIONS} value="r1" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'r2' } })
    expect(onChange).toHaveBeenCalledWith('r2')
  })
})
