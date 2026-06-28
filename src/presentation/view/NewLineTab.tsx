import type { NewLineBranch, NewLineFork, NewLineForkChoices } from '@/domain/newline/NewLinePlanner'
import type { OrphanGroup } from '@/domain/newline/OrphanGroup'

import { Fragment, h } from '@/infrastructure/ui/react'
import { BranchSelect } from '@/presentation/components/BranchSelect'
import { Select } from '@/presentation/components/Select'
import { Spinner } from '@/presentation/components/Spinner'
import { StationList } from '@/presentation/components/StationList'
import { groupLabel } from '@/presentation/labels'

export interface NewLineTabProps {
  groups: OrphanGroup[]
  selection: null | string
  names: string[]
  ok: boolean
  forks: NewLineFork[]
  choices: NewLineForkChoices
  creating: boolean
  color?: string
  onSelectGroup: (key: string) => void
  onChoose: (atStationId: string, branch: NewLineBranch | null) => void
  onCycleColor: () => void
}

export function NewLineTab({
  groups,
  selection,
  names,
  ok,
  forks,
  choices,
  creating,
  color,
  onSelectGroup,
  onChoose,
  onCycleColor,
}: NewLineTabProps): JSX.Element {
  if (!groups.length) {
    return <div className="text-xs text-muted-foreground">No stations without a line.</div>
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Select
        onChange={onSelectGroup}
        options={groups.map((group) => ({ value: group.key, label: groupLabel(group) }))}
        value={selection}
      />
      {creating ?
          (
            <div className="flex flex-1 items-center justify-center">
              <Spinner label="Creating line…" />
            </div>
          ) :
        ok ?
            (
              <Fragment>
                {forks.map((fork) => {
                  const chosen = choices[fork.atStationId]
                  return (
                    <BranchSelect
                      key={fork.atStationId}
                      label={'Continue from ' + fork.atName + ' to:'}
                      onChange={(v) =>
                        onChoose(fork.atStationId, v === '' ? null : fork.options.find((o) => o.key === v) ?? null)}
                      options={[{ value: '', label: '— Don\'t continue —' }].concat(
                        fork.options.map((option) => ({ value: option.key, label: '→ ' + option.name })),
                      )}
                      value={chosen ? chosen.key : ''}
                    />
                  )
                })}
                <div className="flex-1 space-y-2 overflow-auto">
                  <button
                    className="flex items-center gap-2 rounded-md border border-border bg-primary/5 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-primary/10"
                    onClick={onCycleColor}
                    title="Change the line color"
                    type="button"
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        background: color,
                        border: '1px solid rgba(255,255,255,.25)',
                      }}
                    />
                    Change color
                  </button>
                  <StationList
                    color={color}
                    flatRows
                    hideNewTag
                    items={names.map((name) => ({ name, isNew: true }))}
                    route={null}
                  />
                  <div className="text-xs text-muted-foreground">
                    {names.length + ' stations'}
                  </div>
                </div>
              </Fragment>
            ) :
            <div className="text-xs text-muted-foreground">Could not form a line.</div>}
    </div>
  )
}
