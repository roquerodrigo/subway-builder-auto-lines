import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { NewLineBranch, NewLineFork, NewLineForkChoices } from '@/domain/newline/NewLinePlanner'

import { OrphanGroup } from '@/domain/newline/OrphanGroup'
import { h } from '@/infrastructure/ui/react'
import { NewLineTab } from '@/presentation/view/NewLineTab'

import { asRenderedColor } from './support/renderedStyle'

const ECHO: NewLineBranch = { key: 's5', name: 'Echo', stationIds: ['s5'] }
const FOXTROT: NewLineBranch = { key: 's6', name: 'Foxtrot', stationIds: ['s6'] }

const FORK: NewLineFork = {
  atName: 'Delta',
  atStationId: 's4',
  end: 'end',
  options: [ECHO, FOXTROT],
}

const GROUPS = [
  new OrphanGroup(['s3', 's4'], ['Charlie', 'Delta'], ['Charlie', 'Delta']),
  new OrphanGroup(['s9', 's10'], ['India', 'Juliett'], ['India', 'Juliett']),
]

interface TabOptions {
  choices?: NewLineForkChoices
  color?: string
  creating?: boolean
  forks?: NewLineFork[]
  groups?: OrphanGroup[]
  names?: string[]
  ok?: boolean
}

function renderTab(options: TabOptions = {}) {
  const onChoose = vi.fn()
  const onCycleColor = vi.fn()
  const onSelectGroup = vi.fn()
  const groups = options.groups ?? GROUPS
  const view = render(
    <NewLineTab
      choices={options.choices ?? {}}
      color={options.color ?? '#d70000'}
      creating={options.creating ?? false}
      forks={options.forks ?? []}
      groups={groups}
      names={options.names ?? ['Charlie', 'Delta']}
      ok={options.ok ?? true}
      onChoose={onChoose}
      onCycleColor={onCycleColor}
      onSelectGroup={onSelectGroup}
      selection={groups[0]?.key ?? null}
    />,
  )

  return { onChoose, onCycleColor, onSelectGroup, view }
}

describe('NewLineTab', () => {
  it('says so when every station already has a line', () => {
    renderTab({ groups: [] })
    expect(screen.getByText('No stations without a line.')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('offers every unserved group by the ends of its corridor', () => {
    renderTab()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Charlie ↔ Delta',
      'India ↔ Juliett',
    ])
  })

  it('reports the group the player picked', () => {
    const { onSelectGroup } = renderTab()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's10|s9' } })
    expect(onSelectGroup).toHaveBeenCalledWith('s10|s9')
  })

  it('lists the stops of the line it would build and counts them', () => {
    renderTab({ names: ['Charlie', 'Delta', 'Echo'] })
    expect(screen.getByText('Charlie')).toBeDefined()
    expect(screen.getByText('Echo')).toBeDefined()
    expect(screen.getByText('3 stations')).toBeDefined()
  })

  it('marks no stop as new, since every stop of a new line is', () => {
    renderTab()
    expect(screen.queryByText('New')).toBeNull()
  })

  it('says so when the group cannot form a line', () => {
    renderTab({ ok: false })
    expect(screen.getByText('Could not form a line.')).toBeDefined()
    expect(screen.queryByText('2 stations')).toBeNull()
  })

  it('keeps the group picker while the group cannot form a line, so the player can move on', () => {
    renderTab({ ok: false })
    expect(screen.getByRole('combobox')).toBeDefined()
  })

  it('shows what it is doing while the line is being built', () => {
    renderTab({ creating: true })
    expect(screen.getByText('Creating line…')).toBeDefined()
    expect(screen.queryByText('2 stations')).toBeNull()
  })

  it('shows the line color the player would get', () => {
    renderTab({ color: '#028800' })
    const swatch = screen.getByRole('button', { name: 'Change color' }).querySelector('span')
    expect(swatch?.style.background).toBe(asRenderedColor('#028800'))
  })

  it('asks to walk the palette when the player changes the color', () => {
    const { onCycleColor } = renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Change color' }))
    expect(onCycleColor).toHaveBeenCalledOnce()
  })

  it('offers to continue the line past each junction it stops at', () => {
    renderTab({ forks: [FORK] })
    expect(screen.getByText('Continue from Delta to:')).toBeDefined()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('reports the branch the player picked against its junction', () => {
    const { onChoose } = renderTab({ forks: [FORK] })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 's6' } })
    expect(onChoose).toHaveBeenCalledWith('s4', FOXTROT)
  })

  it('reports no branch when the player stops the line at the junction', () => {
    const { onChoose } = renderTab({ choices: { s4: ECHO }, forks: [FORK] })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '' } })
    expect(onChoose).toHaveBeenCalledWith('s4', null)
  })

  it('shows the branch already picked', () => {
    renderTab({ choices: { s4: ECHO }, forks: [FORK] })
    expect(screen.getAllByRole<HTMLSelectElement>('combobox')[1].value).toBe('s5')
  })

  it('hides the forks while the line is being built', () => {
    renderTab({ creating: true, forks: [FORK] })
    expect(screen.queryByText('Continue from Delta to:')).toBeNull()
  })
})
