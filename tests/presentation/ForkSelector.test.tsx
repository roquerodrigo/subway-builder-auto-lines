import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Endpoint, Fork, ForkOption } from '@/domain/line/ExpansionPlan'

import { h } from '@/infrastructure/ui/react'
import { ForkSelector } from '@/presentation/components/ForkSelector'

function branch(stationId: string, name: string): ForkOption {
  return { applyStationNodeIds: [stationId + '-a'], name, stationId, stationIds: [stationId] }
}

const ECHO = branch('s5', 'Echo')
const FOXTROT = branch('s6', 'Foxtrot')

function endpointForking(fork: Fork | null): Endpoint {
  return {
    autoNames: ['Charlie', 'Delta'],
    autoStationIds: ['s3', 's4'],
    autoStationNodeIds: ['s3-a', 's4-a'],
    fork,
    name: 'Bravo',
    stationId: 's2',
  }
}

const FORK: Fork = { atName: 'Delta', options: [ECHO, FOXTROT] }

describe('ForkSelector', () => {
  it('stays out of the way for an endpoint that runs to a dead-end', () => {
    const { container } = render(<ForkSelector chosen={null} endpoint={endpointForking(null)} onChoose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('names the station the line forks after', () => {
    render(<ForkSelector chosen={null} endpoint={endpointForking(FORK)} onChoose={vi.fn()} />)
    expect(screen.getByText('Fork after Delta:')).toBeDefined()
  })

  it('offers every branch alongside the option to stop at the fork', () => {
    render(<ForkSelector chosen={null} endpoint={endpointForking(FORK)} onChoose={vi.fn()} />)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      '— Don\'t extend —',
      '→ Echo',
      '→ Foxtrot',
    ])
  })

  it('starts with no branch picked, so a fork never extends behind the player\'s back', () => {
    render(<ForkSelector chosen={undefined} endpoint={endpointForking(FORK)} onChoose={vi.fn()} />)
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('')
  })

  it('shows the branch already picked', () => {
    render(<ForkSelector chosen={FOXTROT} endpoint={endpointForking(FORK)} onChoose={vi.fn()} />)
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('1')
  })

  it('reports the branch the player picked, not its index', () => {
    const onChoose = vi.fn()
    render(<ForkSelector chosen={null} endpoint={endpointForking(FORK)} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '0' } })
    expect(onChoose).toHaveBeenCalledWith(ECHO)
  })

  it('reports no branch when the player backs out of the fork', () => {
    const onChoose = vi.fn()
    render(<ForkSelector chosen={ECHO} endpoint={endpointForking(FORK)} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onChoose).toHaveBeenCalledWith(null)
  })
})
