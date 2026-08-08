import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { NumberField } from '@/presentation/components/NumberField'

function renderField(props: { max?: number, min?: number, value?: number } = {}) {
  const onChange = vi.fn()
  const view = render(
    <NumberField
      label="Cars per train"
      max={props.max ?? 15}
      min={props.min ?? 1}
      onChange={onChange}
      suffix="min"
      value={props.value ?? 10}
    />,
  )

  return { input: view.container.querySelector('input') as HTMLInputElement, onChange, view }
}

describe('NumberField', () => {
  it('shows the value it was given, with its label and unit', () => {
    const { input } = renderField()
    expect(input.value).toBe('10')
    expect(screen.getByText('Cars per train')).toBeDefined()
    expect(screen.getByText('min')).toBeDefined()
  })

  it('reports a value inside the range', () => {
    const { input, onChange } = renderField()
    fireEvent.change(input, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('holds a value outside the range back', () => {
    const { input, onChange } = renderField({ max: 15 })
    fireEvent.change(input, { target: { value: '99' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe('99')
  })

  // Clearing the field is how a player starts typing a new number.
  it('lets the field be cleared without reporting anything', () => {
    const { input, onChange } = renderField()
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('restores the last good value when the player leaves a half-typed field', () => {
    const { input } = renderField({ value: 10 })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(input.value).toBe('10')
  })

  it('follows the value when it changes elsewhere', () => {
    const { input, view } = renderField({ value: 10 })
    view.rerender(<NumberField label="Cars per train" max={15} min={1} onChange={vi.fn()} value={4} />)
    expect(input.value).toBe('4')
  })

  it('ignores a fractional value', () => {
    const { input, onChange } = renderField()
    fireEvent.change(input, { target: { value: '7.5' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('drops the unit when the field has none', () => {
    render(<NumberField label="Cars" max={15} min={1} onChange={vi.fn()} value={3} />)
    expect(screen.queryByText('min')).toBeNull()
  })
})
