import type { ForkChoices, ForkOption } from '@/domain/line/ExpansionPlan'
import type { NewLineBranch, NewLineForkChoices } from '@/domain/newline/NewLinePlanner'
import type { PanelDependencies } from '@/presentation/PanelDependencies'
import type { Coordinate } from '@/shared/game/Coordinate'

import { LineColorPalette } from '@/domain/newline/LineColorPalette'
import { NewLinePlanner } from '@/domain/newline/NewLinePlanner'
import { OrphanGroupFinder } from '@/domain/newline/OrphanGroupFinder'
import { h, React } from '@/infrastructure/ui/react'
import { TabBar } from '@/presentation/components/TabBar'
import { useExtendPlan } from '@/presentation/hooks/useExtendPlan'
import { useNewLinePreview } from '@/presentation/hooks/useNewLinePreview'
import { errorMessage, realRoutes } from '@/presentation/labels'
import { DEFAULT_LINE_COLOR } from '@/presentation/theme'
import { PanelMode } from '@/presentation/types'
import { ExtendTab } from '@/presentation/view/ExtendTab'
import { NewLineTab } from '@/presentation/view/NewLineTab'

// The panel content: one component drives both tabs. The new-line preview is
// computed purely (no route is generated, nothing is drawn on the map), so
// browsing groups leaves no ghost line — the route is only built on commit.
export function createAutoLinesPanel(dependencies: PanelDependencies): () => JSX.Element {
  return function AutoLinesPanel(): JSX.Element {
    const [mode, setMode] = React.useState<PanelMode>(PanelMode.Extend)
    const [selection, setSelection] = React.useState<null | string>(null)
    const [choices, setChoices] = React.useState<ForkChoices>({})
    const [newLineChoices, setNewLineChoices] = React.useState<NewLineForkChoices>({})
    const [colorOverride, setColorOverride] = React.useState<null | string>(null)
    const [successMessage, setSuccessMessage] = React.useState<null | string>(null)
    const [status, setStatus] = React.useState('')
    const [busy, setBusy] = React.useState(false)
    const [refreshKey, setRefreshKey] = React.useState(0)
    const bump = (): void => setRefreshKey((key) => key + 1)

    // Sweep orphan trains whenever the panel opens / refreshes — the player may
    // have removed a station or edited a route by hand before opening us.
    React.useEffect(() => {
      dependencies.maintenance.purgeOrphanTrains()
    }, [refreshKey, mode])

    const routes = mode === PanelMode.Extend ? realRoutes(dependencies.api) : []
    const planData = useExtendPlan(dependencies, mode, selection, refreshKey)
    const groups = mode === PanelMode.New ? OrphanGroupFinder.find(dependencies.store.state()) : []
    const newLinePreview = useNewLinePreview(dependencies, mode, selection, refreshKey, groups)

    // The effective line = the base corridor plus any chosen fork branches. Kept
    // separate from the preview so picking a branch doesn't recompute the plan
    // (fork option identities stay stable, like the extend tab).
    const newLine = React.useMemo(() => {
      if (!newLinePreview) {
        return null
      }
      const path = NewLinePlanner.effectivePath(newLinePreview.corridor, newLineChoices)
      return {
        path,
        names: path.map((id) => newLinePreview.nameById[id] ?? '?'),
        ok: path.length >= 2,
      }
    }, [newLinePreview, newLineChoices])

    // The color a new line will get: the preview's pick, unless the user overrode
    // it with the change-color button. Extend uses the line's own color.
    const newLineColor = colorOverride ?? newLinePreview?.color ?? DEFAULT_LINE_COLOR

    // Highlight the previewed line on the map (no route is created) so the player
    // can see where it goes; cleared on tab switch, deselect, or panel close.
    React.useEffect(() => {
      const overlay = dependencies.previewOverlay
      // On the success screen, keep the map clear — don't highlight the next group.
      if (mode === PanelMode.New && successMessage) {
        overlay.clear()
        return () => overlay.clear()
      }
      const lines: Coordinate[][] = []
      const stations: Coordinate[] = []
      // Match the panel's preview color: the line being extended uses its own
      // color, a new line uses the (possibly overridden) preview color — the
      // panel's station list uses the very same colors.
      let color = DEFAULT_LINE_COLOR
      const addStations = (ids: string[], coordOf: (id: string) => Coordinate | undefined): void => {
        for (const id of ids) {
          const coordinate = coordOf(id)
          if (coordinate) {
            stations.push(coordinate)
          }
        }
      }
      if (mode === PanelMode.New && newLinePreview && newLine?.ok) {
        color = newLineColor
        lines.push(newLinePreview.railPath(newLine.path))
        addStations(newLine.path, (id) => newLinePreview.coordById[id])
      } else if (mode === PanelMode.Extend && planData) {
        color = planData.route.color || DEFAULT_LINE_COLOR
        for (const endpoint of planData.plan.endpoints) {
          const ids = [endpoint.stationId, ...endpoint.autoStationIds]
          const choice = choices[endpoint.stationId]
          if (endpoint.fork && choice) {
            ids.push(...choice.stationIds)
          }
          if (ids.length >= 2) {
            lines.push(planData.railPath(ids))
            addStations(ids, (id) => planData.plan.index.coordinate(id))
          }
        }
      }
      if (lines.some((line) => line.length >= 2)) {
        overlay.show(lines, stations, color)
      } else {
        overlay.clear()
      }
      return () => overlay.clear()
    }, [mode, newLine, newLinePreview, planData, choices, newLineColor, successMessage])

    // Default selection per mode (and self-correct when selection belongs to the other
    // mode after a tab switch). Intentionally runs every render (no dependencies array):
    // setSelection to the same value bails, so it settles without looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => {
      if (mode === PanelMode.New && successMessage) {
        return // holding on the success screen — don't jump to the next group
      }
      if (mode === PanelMode.Extend) {
        if (routes.length && !routes.some((route) => route.id === selection)) {
          setSelection(routes[0].id)
          setChoices({})
        } else if (!routes.length && selection !== null) {
          setSelection(null)
        }
      } else {
        if (groups.length && !groups.some((group) => group.key === selection)) {
          setSelection(groups[0].key)
        } else if (!groups.length && selection !== null) {
          setSelection(null)
        }
      }
    })

    const switchTab = (next: PanelMode): void => {
      if (next === mode) {
        return
      }
      setMode(next)
      setSelection(null)
      setChoices({})
      setNewLineChoices({})
      setColorOverride(null)
      setSuccessMessage(null)
      setStatus('')
    }

    const chooseBranch = (atStationId: string, branch: NewLineBranch | null): void => {
      setNewLineChoices((prev) => ({ ...prev, [atStationId]: branch }))
    }

    // Cycle the new line's color through the palette (overrides the preview's pick).
    const cycleColor = (): void => setColorOverride(LineColorPalette.next(newLineColor))

    // Re-scan the current tab's options (and rebuild the plan/preview), e.g. after
    // the player edits the map with the panel open.
    const reload = (): void => {
      setColorOverride(null)
      setSuccessMessage(null)
      setStatus('')
      bump()
    }

    // Leave the success screen and move on to the next group.
    const createAnother = (): void => {
      setSuccessMessage(null)
      setSelection(null)
      bump()
    }

    const chooseFork = (stationId: string, option: ForkOption | null): void => {
      setChoices((prev) => ({ ...prev, [stationId]: option }))
    }

    const doExtend = async (): Promise<void> => {
      if (!planData) {
        return
      }
      setBusy(true)
      setStatus('Applying…')
      try {
        const outcome = await dependencies.extendLine.execute(planData.route.id, planData.plan, choices)
        if (!outcome.hadAdditions) {
          setStatus('Pick a branch at the fork.')
        } else {
          setStatus(outcome.committed ? 'Line extended' : 'Could not extend.')
          if (outcome.committed) {
            dependencies.api.ui?.showNotification?.('Line extended!', 'success')
          }
        }
      } catch (error) {
        dependencies.discardPreview.execute(null) // clear preview + release guard + strip temps
        setStatus('Error: ' + errorMessage(error))
      }
      setBusy(false)
      setChoices({})
      bump()
    }

    const doCreate = async (): Promise<void> => {
      if (!newLine || !newLine.ok) {
        return
      }
      setBusy(true)
      setStatus('Creating…')
      // Yield a frame so the spinner actually paints before the build blocks the thread.
      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve(undefined)))
      })
      try {
        const created = await dependencies.createNewLine.execute(newLine.path, newLineColor)
        if (created) {
          dependencies.api.ui?.showNotification?.('Line created!', 'success')
          setStatus('')
          setSuccessMessage('Line created successfully!') // hold here, don't jump to the next group
          setNewLineChoices({})
          setColorOverride(null)
        } else {
          setStatus('Could not create the line.')
        }
      } catch (error) {
        setStatus('Error: ' + errorMessage(error))
      }
      setBusy(false)
      bump()
    }

    const showSuccess = mode === PanelMode.New && successMessage !== null
    const canAct =
      !busy &&
      (showSuccess ||
        (mode === PanelMode.Extend ?
            !!(planData && planData.plan.hasAction()) :
            !!(newLine && newLine.ok)))
    const actionLabel = showSuccess ? 'Create another line' : mode === PanelMode.Extend ? 'Extend' : 'Create line'
    const onAction = showSuccess ? createAnother : mode === PanelMode.Extend ? doExtend : doCreate

    return (
      <div className="flex h-full flex-col text-sm">
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <TabBar mode={mode} onSelect={switchTab} />
          </div>
          <button
            aria-label="Reload options"
            className="rounded-md bg-primary/10 px-3 text-base leading-none text-muted-foreground cursor-pointer hover:bg-primary/20 disabled:opacity-50 disabled:cursor-default"
            disabled={busy}
            onClick={reload}
            title="Reload options"
          >
            ↻
          </button>
        </div>

        <div className="mt-3 flex-1 space-y-3 overflow-auto">
          {mode === PanelMode.Extend ?
              (
                <ExtendTab
                  choices={choices}
                  onChoose={chooseFork}
                  onSelectRoute={(value) => {
                    setSelection(value)
                    setChoices({})
                    setStatus('')
                  }}
                  planData={planData}
                  routes={routes}
                  selection={selection}
                  status={status}
                />
              ) :
            showSuccess ?
                (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <div className="text-base font-semibold">{successMessage}</div>
                  </div>
                ) :
                (
                  <NewLineTab
                    choices={newLineChoices}
                    color={newLineColor}
                    creating={busy}
                    forks={newLinePreview?.corridor.forks ?? []}
                    groups={groups}
                    names={newLine?.names ?? []}
                    ok={!!(newLine && newLine.ok)}
                    onChoose={chooseBranch}
                    onCycleColor={cycleColor}
                    onSelectGroup={(value) => {
                      setSelection(value)
                      setStatus('')
                      setNewLineChoices({})
                      setColorOverride(null)
                      setSuccessMessage(null)
                    }}
                    selection={selection}
                  />
                )}
        </div>

        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}
          <button
            className={
              'w-full rounded-md py-2 text-sm font-semibold bg-primary text-primary-foreground ' +
              (canAct ? 'cursor-pointer hover:opacity-90' : 'opacity-50 cursor-default')
            }
            disabled={!canAct}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    )
  }
}
