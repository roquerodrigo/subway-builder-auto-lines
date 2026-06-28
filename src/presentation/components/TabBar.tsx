import { h } from '@/infrastructure/ui/react'
import { PanelMode } from '@/presentation/types'

export interface TabBarProps {
  mode: PanelMode
  onSelect: (mode: PanelMode) => void
}

export function TabBar({ mode, onSelect }: TabBarProps): JSX.Element {
  const tab = (label: string, value: PanelMode): JSX.Element => {
    const active = mode === value
    return (
      <button
        className={
          'flex-1 rounded-md py-2 text-xs font-semibold cursor-pointer ' +
          (active ?
            'bg-primary text-primary-foreground' :
            'bg-primary/10 text-muted-foreground hover:bg-primary/20')
        }
        key={value}
        onClick={() => onSelect(value)}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      {tab('Extend', PanelMode.Extend)}
      {tab('New line', PanelMode.New)}
    </div>
  )
}
