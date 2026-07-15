import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { NewLinePreview } from '@/application/PreviewNewLineUseCase'
import type { NewLineCorridor } from '@/domain/newline/NewLinePlanner'
import type { PanelDependencies } from '@/presentation/PanelDependencies'

import { h } from '@/infrastructure/ui/react'
import { createAutoLinesPanel } from '@/presentation/AutoLinesPanel'

import type { CitySpec } from './support/cityFixture'

import { buildCity, centerOf, CITY, EMPTY_CITY, nameById } from './support/cityFixture'

// The first two colors of the line palette: what a fresh preview offers, and what
// one click of "Change color" moves to.
const PREVIEW_COLOR = '#d70000'
const NEXT_COLOR = '#028800'

const CHARLIE_DELTA_GROUP = 's3|s4|s5|s6'

// The action button is the only full-width one; the tab bar carries the same
// "Extend" label, so a name lookup alone would be ambiguous.
function actionButton(): HTMLButtonElement {
  return document.querySelector('button.w-full') as HTMLButtonElement
}

function createHarness(spec: CitySpec = CITY) {
  let city = spec
  let state = buildCity(city)
  let corridor: NewLineCorridor | null = null

  const showNotification = vi.fn()
  const maintenance = { purgeOrphanTrains: vi.fn() }
  const previewOverlay = { clear: vi.fn(), show: vi.fn() }
  const extendLine = { execute: vi.fn(() => Promise.resolve({ committed: true, hadAdditions: true })) }
  const createNewLine = { execute: vi.fn(() => Promise.resolve(true)) }
  const discardPreview = { execute: vi.fn() }
  const previewNewLine = {
    execute: vi.fn(
      (stationIds: string[]): NewLinePreview => ({
        color: PREVIEW_COLOR,
        coordById: Object.fromEntries(stationIds.map((id) => [id, centerOf(city, id)])),
        corridor: corridor ?? { forks: [], path: stationIds },
        groupSize: stationIds.length,
        nameById: nameById(city),
        railPath: (ids) => ids.map((id) => centerOf(city, id)),
      }),
    ),
  }
  const dependencies = {
    api: { gameState: { getRoutes: () => city.routes ?? [] }, ui: { showNotification } },
    createNewLine,
    discardPreview,
    extendLine,
    maintenance,
    previewNewLine,
    previewOverlay,
    store: { state: () => state },
  }
  const AutoLinesPanel = createAutoLinesPanel(dependencies as unknown as PanelDependencies)
  const view = render(<AutoLinesPanel />)

  return {
    createNewLine,
    discardPreview,
    extendLine,
    maintenance,
    previewNewLine,
    previewOverlay,
    // Stands in for the player editing the map with the panel still open: the next
    // read of the store and of the route list sees the new city.
    rebuildCity: (next: CitySpec): void => {
      city = next
      state = buildCity(next)
    },
    showNotification,
    // Reshapes what the next preview reports, so a test can drive a corridor that
    // forks (or one that cannot form a line) without a bespoke city.
    useCorridor: (next: NewLineCorridor): void => {
      corridor = next
    },
    view,
  }
}

function lastOverlayColor(previewOverlay: { show: ReturnType<typeof vi.fn> }): unknown {
  const calls = previewOverlay.show.mock.calls

  return calls[calls.length - 1][2]
}

function openNewLineTab(): void {
  fireEvent.click(tab('New line'))
}

function pickers(): HTMLSelectElement[] {
  return screen.queryAllByRole<HTMLSelectElement>('combobox')
}

// The tab bar comes first in the DOM, so its "Extend" precedes the action button
// of the same name.
function tab(name: string): HTMLElement {
  return screen.getAllByRole('button', { name })[0]
}

describe('AutoLinesPanel tabs', () => {
  it('opens on the extend tab', () => {
    createHarness()
    expect(tab('Extend').className).toContain('bg-primary text-primary-foreground')
    expect(pickers()[0].value).toBe('r1')
  })

  it('switches to the new-line tab', () => {
    createHarness()
    openNewLineTab()
    expect(screen.getByText('Charlie')).toBeDefined()
    expect(actionButton().textContent).toBe('Create line')
  })

  it('goes back to the extend tab', () => {
    createHarness()
    openNewLineTab()
    fireEvent.click(tab('Extend'))
    expect(actionButton().textContent).toBe('Extend')
    expect(pickers()[0].value).toBe('r1')
  })

  it('keeps the player\'s work when they click the tab they are already on', () => {
    createHarness()
    fireEvent.change(pickers()[1], { target: { value: '0' } })
    fireEvent.click(tab('Extend'))
    expect(pickers()[1].value).toBe('0')
    expect(screen.getByText('Echo')).toBeDefined()
  })

  it('drops the previous tab\'s status on the way out', async () => {
    const harness = createHarness()
    harness.extendLine.execute.mockResolvedValue({ committed: false, hadAdditions: true })
    fireEvent.click(actionButton())
    await screen.findByText('Could not extend.')
    openNewLineTab()
    expect(screen.queryByText('Could not extend.')).toBeNull()
  })
})

describe('AutoLinesPanel extend tab', () => {
  it('preselects a line so the player can act straight away', () => {
    createHarness()
    expect(actionButton().disabled).toBe(false)
  })

  it('shows the line as it stands plus the stops it would gain', () => {
    createHarness()
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Bravo')).toBeDefined()
    expect(screen.getAllByText('New')).toHaveLength(2)
  })

  it('highlights the line being extended on the map in the line\'s own color', () => {
    const harness = createHarness()
    expect(lastOverlayColor(harness.previewOverlay)).toBe('#ff0000')
  })

  it('extends the line and says it worked', async () => {
    const harness = createHarness()
    fireEvent.click(actionButton())
    expect(await screen.findByText('Line extended')).toBeDefined()
    expect(harness.extendLine.execute).toHaveBeenCalledWith('r1', expect.anything(), {})
    expect(harness.showNotification).toHaveBeenCalledWith('Line extended!', 'success')
  })

  it('says it could not extend when the game refuses the change', async () => {
    const harness = createHarness()
    harness.extendLine.execute.mockResolvedValue({ committed: false, hadAdditions: true })
    fireEvent.click(actionButton())
    expect(await screen.findByText('Could not extend.')).toBeDefined()
    expect(harness.showNotification).not.toHaveBeenCalled()
  })

  it('asks for a branch when there is nothing to add without one', async () => {
    const harness = createHarness()
    harness.extendLine.execute.mockResolvedValue({ committed: false, hadAdditions: false })
    fireEvent.click(actionButton())
    expect(await screen.findByText('Pick a branch at the fork.')).toBeDefined()
  })

  it('surfaces the failure and clears the half-applied preview', async () => {
    const harness = createHarness()
    harness.extendLine.execute.mockRejectedValue(new Error('No valid path'))
    fireEvent.click(actionButton())
    expect(await screen.findByText('Error: No valid path')).toBeDefined()
    expect(harness.discardPreview.execute).toHaveBeenCalledWith(null)
  })

  it('extends into the branch the player picked at the fork', async () => {
    const harness = createHarness()
    fireEvent.change(pickers()[1], { target: { value: '0' } })
    expect(screen.getByText('Echo')).toBeDefined()
    fireEvent.click(actionButton())
    await screen.findByText('Line extended')
    expect(harness.extendLine.execute).toHaveBeenCalledWith('r1', expect.anything(), {
      s2: expect.objectContaining({ name: 'Echo' }),
    })
  })

  it('forgets the branch once the extension is done, so the next one starts clean', async () => {
    createHarness()
    fireEvent.change(pickers()[1], { target: { value: '0' } })
    fireEvent.click(actionButton())
    await screen.findByText('Line extended')
    expect(pickers()[1].value).toBe('')
  })

  it('drops the status when the player picks another line', async () => {
    const harness = createHarness()
    harness.extendLine.execute.mockResolvedValue({ committed: false, hadAdditions: true })
    fireEvent.click(actionButton())
    await screen.findByText('Could not extend.')
    fireEvent.change(pickers()[0], { target: { value: 'r2' } })
    expect(screen.queryByText('Could not extend.')).toBeNull()
  })

  it('has nothing to offer for a line that already covers its corridor', () => {
    createHarness()
    fireEvent.change(pickers()[0], { target: { value: 'r2' } })
    expect(screen.getByText('No extension possible for this line.')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })

  it('says so when the city has no line at all', () => {
    createHarness(EMPTY_CITY)
    expect(screen.getByText('No lines in this city.')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })

  it('lets go of the line the player deleted while the panel was open', () => {
    const harness = createHarness()
    harness.rebuildCity(EMPTY_CITY)
    fireEvent.click(screen.getByRole('button', { name: 'Reload options' }))
    expect(screen.getByText('No lines in this city.')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })
})

describe('AutoLinesPanel new-line tab', () => {
  it('preselects the largest unserved group', () => {
    createHarness()
    openNewLineTab()
    expect(pickers()[0].value).toBe(CHARLIE_DELTA_GROUP)
    expect(screen.getByText('4 stations')).toBeDefined()
  })

  it('previews the line on the map in the color it would be built with', () => {
    const harness = createHarness()
    openNewLineTab()
    expect(lastOverlayColor(harness.previewOverlay)).toBe(PREVIEW_COLOR)
  })

  it('switches to another unserved group', () => {
    const harness = createHarness()
    openNewLineTab()
    fireEvent.change(pickers()[0], { target: { value: 's10|s9' } })
    expect(screen.getByText('India')).toBeDefined()
    expect(harness.previewNewLine.execute).toHaveBeenLastCalledWith(['s9', 's10'])
  })

  it('builds the line and holds on the result', async () => {
    const harness = createHarness()
    openNewLineTab()
    fireEvent.click(actionButton())
    expect(await screen.findByText('Line created successfully!')).toBeDefined()
    expect(harness.createNewLine.execute).toHaveBeenCalledWith(['s3', 's4', 's5', 's6'], PREVIEW_COLOR)
    expect(harness.showNotification).toHaveBeenCalledWith('Line created!', 'success')
  })

  it('keeps the map clear on the result screen instead of teasing the next group', async () => {
    const harness = createHarness()
    openNewLineTab()
    fireEvent.click(actionButton())
    await screen.findByText('Line created successfully!')
    const showsAfterSuccess = harness.previewOverlay.show.mock.calls.length
    expect(harness.previewOverlay.clear).toHaveBeenCalled()
    expect(showsAfterSuccess).toBe(harness.previewOverlay.show.mock.calls.length)
  })

  it('moves on to the next group when the player asks for another line', async () => {
    createHarness()
    openNewLineTab()
    fireEvent.click(actionButton())
    await screen.findByText('Line created successfully!')
    expect(actionButton().textContent).toBe('Create another line')
    fireEvent.click(actionButton())
    expect(screen.queryByText('Line created successfully!')).toBeNull()
    expect(actionButton().textContent).toBe('Create line')
  })

  it('says it could not create the line when the game refuses', async () => {
    const harness = createHarness()
    harness.createNewLine.execute.mockResolvedValue(false)
    openNewLineTab()
    fireEvent.click(actionButton())
    expect(await screen.findByText('Could not create the line.')).toBeDefined()
    expect(harness.showNotification).not.toHaveBeenCalled()
  })

  it('surfaces the failure thrown while building', async () => {
    const harness = createHarness()
    harness.createNewLine.execute.mockRejectedValue(new Error('No valid path'))
    openNewLineTab()
    fireEvent.click(actionButton())
    expect(await screen.findByText('Error: No valid path')).toBeDefined()
  })

  it('shows it is working while the line is being built', async () => {
    const harness = createHarness()
    harness.createNewLine.execute.mockImplementation(() => new Promise(() => undefined))
    openNewLineTab()
    fireEvent.click(actionButton())
    expect(await screen.findByText('Creating line…')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })

  it('walks the palette and builds the line in the color the player settled on', async () => {
    const harness = createHarness()
    openNewLineTab()
    fireEvent.click(screen.getByRole('button', { name: 'Change color' }))
    expect(lastOverlayColor(harness.previewOverlay)).toBe(NEXT_COLOR)
    fireEvent.click(actionButton())
    await screen.findByText('Line created successfully!')
    expect(harness.createNewLine.execute).toHaveBeenCalledWith(['s3', 's4', 's5', 's6'], NEXT_COLOR)
  })

  it('follows the branch the player picked at a junction', () => {
    const harness = createHarness()
    harness.useCorridor({
      forks: [{
        atName: 'Delta',
        atStationId: 's4',
        end: 'end',
        options: [{ key: 's5', name: 'Echo', stationIds: ['s5'] }],
      }],
      path: ['s3', 's4'],
    })
    openNewLineTab()
    expect(screen.getByText('2 stations')).toBeDefined()
    fireEvent.change(pickers()[1], { target: { value: 's5' } })
    expect(screen.getByText('3 stations')).toBeDefined()
    expect(screen.getByText('Echo')).toBeDefined()
  })

  it('cannot build a line out of a group with no corridor', () => {
    const harness = createHarness()
    harness.useCorridor({ forks: [], path: [] })
    openNewLineTab()
    expect(screen.getByText('Could not form a line.')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })

  it('says so when every station already has a line', () => {
    createHarness(EMPTY_CITY)
    openNewLineTab()
    expect(screen.getByText('No stations without a line.')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })

  it('lets go of the group the player gave a line to while the panel was open', () => {
    const harness = createHarness()
    openNewLineTab()
    expect(screen.getByText('4 stations')).toBeDefined()
    harness.rebuildCity(EMPTY_CITY)
    fireEvent.click(screen.getByRole('button', { name: 'Reload options' }))
    expect(screen.getByText('No stations without a line.')).toBeDefined()
    expect(actionButton().disabled).toBe(true)
  })
})

describe('AutoLinesPanel lifecycle', () => {
  it('sweeps the orphan trains the player may have left behind', () => {
    const harness = createHarness()
    expect(harness.maintenance.purgeOrphanTrains).toHaveBeenCalled()
  })

  it('leaves no highlight on the map once it closes', () => {
    const harness = createHarness()
    harness.previewOverlay.clear.mockClear()
    harness.view.unmount()
    expect(harness.previewOverlay.clear).toHaveBeenCalled()
  })

  it('rescans the city when the player reloads the options', () => {
    const harness = createHarness()
    const before = harness.maintenance.purgeOrphanTrains.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Reload options' }))
    expect(harness.maintenance.purgeOrphanTrains.mock.calls.length).toBeGreaterThan(before)
  })

  it('drops the status when the player reloads the options', async () => {
    const harness = createHarness()
    harness.extendLine.execute.mockResolvedValue({ committed: false, hadAdditions: true })
    fireEvent.click(actionButton())
    await screen.findByText('Could not extend.')
    fireEvent.click(screen.getByRole('button', { name: 'Reload options' }))
    expect(screen.queryByText('Could not extend.')).toBeNull()
  })

  it('locks the reload out while an extension is in flight', () => {
    const harness = createHarness()
    harness.extendLine.execute.mockImplementation(() => new Promise(() => undefined))
    fireEvent.click(actionButton())
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reload options' }).disabled).toBe(true)
  })
})
