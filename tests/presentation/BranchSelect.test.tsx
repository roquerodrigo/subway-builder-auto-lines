import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { BranchSelect } from '@/presentation/components/BranchSelect'
import { FORK_LABEL_COLOR } from '@/presentation/theme'

import { asRenderedColor } from './support/renderedStyle'

const OPTIONS = [
  { label: '— Don\'t continue —', value: '' },
  { label: '→ Echo', value: 's5' },
]

describe('BranchSelect', () => {
  it('prompts for the branch above the picker', () => {
    render(<BranchSelect label="Continue from Delta to:" onChange={vi.fn()} options={OPTIONS} value={null} />)
    expect(screen.getByText('Continue from Delta to:')).toBeDefined()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['— Don\'t continue —', '→ Echo'])
  })

  it('colors the prompt so the fork stands out', () => {
    render(<BranchSelect label="Continue from Delta to:" onChange={vi.fn()} options={OPTIONS} value={null} />)
    expect(screen.getByText('Continue from Delta to:').style.color).toBe(asRenderedColor(FORK_LABEL_COLOR))
  })

  it('reports the branch the player picked', () => {
    const onChange = vi.fn()
    render(<BranchSelect label="Continue from Delta to:" onChange={onChange} options={OPTIONS} value={null} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's5' } })
    expect(onChange).toHaveBeenCalledWith('s5')
  })
})
