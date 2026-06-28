import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { h } from '@/infrastructure/ui/react'
import { Spinner } from '@/presentation/components/Spinner'

describe('Spinner', () => {
  it('says what it is waiting on', () => {
    render(<Spinner label="Creating line…" />)
    expect(screen.getByText('Creating line…')).toBeDefined()
  })

  it('spins on its own when there is nothing to say', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelectorAll('span')).toHaveLength(1)
    expect(container.querySelector('span')?.className).toContain('animate-spin')
  })
})
