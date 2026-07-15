import type { NewLineBranch, NewLineFork, NewLineForkChoices } from '@/domain/newline/NewLinePlanner'
import type { OrphanGroup } from '@/domain/newline/OrphanGroup'

import { Fragment, h } from '@/infrastructure/ui/react'
import { BranchSelect } from '@/presentation/components/BranchSelect'
import { Select } from '@/presentation/components/Select'
import { Spinner } from '@/presentation/components/Spinner'
import { StationList } from '@/presentation/components/StationList'
import { groupLabel } from '@/presentation/labels'

export interface NewLineTabProps {
  choices: NewLineForkChoices
  color?: string
  creating: boolean
  forks: NewLineFork[]
  groups: OrphanGroup[]
  names: string[]
  ok: boolean
  onChoose: (atStationId: string, branch: NewLineBranch | null) => void
  onCycleColor: () => void
  onSelectGroup: (key: string) => void
  selection: null | string
}

export function NewLineTab({
  choices,
  color,
  creating,
  forks,
  groups,
  names,
  ok,
  onChoose,
  onCycleColor,
  onSelectGroup,
  selection,
}: NewLineTabProps): JSX.Element {
  if (!groups.length) {
    return <div className="text-xs text-muted-foreground">No stations without a line.</div>
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Select
        onChange={onSelectGroup}
        options={groups.map((group) => ({ label: groupLabel(group), value: group.key }))}
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
                      options={[{ label: '— Don\'t continue —', value: '' }].concat(
                        fork.options.map((option) => ({ label: '→ ' + option.name, value: option.key })),
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
                        background: color,
                        border: '1px solid rgba(255,255,255,.25)',
                        borderRadius: '3px',
                        height: '14px',
                        width: '14px',
                      }}
                    />
                    Change color
                  </button>
                  <StationList
                    color={color}
                    flatRows
                    hideNewTag
                    items={names.map((name) => ({ isNew: true, name }))}
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
