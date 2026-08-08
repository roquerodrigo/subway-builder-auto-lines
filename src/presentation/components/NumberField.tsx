import { h, React } from '@/infrastructure/ui/react'

export interface NumberFieldProps {
  disabled?: boolean
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  suffix?: string
  value: number
}

// A labelled whole-number input. What the player types is held locally so a field
// can be cleared or half-typed without the setting jumping around; only a value
// inside the range is reported, and leaving the field restores the last good one.
export function NumberField({ disabled, label, max, min, onChange, suffix, value }: NumberFieldProps): JSX.Element {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => setText(String(value)), [value])

  const type = (next: string): void => {
    setText(next)
    const parsed = Number(next)
    if (next.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed)
    }
  }

  return (
    <label className={'flex items-center justify-between gap-3 ' + (disabled ? 'opacity-50' : '')}>
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        <input
          className="w-20 bg-primary/5 border border-border rounded-md px-2 py-1 text-sm text-right disabled:cursor-default"
          disabled={disabled}
          max={max}
          min={min}
          onBlur={() => setText(String(value))}
          onChange={(event) => type(event.target.value)}
          step={1}
          type="number"
          value={text}
        />
        {suffix ? <span className="w-8 text-xs text-muted-foreground">{suffix}</span> : null}
      </span>
    </label>
  )
}
