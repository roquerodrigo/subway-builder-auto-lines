import type { HeadwayMinutes, ServiceSettings } from '@/domain/settings/ServiceSettings'

import {
  MAX_CARS_PER_TRAIN,
  MAX_HEADWAY_MINUTES,
  MIN_CARS_PER_TRAIN,
  MIN_HEADWAY_MINUTES,
} from '@/domain/settings/ServiceSettings'
import { h } from '@/infrastructure/ui/react'
import { NumberField } from '@/presentation/components/NumberField'
import { Toggle } from '@/presentation/components/Toggle'

export interface SettingsTabProps {
  canReset: boolean
  onChange: (settings: ServiceSettings) => void
  onReset: () => void
  settings: ServiceSettings
}

// Everything the mod puts on a line after building it, under the player's hand:
// the whole thing can be switched off, and the numbers behind it are theirs to
// set. Saved as they type, and applied to the next line built or extended.
export function SettingsTab({ canReset, onChange, onReset, settings }: SettingsTabProps): JSX.Element {
  const off = !settings.autoTrains
  const headway = (period: keyof HeadwayMinutes, label: string): JSX.Element => (
    <NumberField
      disabled={off}
      label={label}
      max={MAX_HEADWAY_MINUTES}
      min={MIN_HEADWAY_MINUTES}
      onChange={(value) => onChange({ ...settings, headwayMinutes: { ...settings.headwayMinutes, [period]: value } })}
      suffix="min"
      value={settings.headwayMinutes[period]}
    />
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Toggle
          checked={settings.autoTrains}
          label="Auto trains"
          onChange={(checked) => onChange({ ...settings, autoTrains: checked })}
        />
        <div className="text-xs text-muted-foreground">
          {settings.autoTrains ?
            'Every line the mod builds or extends gets trains, the cars they need, and the schedule below.' :
            'Lines are built and extended without trains — run them yourself from the game’s line panel.'}
        </div>
      </div>

      <div className="space-y-2">
        <Toggle
          checked={settings.sortLinesByName}
          label="Sort lines by name"
          onChange={(checked) => onChange({ ...settings, sortLinesByName: checked })}
        />
        <div className="text-xs text-muted-foreground">
          {settings.sortLinesByName ?
            'The game’s line list is put back in name order whenever the mod changes the network. Lines sharing a colour stay grouped together, as the game groups them.' :
            'The line list keeps the order you gave it — the mod never reorders it.'}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trains</div>
        <NumberField
          disabled={off}
          label="Cars per train"
          max={MAX_CARS_PER_TRAIN}
          min={MIN_CARS_PER_TRAIN}
          onChange={(value) => onChange({ ...settings, carsPerTrain: value })}
          value={settings.carsPerTrain}
        />
        <div className="text-xs text-muted-foreground">
          Capped at what the line’s train type takes.
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Headways</div>
        {headway('peak', 'Peak')}
        {headway('midday', 'Midday')}
        {headway('offPeak', 'Off-peak')}
        {headway('night', 'Night')}
        <div className="text-xs text-muted-foreground">
          How often a train runs in each period. The trains needed follow from the line’s round trip, so a longer line
          gets more of them. A line given its own headways in the Headways tab keeps them.
        </div>
      </div>

      <button
        className={
          'rounded-md border border-border py-2 text-xs font-semibold ' +
          (canReset ? 'cursor-pointer hover:bg-primary/10' : 'opacity-50 cursor-default')
        }
        disabled={!canReset}
        onClick={onReset}
        style={{ width: '100%' }}
        type="button"
      >
        Reset to defaults
      </button>
    </div>
  )
}
